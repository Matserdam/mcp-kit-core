export interface MCPSearchInput {
  query: string;
  topK?: number;
  site?: string;
}

export interface MCPSearchResultItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface MCPSearchOutput {
  results: MCPSearchResultItem[];
}


