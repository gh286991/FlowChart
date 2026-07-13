import { autoLayoutMindMap, type MindMapData, type MindNode } from "./mind-map";

const NOTE_VERTICAL_SPACE = 360;
const NOTE_HORIZONTAL_SPACE = 220;

function nodeDepth(node: MindNode, byId: Map<string, MindNode>): number {
  let depth = 0;
  let current: MindNode | undefined = node;
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

function topBranch(node: MindNode, byId: Map<string, MindNode>): MindNode {
  let current = node;
  const visited = new Set<string>();
  while (current.parentId && current.parentId !== "root" && !visited.has(current.id)) {
    visited.add(current.id);
    current = byId.get(current.parentId) ?? current;
  }
  return current;
}

/**
 * Creates a temporary display layout that opens enough room around expanded
 * note cards without persisting those UI-only offsets to the mind map.
 */
export function layoutMindMapForExpandedNotes(
  input: MindMapData,
  expandedNodeIds: Iterable<string>,
): MindMapData {
  const arranged = autoLayoutMindMap(input);
  const expanded = [...expandedNodeIds];
  if (!expanded.length) return arranged;

  const nodes = arranged.nodes.map((node) => ({ ...node }));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const expandedId of expanded) {
    const anchor = byId.get(expandedId);
    if (!anchor) continue;

    const anchorDepth = nodeDepth(anchor, byId);
    const anchorBranch = topBranch(anchor, byId).id;
    const anchorSide = anchor.side ?? "right";

    for (const node of nodes) {
      if (node.id === anchor.id) continue;

      // Open a full-width vertical lane beneath the expanded note card.
      if (node.y > anchor.y + 1) {
        node.y += NOTE_VERTICAL_SPACE;
      } else if (anchor.parentId === null && node.y <= anchor.y) {
        node.y -= NOTE_VERTICAL_SPACE / 2;
      }

      // Push deeper descendants on the same branch away from the wider card.
      const sameBranch = topBranch(node, byId).id === anchorBranch;
      if (sameBranch && nodeDepth(node, byId) > anchorDepth) {
        node.x += (anchorSide === "left" ? -1 : 1) * NOTE_HORIZONTAL_SPACE;
      }
    }
  }

  return { ...arranged, nodes };
}
