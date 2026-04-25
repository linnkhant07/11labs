// app/lib/generateUtils.ts
import type { Page } from "./stories";

/**
 * Flattens all pages in a story into a single array,
 * including both branches of any choice pages.
 */
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