import type { ApplyPlanItem, SplitTasksResult, SuggestedNode } from "./types";

function randomTempId(index: number): string {
  return `ai-${index}-${crypto.randomUUID()}`;
}

export function nodesToApplyPlan(nodes: SuggestedNode[]): ApplyPlanItem[] {
  const result: ApplyPlanItem[] = [];
  let index = 0;

  const visit = (node: SuggestedNode, parentTempId: string | null) => {
    const tempId = randomTempId(index++);
    result.push({
      tempId,
      parentTempId,
      title: node.title,
      note: node.note,
      kind: node.kind,
      sourceUrls: node.sourceUrls ?? [],
    });
    for (const child of node.children ?? []) visit(child, tempId);
  };

  for (const node of nodes) visit(node, null);
  return result;
}

export function tasksToSuggestedNodes(result: SplitTasksResult): SuggestedNode[] {
  return result.tasks.map((task) => ({
    title: task.title,
    kind: "task",
    note: [
      task.description,
      `估算：${task.estimate}`,
      task.dependencies.length ? `相依：${task.dependencies.join("、")}` : "",
      task.acceptanceCriteria.length
        ? `驗收：\n${task.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    sourceUrls: [],
    children: [],
  }));
}

export function outlineToMarkdown(title: string, nodes: SuggestedNode[]): string {
  const lines = [`# ${title}`];
  const visit = (node: SuggestedNode, depth: number) => {
    lines.push(`${"  ".repeat(depth)}- ${node.title}`);
    for (const child of node.children ?? []) visit(child, depth + 1);
  };
  for (const node of nodes) visit(node, 0);
  return lines.join("\n");
}
