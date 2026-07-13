import type { SourceDocument } from "./types";

function serializeSources(sources: SourceDocument[]): string {
  if (sources.length === 0) return "沒有提供外部來源。只能使用模型既有知識，必須明確標示時效限制。";
  return sources
    .map((source, index) => {
      const header = `[來源 ${index + 1}] ${source.title}${source.url ? `\nURL: ${source.url}` : ""}`;
      return `${header}\n${source.content}`;
    })
    .join("\n\n---\n\n");
}

export function researchMessages(input: {
  nodeText: string;
  branchContext: string[];
  question?: string;
  maxSuggestions: number;
  sources: SourceDocument[];
  sourceErrors: string[];
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是繁體中文的心智圖研究助手。",
        "你的任務是根據節點、上下文與來源，產生可驗證、簡短、可加入心智圖的內容。",
        "不可捏造來源；sourceUrls 只能填入提示中實際存在的 URL。",
        "沒有來源時，freshnessWarning 必須指出內容可能過時，不可假裝已上網搜尋。",
        "節點標題要短，詳細說明放 note。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `目前節點：${input.nodeText}`,
        `上層／同支線脈絡：${input.branchContext.join(" > ") || "無"}`,
        `研究問題：${input.question || `補充「${input.nodeText}」需要知道的重點`}`,
        `最多建議節點：${input.maxSuggestions}`,
        input.sourceErrors.length ? `來源讀取錯誤：${input.sourceErrors.join("；")}` : "",
        "",
        "可用來源：",
        serializeSources(input.sources),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export function taskMessages(input: {
  nodeText: string;
  branchContext: string[];
  constraints: string[];
  maxTasks: number;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是軟體與內容專案的任務拆解助手，使用繁體中文。",
        "把模糊目標拆成可執行、可驗收、順序合理的任務。",
        "每個任務應該可以由一個人獨立完成，避免只寫『處理』或『優化』。",
        "dependencies 填其他任務標題；沒有就回傳空陣列。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `目標節點：${input.nodeText}`,
        `脈絡：${input.branchContext.join(" > ") || "無"}`,
        `限制：${input.constraints.join("；") || "無"}`,
        `最多任務數：${input.maxTasks}`,
      ].join("\n"),
    },
  ];
}

export function markdownMessages(input: {
  content: string;
  instruction?: string;
  maxDepth: number;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是繁體中文 Markdown 編輯與心智圖整理助手。",
        "保留原始事實、程式碼、連結與重要細節，不可自行補造內容。",
        "normalizedMarkdown 要整理標題層級、重複段落、清單與空白，但不得刪除重要資訊。",
        "outline 是適合心智圖的精簡樹狀結構，標題避免過長。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `額外要求：${input.instruction || "整理結構並轉成心智圖大綱"}`,
        `心智圖最大深度：${input.maxDepth}`,
        "",
        "原始 Markdown：",
        input.content,
      ].join("\n"),
    },
  ];
}
