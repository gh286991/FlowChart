import type { AiEnv, AiMessage } from "./types";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function extractResponse<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "response" in raw) {
    const response = (raw as { response: unknown }).response;
    if (typeof response === "string") return JSON.parse(response) as T;
    return response as T;
  }
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}

function extractTextResponse(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") throw new Error("Workers AI returned an empty response");

  const record = raw as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  if (typeof record.output_text === "string") return record.output_text;
  if (record.result && typeof record.result === "object") {
    const result = record.result as Record<string, unknown>;
    if (typeof result.response === "string") return result.response;
    if (typeof result.output_text === "string") return result.output_text;
  }

  throw new Error("Workers AI did not return text");
}

export async function generateStructured<T>(
  env: AiEnv,
  options: {
    messages: AiMessage[];
    schema: Record<string, unknown>;
    maxTokens?: number;
  },
): Promise<T> {
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const raw = await env.AI.run(model, {
    messages: options.messages,
    max_tokens: options.maxTokens ?? 2_500,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: options.schema,
    },
  });

  return extractResponse<T>(raw);
}

export async function generateText(
  env: AiEnv,
  options: {
    messages: AiMessage[];
    maxTokens?: number;
    temperature?: number;
  },
): Promise<string> {
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const raw = await env.AI.run(model, {
    messages: options.messages,
    max_tokens: options.maxTokens ?? 3_000,
    temperature: options.temperature ?? 0.25,
  });

  return extractTextResponse(raw).trim();
}
