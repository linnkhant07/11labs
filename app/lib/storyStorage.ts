import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { Story, Page } from "./stories";

export function topicToSlug(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function saveStoryToDisk(story: Story, allPages: Page[]): Promise<void> {
  const slug = topicToSlug(story.topic);
  const dir = join(process.cwd(), "public", "stories", slug);
  await mkdir(dir, { recursive: true });

  // Flush base64 image data to files and rewrite image_url to a public path
  await Promise.all(
    allPages
      .filter((p) => p.image_url.startsWith("data:"))
      .map(async (page) => {
        const [header, data] = page.image_url.split(",");
        const ext = header.includes("png") ? "png" : "jpg";
        const filename = `${page.page_id}.${ext}`;
        await writeFile(join(dir, filename), Buffer.from(data, "base64"));
        page.image_url = `/stories/${slug}/${filename}`;
      })
  );

  await writeFile(join(dir, "story.json"), JSON.stringify(story, null, 2));
}
