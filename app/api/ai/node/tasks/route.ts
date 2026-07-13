import { readJsonRequest, runAuthenticatedAiRoute } from "@/lib/ai/http";
import { splitNodeIntoTasks } from "@/lib/ai/service";
import type { SplitTasksInput } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAuthenticatedAiRoute(async (env) =>
    splitNodeIntoTasks(env, await readJsonRequest<SplitTasksInput>(request)),
  );
}
