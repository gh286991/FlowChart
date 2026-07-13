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
