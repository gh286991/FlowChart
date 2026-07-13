export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface MarkdownDocumentInput {
  name: string;
  blob: Blob;
}

export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
  toMarkdown?: (
    input: MarkdownDocumentInput | MarkdownDocumentInput[],
  ) => Promise<unknown>;
}

export interface AiSearchInstance {
  search(input: {
    messages: AiMessage[];
    ai_search_options?: {
      retrieval?: { max_num_results?: number };
    };
  }): Promise<unknown>;
}

export interface AiSearchNamespace {
  get(name: string): AiSearchInstance;
}

export interface AiEnv {
  AI: WorkersAiBinding;
  AI_MODEL?: string;
  AI_SEARCH?: AiSearchNamespace;
  AI_SEARCH_INSTANCE?: string;
}

export interface SourceDocument {
  title: string;
  url?: string;
  content: string;
}

export interface SuggestedNode {
  title: string;
  note?: string;
  kind?: "topic" | "fact" | "question" | "risk" | "task" | "source";
  sourceUrls?: string[];
  children?: SuggestedNode[];
}

export interface ResearchNodeInput {
  nodeText: string;
  branchContext?: string[];
  question?: string;
  sourceUrls?: string[];
  maxSuggestions?: number;
}

export interface ResearchNodeResult {
  summary: string;
  freshnessWarning: string | null;
  suggestedSearchQueries: string[];
  findings: Array<{
    title: string;
    detail: string;
    sourceUrls: string[];
  }>;
  suggestedNodes: SuggestedNode[];
}

export interface SplitTasksInput {
  nodeText: string;
  branchContext?: string[];
  constraints?: string[];
  maxTasks?: number;
}

export interface SplitTasksResult {
  goal: string;
  assumptions: string[];
  tasks: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
    estimate: "XS" | "S" | "M" | "L" | "XL";
    dependencies: string[];
  }>;
}

export interface OrganizeMarkdownInput {
  content: string;
  instruction?: string;
  maxDepth?: number;
}

export interface OrganizeMarkdownResult {
  title: string;
  summary: string;
  normalizedMarkdown: string;
  outline: SuggestedNode[];
  warnings: string[];
}

export interface ApplyPlanItem {
  tempId: string;
  parentTempId: string | null;
  title: string;
  note?: string;
  kind?: SuggestedNode["kind"];
  sourceUrls: string[];
}
