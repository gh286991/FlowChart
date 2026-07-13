import { readJsonRequest, runAuthenticatedAiRoute } from "@/lib/ai/http";
import { generateText } from "@/lib/ai/workers-ai";
import {
  assertNonEmptyString,
  normalizeNodeText,
  normalizeStringArray,
} from "@/lib/ai/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NoteComposeInput = {
  nodeText?: string;
  branchContext?: string[];
  content?: string;
  instruction?: string;
};

const DATA_IMAGE_PATTERN = /!\[([^\]]*)\]\(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+\)/g;

function sanitizeContent(value: unknown): string {
  const content = assertNonEmptyString(value, "content", 60_000);
  return content.replace(
    DATA_IMAGE_PATTERN,
    (_, alt: string) => `![${alt || "embedded image"}](embedded-image-omitted-from-ai-context)`,
  );
}

function cleanMarkdown(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) return fenced[1].trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ["markdown", "content", "response", "text"]) {
        if (typeof parsed[key] === "string" && parsed[key].trim()) return parsed[key].trim();
      }
    } catch {
      // Keep the original text when it only looks like JSON.
    }
  }

  return trimmed;
}

export async function POST(request: Request) {
  return runAuthenticatedAiRoute(async (env) => {
    const raw = await readJsonRequest<NoteComposeInput>(request);
    const nodeText = normalizeNodeText(raw.nodeText);
    const branchContext = normalizeStringArray(raw.branchContext, "branchContext", 12, 500);
    const content = sanitizeContent(raw.content ?? `# ${nodeText}`);
    const instruction = raw.instruction
      ? assertNonEmptyString(raw.instruction, "instruction", 2_000)
      : "請整理成清楚、可直接使用的節點註解。";

    const markdown = cleanMarkdown(await generateText(env, {
      maxTokens: 3_000,
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: [
            "你是心智圖節點筆記助理。",
            "請只輸出可直接儲存的 Markdown，不要加解說、JSON 或 Markdown 程式碼圍欄。",
            "保留重要資訊，使用清楚的標題、清單與段落。",
            "embedded-image-omitted-from-ai-context 代表原筆記中的圖片，不要捏造圖片內容或網址。",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            branchContext.length ? `上層脈絡：${branchContext.join(" > ")}` : "",
            `目前節點：${nodeText}`,
            `要求：${instruction}`,
            "目前筆記：",
            content,
          ].filter(Boolean).join("\n\n"),
        },
      ],
    }));

    if (!markdown) throw new Error("Workers AI returned empty Markdown");
    return { markdown };
  });
}
