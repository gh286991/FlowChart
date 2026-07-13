import {
  addChildNode,
  autoLayoutMindMap,
  type LayoutMode,
  type MindMapData,
} from "@/lib/mind-map";

export type MapAiOperation =
  | { type: "add"; parentId: string; text: string }
  | { type: "rename"; nodeId: string; text: string }
  | { type: "move"; nodeId: string; parentId: string }
  | { type: "reorder"; parentId: string; orderedNodeIds: string[] }
  | { type: "layout"; layoutMode: LayoutMode };

export type MapStructureNode = {
  id: string;
  parentId: string | null;
  text: string;
  side?: "left" | "right";
};

export function toMapStructure(data: MindMapData): {
  layoutMode: LayoutMode;
  nodes: MapStructureNode[];
} {
  return {
    layoutMode: data.layoutMode,
    nodes: data.nodes.map(({ id, parentId, text, side }) => ({
      id,
      parentId,
      text,
      ...(side ? { side } : {}),
    })),
  };
}

function createsCycle(data: MindMapData, nodeId: string, nextParentId: string): boolean {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  let current = byId.get(nextParentId);
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    if (current.id === nodeId) return true;
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function moveNode(data: MindMapData, nodeId: string, parentId: string): MindMapData {
  if (nodeId === "root" || nodeId === parentId) return data;
  if (!data.nodes.some((node) => node.id === nodeId)) return data;
  if (!data.nodes.some((node) => node.id === parentId)) return data;
  if (createsCycle(data, nodeId, parentId)) return data;

  const parent = data.nodes.find((node) => node.id === parentId)!;
  const nodes = data.nodes.map((node) => node.id === nodeId
    ? {
        ...node,
        parentId,
        color: parentId === "root" ? node.color : parent.color,
        side: parent.side ?? node.side,
      }
    : node);
  const edges = [
    ...data.edges.filter((edge) => edge.target !== nodeId),
    { id: `edge-${parentId}-${nodeId}`, source: parentId, target: nodeId },
  ];
  return { ...data, nodes, edges };
}

function reorderChildren(data: MindMapData, parentId: string, orderedNodeIds: string[]): MindMapData {
  const children = data.nodes.filter((node) => node.parentId === parentId);
  if (!children.length) return data;

  const childIds = new Set(children.map((node) => node.id));
  const order = [
    ...orderedNodeIds.filter((id) => childIds.has(id)),
    ...children.map((node) => node.id).filter((id) => !orderedNodeIds.includes(id)),
  ];
  const rank = new Map(order.map((id, index) => [id, index]));
  const childSlots = data.nodes
    .map((node, index) => node.parentId === parentId ? index : -1)
    .filter((index) => index >= 0);
  const sortedChildren = [...children].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
  const nodes = [...data.nodes];
  childSlots.forEach((slot, index) => {
    nodes[slot] = sortedChildren[index];
  });
  return { ...data, nodes };
}

export function applyMapAiOperations(data: MindMapData, operations: MapAiOperation[]): MindMapData {
  let next = data;

  for (const operation of operations.slice(0, 40)) {
    if (operation.type === "layout") {
      next = { ...next, layoutMode: operation.layoutMode };
      continue;
    }

    if (operation.type === "add") {
      if (!operation.text.trim() || !next.nodes.some((node) => node.id === operation.parentId)) continue;
      next = addChildNode(next, operation.parentId, operation.text.trim().slice(0, 160));
      continue;
    }

    if (operation.type === "rename") {
      if (!operation.text.trim()) continue;
      next = {
        ...next,
        nodes: next.nodes.map((node) => node.id === operation.nodeId
          ? { ...node, text: operation.text.trim().slice(0, 160) }
          : node),
      };
      continue;
    }

    if (operation.type === "move") {
      next = moveNode(next, operation.nodeId, operation.parentId);
      continue;
    }

    next = reorderChildren(next, operation.parentId, operation.orderedNodeIds);
  }

  return autoLayoutMindMap(next);
}
