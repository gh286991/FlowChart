export type LayoutMode = "both" | "right" | "left";
export type BranchSide = "left" | "right";

export type MindNode = {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  color: string;
  side?: BranchSide;
};

export type MindEdge = {
  id: string;
  source: string;
  target: string;
};

export type MindMapData = {
  version: 1;
  layoutMode: LayoutMode;
  nodes: MindNode[];
  edges: MindEdge[];
};

const ROOT_COLOR = "#26385f";
const BRANCH_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];
const X_GAP = 290;
const Y_GAP = 92;

export function createEmptyMindMap(title: string): MindMapData {
  return {
    version: 1,
    layoutMode: "both",
    nodes: [
      {
        id: "root",
        parentId: null,
        text: title,
        x: 0,
        y: 0,
        color: ROOT_COLOR
      }
    ],
    edges: []
  };
}

function cleanOutlineLine(raw: string): string {
  return raw
    .replace(/^\s*(?:[-*+]\s+|#{1,6}\s+|\d+[.)]\s+)/, "")
    .trim();
}

export function createMindMapFromOutline(title: string, outline: string): MindMapData {
  const data = createEmptyMindMap(title);
  const stack: Array<[number, string]> = [[-1, "root"]];
  let topLevelIndex = 0;

  for (const raw of outline.split(/\r?\n/)) {
    const text = cleanOutlineLine(raw);
    if (!text) continue;

    const headingDepth = raw.match(/^\s*(#{1,6})\s+/)?.[1].length;
    const indentation = raw.match(/^\s*/)?.[0].replace(/\t/g, "  ").length ?? 0;
    const depth = headingDepth ? headingDepth - 1 : Math.floor(indentation / 2);

    while (stack.length > 1 && stack.at(-1)![0] >= depth) stack.pop();
    const parentId = stack.at(-1)?.[1] ?? "root";
    const parent = data.nodes.find(node => node.id === parentId)!;
    const id = `node-${crypto.randomUUID().slice(0, 8)}`;
    const isTopLevel = parentId === "root";
    const side: BranchSide = isTopLevel
      ? topLevelIndex++ % 2 === 0
        ? "right"
        : "left"
      : parent.side ?? "right";
    const color = isTopLevel ? BRANCH_COLORS[(topLevelIndex - 1) % BRANCH_COLORS.length] : parent.color;

    data.nodes.push({ id, parentId, text, x: 0, y: 0, color, side });
    data.edges.push({ id: `edge-${parentId}-${id}`, source: parentId, target: id });
    stack.push([depth, id]);
  }

  return autoLayoutMindMap(data);
}

export function autoLayoutMindMap(input: MindMapData): MindMapData {
  const nodes = input.nodes.map(node => ({ ...node }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const children = new Map<string, MindNode[]>();

  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }

  const root = byId.get("root") ?? nodes.find(node => !node.parentId);
  if (!root) return input;
  root.x = 0;
  root.y = 0;

  const rootChildren = children.get(root.id) ?? [];
  if (input.layoutMode === "right") rootChildren.forEach(node => (node.side = "right"));
  if (input.layoutMode === "left") rootChildren.forEach(node => (node.side = "left"));
  if (input.layoutMode === "both") {
    rootChildren.forEach((node, index) => {
      node.side = index % 2 === 0 ? "right" : "left";
    });
  }

  const inheritSide = (id: string, side: BranchSide) => {
    for (const child of children.get(id) ?? []) {
      child.side = side;
      inheritSide(child.id, side);
    }
  };
  rootChildren.forEach(node => inheritSide(node.id, node.side ?? "right"));

  const weightCache = new Map<string, number>();
  const weight = (id: string): number => {
    const cached = weightCache.get(id);
    if (cached) return cached;
    const list = children.get(id) ?? [];
    const value = list.length === 0 ? 1 : list.reduce((sum, child) => sum + weight(child.id), 0);
    weightCache.set(id, value);
    return value;
  };

  const positionBranch = (node: MindNode, depth: number, top: number, span: number, side: BranchSide) => {
    const centerY = top + span / 2;
    node.x = (side === "right" ? 1 : -1) * depth * X_GAP;
    node.y = centerY;

    const list = children.get(node.id) ?? [];
    let cursor = top;
    for (const child of list) {
      const childSpan = weight(child.id) * Y_GAP;
      positionBranch(child, depth + 1, cursor, childSpan, side);
      cursor += childSpan;
    }
  };

  for (const side of ["left", "right"] as const) {
    const group = rootChildren.filter(node => (node.side ?? "right") === side);
    const totalSpan = group.reduce((sum, node) => sum + weight(node.id) * Y_GAP, 0);
    let cursor = -totalSpan / 2;
    for (const node of group) {
      const span = weight(node.id) * Y_GAP;
      positionBranch(node, 1, cursor, span, side);
      cursor += span;
    }
  }

  return { ...input, nodes };
}

export function addChildNode(data: MindMapData, parentId: string, text: string): MindMapData {
  const parent = data.nodes.find(node => node.id === parentId);
  if (!parent) throw new Error("parent not found");

  const siblings = data.nodes.filter(node => node.parentId === parentId);
  let side: BranchSide = parent.side ?? "right";
  if (parentId === "root") {
    if (data.layoutMode === "left") side = "left";
    else if (data.layoutMode === "right") side = "right";
    else {
      const leftCount = siblings.filter(node => node.side === "left").length;
      const rightCount = siblings.filter(node => node.side !== "left").length;
      side = rightCount <= leftCount ? "right" : "left";
    }
  }

  const topLevelIndex = data.nodes.filter(node => node.parentId === "root").length;
  const color = parentId === "root" ? BRANCH_COLORS[topLevelIndex % BRANCH_COLORS.length] : parent.color;
  const id = `node-${crypto.randomUUID().slice(0, 8)}`;

  return autoLayoutMindMap({
    ...data,
    nodes: [...data.nodes, { id, parentId, text, x: parent.x, y: parent.y, color, side }],
    edges: [...data.edges, { id: `edge-${parentId}-${id}`, source: parentId, target: id }]
  });
}

export function deleteNodeTree(data: MindMapData, nodeId: string): MindMapData {
  if (nodeId === "root") return data;
  const removed = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of data.nodes) {
      if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) {
        removed.add(node.id);
        changed = true;
      }
    }
  }

  return autoLayoutMindMap({
    ...data,
    nodes: data.nodes.filter(node => !removed.has(node.id)),
    edges: data.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target))
  });
}
