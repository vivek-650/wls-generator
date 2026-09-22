export type SearchResultType = "candidate" | "company";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchResponse {
  results: SearchResult[];
}
