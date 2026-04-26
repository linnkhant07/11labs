#!/usr/bin/env node
//
// Upload replacement images for a specific story into Cloudinary and update
// the local public/stories/{slug}/story.json cache.
//
// Usage:
//   node --env-file=.env scripts/upload-images.mjs --story <slug> --images <folder>
//
// Name your replacement image files after the page_id they replace:
//   p1.png, p2.jpg, p3.png          regular pages
//   p4a.png, p5b.png                 branch pages
//   choice-0-a.png, choice-0-b.png   choice preview images (0 = first choice in tree)
//
// Example:
//   node --env-file=.env scripts/upload-images.mjs --story tornadoes --images ./replacements

import { v2 as cloudinary } from "cloudinary";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// ── Validate Cloudinary config ────────────────────────────────────────────────

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("✗ Missing Cloudinary env vars. Run with: node --env-file=.env scripts/upload-images.mjs ...");
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Parse CLI args ────────────────────────────────────────────────────────────

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}

const storyArg = getArg("--story");
const imagesArg = getArg("--images");

if (!storyArg || !imagesArg) {
  console.error(`
Usage: node --env-file=.env scripts/upload-images.mjs --story <slug> --images <folder>

Name your replacement image files by page_id:
  p1.png, p2.jpg, p3.png          regular pages
  p4a.png, p5b.png                 branch pages
  choice-0-a.png, choice-0-b.png   choice preview images

Example:
  node --env-file=.env scripts/upload-images.mjs --story tornadoes --images ./replacements
`);
  process.exit(1);
}

// ── Load story.json ───────────────────────────────────────────────────────────

const slug = storyArg.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
const storyPath = join(ROOT, "public", "stories", slug, "story.json");

let story;
try {
  story = JSON.parse(readFileSync(storyPath, "utf-8"));
} catch {
  console.error(`✗ Could not read story.json at: ${storyPath}`);
  console.error(`  Have you generated this story yet?`);
  process.exit(1);
}

// ── Collect image files ───────────────────────────────────────────────────────

const imageFolder = join(process.cwd(), imagesArg);
const VALID_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

let files;
try {
  files = readdirSync(imageFolder).filter((f) =>
    VALID_EXTS.has(extname(f).toLowerCase())
  );
} catch {
  console.error(`✗ Could not read images folder: ${imageFolder}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`✗ No .jpg/.jpeg/.png/.webp files found in: ${imageFolder}`);
  process.exit(1);
}

// ── Upload ────────────────────────────────────────────────────────────────────

const version = Date.now();

async function uploadFile(filePath, pageId) {
  const publicId = `educate/stories/${slug}/${version}/${pageId}`;
  const result = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
  return result.secure_url;
}

// ── Patch story.json ──────────────────────────────────────────────────────────
// Walk the page tree in the same order as collectAllChoices so that
// "choice-0-a" always refers to the first choice encountered in the tree.

let choiceCounter = 0;

function patchPages(pages, urlMap) {
  for (const page of pages) {
    if (urlMap.has(page.page_id)) {
      page.image_url = urlMap.get(page.page_id);
    }
    if (page.choice) {
      const idx = choiceCounter++;
      const keyA = `choice-${idx}-a`;
      const keyB = `choice-${idx}-b`;
      if (urlMap.has(keyA)) page.choice.option_a.image_url = urlMap.get(keyA);
      if (urlMap.has(keyB)) page.choice.option_b.image_url = urlMap.get(keyB);
      patchPages(page.choice.option_a.pages, urlMap);
      patchPages(page.choice.option_b.pages, urlMap);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nStory : "${story.title}" (${slug})`);
  console.log(`Folder: ${imageFolder}`);
  console.log(`Files : ${files.join(", ")}\n`);

  const urlMap = new Map();
  const failed = [];

  for (const file of files) {
    const pageId = basename(file, extname(file));
    try {
      const url = await uploadFile(join(imageFolder, file), pageId);
      urlMap.set(pageId, url);
      console.log(`✓  ${file.padEnd(24)} → ${url}`);
    } catch (err) {
      failed.push(file);
      console.error(`✗  ${file.padEnd(24)} failed: ${err.message ?? err}`);
    }
  }

  if (urlMap.size === 0) {
    console.error("\n✗ No images were uploaded successfully. story.json not modified.");
    process.exit(1);
  }

  patchPages(story.pages, urlMap);
  writeFileSync(storyPath, JSON.stringify(story, null, 2));

  console.log(`\n✓ Uploaded ${urlMap.size} image(s) and updated:`);
  console.log(`  ${storyPath}`);

  if (failed.length > 0) {
    console.warn(`\n⚠ ${failed.length} file(s) failed to upload: ${failed.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("\n✗ Unexpected error:", err.message ?? err);
  process.exit(1);
});
