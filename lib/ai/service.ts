import { markdownSchema, researchSchema, taskSchema } from "./schemas";
import { markdownMessages, researchMessages, taskMessages } from "./prompts";
import { loadResearchSources } from "./source-loader";
import type {
  AiEnv,
  OrganizeMarkdownInput,
  OrganizeMarkdownResult,
  ResearchNodeInput,
  ResearchNodeResult,
  SplitTasksInput,
  SplitTasksResult,
} from "./types";
import {
  assertNonEmptyString,
  clampInteger,
  normalizeMarkdown,
  normalizeNodeText,
  normalizeStringArray,
  normalizeUrls,
} from "./validation";
import { generateStructured } from "./workers-ai";

export async function researchNode(
  env: AiEnv,
  raw: ResearchNodeInput,
): Promise<ResearchNodeResult> {
  const nodeText = normalizeNodeText(raw.nodeText);
  const branchContext = normalizeStringArray(raw.branchContext, "branchContext", 12, 500);
  const sourceUrls = normalizeUrls(raw.sourceUrls);
  const question = raw.question
    ? assertNonEmptyString(raw.question, "question", 2_000)
    : undefined;
  const maxSuggestions = clampInteger(raw.maxSuggestions, 6, 1, 10);
  const query = question || `${branchContext.join(" ")} ${nodeText}`.trim();
  const { sources, errors } = await loadResearchSources(env, query, sourceUrls);

  return generateStructured<ResearchNodeResult>(env, {
    schema: researchSchema as unknown as Record<string, unknown>,
    messages: researchMessages({
      nodeText,
      branchContext,
      question,
      maxSuggestions,
      sources,
      sourceErrors: errors,
    }),
  });
}

export async function splitNodeIntoTasks(
  env: AiEnv,
  raw: SplitTasksInput,
): Promise<SplitTasksResult> {
  const nodeText = normalizeNodeText(raw.nodeText);
  const branchContext = normalizeStringArray(raw.branchContext, "branchContext", 12, 500);
  const constraints = normalizeStringArray(raw.constraints, "constraints", 10, 1_000);
  const maxTasks = clampInteger(raw.maxTasks, 7, 2, 12);

  return generateStructured<SplitTasksResult>(env, {
    schema: taskSchema as unknown as Record<string, unknown>,
    messages: taskMessages({ nodeText, branchContext, constraints, maxTasks }),
  });
}

export async function organizeMarkdown(
  env: AiEnv,
  raw: OrganizeMarkdownInput,
): Promise<OrganizeMarkdownResult> {
  const content = normalizeMarkdown(raw.content);
  const instruction = raw.instruction
    ? assertNonEmptyString(raw.instruction, "instruction", 2_000)
    : undefined;
  const maxDepth = clampInteger(raw.maxDepth, 4, 2, 6);

  return generateStructured<OrganizeMarkdownResult>(env, {
    schema: markdownSchema as unknown as Record<string, unknown>,
    messages: markdownMessages({ content, instruction, maxDepth }),
    maxTokens: 6_000,
  });
}

export async function fileToMarkdown(env: AiEnv, file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || file.type.startsWith("text/")) {
    return file.text();
  }
  if (!env.AI.toMarkdown) {
    throw new Error("This file requires Workers AI Markdown Conversion, but AI.toMarkdown is unavailable");
  }
  const result = await env.AI.toMarkdown({ name: file.name, blob: file });
  const item = Array.isArray(result) ? result[0] : result;
  if (!item || typeof item !== "object") throw new Error("Markdown conversion returned an invalid result");
  const record = item as Record<string, unknown>;
  if (record.format === "error") throw new Error(String(record.error || "Markdown conversion failed"));
  if (typeof record.data !== "string") throw new Error("Markdown conversion did not return text");
  return record.data;
}
