/** Input parameters for a simple web search tool. */
export interface MCPSearchInput {
  query: string;
  topK?: number;
  site?: string;
  timeRange?: "day" | "week" | "month" | "year";
}

/** Single search result item. */
export interface MCPSearchResultItem {
  title: string;
  url: string;
  snippet?: string;
}

/** Output payload containing search results. */
export interface MCPSearchOutput {
  results: MCPSearchResultItem[];
}
