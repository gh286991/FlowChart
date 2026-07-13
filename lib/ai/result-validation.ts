import { z } from "zod";
import type {
  OrganizeMarkdownResult,
  ResearchNodeResult,
  SplitTasksResult,
  SuggestedNode,
} from "./types";

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();
const stringList = (maxItems: number, maxLength = 2_000) =>
  z.array(requiredText(maxLength)).max(maxItems).default([]);

const nodeKindSchema = z.enum(["topic", "fact", "question", "risk", "task", "source"]);

let suggestedNodeSchema: z.ZodType<SuggestedNode>;
suggestedNodeSchema = z.lazy(() =>
  z
    .object({
      title: requiredText(500),
      note: optionalText(5_000),
      kind: nodeKindSchema.optional(),
      sourceUrls: stringList(8),
      children: z.array(suggestedNodeSchema).max(6).default([]),
    })
    .strict(),
);

const researchResultSchema: z.ZodType<ResearchNodeResult> = z
  .object({
    summary: requiredText(8_000),
    freshnessWarning: z.string().trim().max(2_000).nullable().default(null),
    suggestedSearchQueries: stringList(8, 500),
    findings: z
      .array(
        z
          .object({
            title: requiredText(500),
            detail: requiredText(8_000),
            sourceUrls: stringList(8),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    suggestedNodes: z.array(suggestedNodeSchema).max(10).default([]),
  })
  .strict();

const taskResultSchema: z.ZodType<SplitTasksResult> = z
  .object({
    goal: requiredText(2_000),
    assumptions: stringList(8, 1_000),
    tasks: z
      .array(
        z
          .object({
            title: requiredText(500),
            description: requiredText(5_000),
            acceptanceCriteria: stringList(6, 1_000),
            estimate: z.enum(["XS", "S", "M", "L", "XL"]),
            dependencies: stringList(6, 500),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

const markdownResultSchema: z.ZodType<OrganizeMarkdownResult> = z
  .object({
    title: requiredText(500),
    summary: requiredText(8_000),
    normalizedMarkdown: requiredText(60_000),
    outline: z.array(suggestedNodeSchema).max(20).default([]),
    warnings: stringList(8, 1_000),
  })
  .strict();

function assertNodeBudget(nodes: SuggestedNode[], maxDepth: number, maxNodes: number): void {
  let count = 0;
  const visit = (node: SuggestedNode, depth: number) => {
    count += 1;
    if (count > maxNodes) throw new Error("Workers AI returned too many suggested nodes");
    if (depth > maxDepth) throw new Error("Workers AI returned a node tree that is too deep");
    for (const child of node.children ?? []) visit(child, depth + 1);
  };
  for (const node of nodes) visit(node, 1);
}

function parseResult<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Workers AI returned invalid structured output", { cause: parsed.error });
  }
  return parsed.data;
}

export function parseResearchResult(value: unknown): ResearchNodeResult {
  const result = parseResult(researchResultSchema, value);
  assertNodeBudget(result.suggestedNodes, 6, 80);
  return result;
}

export function parseTaskResult(value: unknown): SplitTasksResult {
  return parseResult(taskResultSchema, value);
}

export function parseMarkdownResult(value: unknown): OrganizeMarkdownResult {
  const result = parseResult(markdownResultSchema, value);
  assertNodeBudget(result.outline, 6, 120);
  return result;
}
