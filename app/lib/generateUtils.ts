import type { Page } from "./stories";

export function topicToSlug(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function collectAllPages(pages: Page[]): Page[] {
  const result: Page[] = [];
  for (const page of pages) {
    result.push(page);
    if (page.choice) {
      result.push(...collectAllPages(page.choice.option_a.pages));
      result.push(...collectAllPages(page.choice.option_b.pages));
    }
  }
  return result;
}
