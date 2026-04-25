import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v2 as cloudinary } from "cloudinary";
import type { Story, Page } from "./stories";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export function topicToSlug(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function uploadImageToCloudinary(
  base64DataUrl: string,
  publicId: string
): Promise<string> {
  const result = await cloudinary.uploader.upload(base64DataUrl, {
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
    // Serve at a consistent quality/format for fast delivery
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
  return result.secure_url;
}

export async function saveStoryToDisk(story: Story, allPages: Page[]): Promise<void> {
  const slug = topicToSlug(story.topic);

  // Upload images to Cloudinary in parallel and rewrite image_url
  await Promise.all(
    allPages
      .filter((p) => p.image_url.startsWith("data:"))
      .map(async (page) => {
        const publicId = `educate/stories/${slug}/${page.page_id}`;
        page.image_url = await uploadImageToCloudinary(page.image_url, publicId);
      })
  );

  // Save story JSON locally for demo caching
  const dir = join(process.cwd(), "public", "stories", slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "story.json"), JSON.stringify(story, null, 2));
}
