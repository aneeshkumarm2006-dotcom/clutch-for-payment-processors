/**
 * Shapes shared between the typeahead API (`/api/search/suggest`, server) and
 * the search box that consumes it (client). They live apart from `lib/search.ts`
 * so a client component can type its `fetch` without importing that module —
 * `lib/search.ts` pulls in mongoose models, which must never reach the browser
 * bundle.
 */

export type SuggestType = "processor" | "category" | "blog";

export interface SuggestItem {
  id: string;
  type: SuggestType;
  /** Primary line — processor/category name, or article title. */
  label: string;
  /** Optional second line (tagline, short description, excerpt). */
  sublabel?: string;
  /** Internal destination, e.g. `/processor/stripe`. */
  href: string;
  /** Processor logo URL, when one exists. */
  logo?: string;
}

export interface SuggestResults {
  query: string;
  items: SuggestItem[];
}
