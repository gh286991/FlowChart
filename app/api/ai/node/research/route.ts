import { readJsonRequest, runAuthenticatedAiRoute } from "@/lib/ai/http";
import { researchNode } from "@/lib/ai/service";
import type { ResearchNodeInput } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAuthenticatedAiRoute(async (env) =>
    researchNode(env, await readJsonRequest<ResearchNodeInput>(request)),
  );
}
