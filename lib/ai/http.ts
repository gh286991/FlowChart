import { getCurrentUser } from "@/lib/auth";
import { getAiEnv } from "./runtime";
import type { AiEnv } from "./types";

export function aiJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function readJsonRequest<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }
  return (await request.json()) as T;
}

function isClientError(message: string): boolean {
  return /required|must|exceeds|supports|content-type|file|sourceurls|invalid url|private or local/i.test(
    message,
  );
}

export async function runAuthenticatedAiRoute<T>(
  action: (env: AiEnv) => Promise<T>,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return aiJson({ error: "Unauthorized" }, 401);

  try {
    const env = await getAiEnv();
    return aiJson({ data: await action(env) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    console.error("Cloudflare Workers AI request failed", error);
    return aiJson({ error: message }, isClientError(message) ? 400 : 502);
  }
}
