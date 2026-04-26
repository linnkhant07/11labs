import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v2 as cloudinary } from "cloudinary";
import type { Story, Page } from "./stories";
import { collectAllChoices, topicToSlug } from "./generateUtils";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function uploadImageToCloudinary(
  base64DataUrl: string,
  publicId: string
): Promise<string> {
  const result = await cloudinary.uploader.upload(base64DataUrl, {
    public_id: publicId,
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
  return result.secure_url;
}

export async function saveStoryToDisk(story: Story, allPages: Page[]): Promise<void> {
  const slug = topicToSlug(story.topic);
  const version = Date.now();

  const allChoices = collectAllChoices(story.pages);

  // Upload page images and choice preview images to Cloudinary in parallel
  await Promise.all([
    ...allPages
      .filter((p) => p.image_url.startsWith("data:"))
      .map(async (page) => {
        const publicId = `educate/stories/${slug}/${version}/${page.page_id}`;
        page.image_url = await uploadImageToCloudinary(page.image_url, publicId);
      }),
    ...allChoices.flatMap((choice, i) => [
      choice.option_a.image_url.startsWith("data:")
        ? uploadImageToCloudinary(
            choice.option_a.image_url,
            `educate/stories/${slug}/${version}/choice-${i}-a`
          ).then((url) => { choice.option_a.image_url = url; })
        : Promise.resolve(),
      choice.option_b.image_url.startsWith("data:")
        ? uploadImageToCloudinary(
            choice.option_b.image_url,
            `educate/stories/${slug}/${version}/choice-${i}-b`
          ).then((url) => { choice.option_b.image_url = url; })
        : Promise.resolve(),
    ]),
  ]);

  // Save story JSON locally for demo caching (skip on Vercel — read-only filesystem)
  if (!process.env.VERCEL) {
    const dir = join(process.cwd(), "public", "stories", slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "story.json"), JSON.stringify(story, null, 2));
  }
}
