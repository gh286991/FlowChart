import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AiEnv, AiSearchNamespace, WorkersAiBinding } from "./types";

export async function getAiEnv(): Promise<AiEnv> {
  const { env } = await getCloudflareContext({ async: true });
  const runtimeEnv = env as unknown as Record<string, unknown>;
  const ai = runtimeEnv.AI as WorkersAiBinding | undefined;

  if (!ai || typeof ai.run !== "function") {
    throw new Error("Cloudflare Workers AI binding AI is not configured");
  }

  return {
    AI: ai,
    AI_MODEL: typeof runtimeEnv.AI_MODEL === "string" ? runtimeEnv.AI_MODEL : undefined,
    AI_SEARCH: runtimeEnv.AI_SEARCH as AiSearchNamespace | undefined,
    AI_SEARCH_INSTANCE:
      typeof runtimeEnv.AI_SEARCH_INSTANCE === "string"
        ? runtimeEnv.AI_SEARCH_INSTANCE
        : undefined,
  };
}
