import { readJsonRequest, runAuthenticatedAiRoute } from "@/lib/ai/http";
import { fileToMarkdown, organizeMarkdown } from "@/lib/ai/service";
import type { AiEnv, OrganizeMarkdownInput } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readInput(request: Request, env: AiEnv): Promise<OrganizeMarkdownInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return readJsonRequest<OrganizeMarkdownInput>(request);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("file is required");
  if (file.size > 10 * 1024 * 1024) throw new Error("file exceeds 10 MB");

  return {
    content: await fileToMarkdown(env, file),
    instruction:
      typeof form.get("instruction") === "string"
        ? String(form.get("instruction"))
        : undefined,
    maxDepth: Number(form.get("maxDepth")) || undefined,
  };
}

export async function POST(request: Request) {
  return runAuthenticatedAiRoute(async (env) => organizeMarkdown(env, await readInput(request, env)));
}
