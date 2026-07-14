import { readFile, writeFile } from "node:fs/promises";

const editorPath = "components/MindMapEditor.tsx";
const cssPath = "app/globals.css";

let editor = await readFile(editorPath, "utf8");

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  return source.replace(search, replacement);
}

editor = replaceOnce(
  editor,
  'import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";',
  'import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";',
  "React memo import",
);

editor = replaceOnce(
  editor,
  '  useReactFlow,\n} from "@xyflow/react";',
  '  useNodesState,\n  useReactFlow,\n} from "@xyflow/react";',
  "useNodesState import",
);

editor = replaceOnce(
  editor,
  'function MindNodeCard({ data, selected }: NodeProps<Node<MindNodeData>>) {',
  'const MindNodeCard = memo(function MindNodeCard({ data, selected }: NodeProps<Node<MindNodeData>>) {',
  "memoized node component start",
);

editor = replaceOnce(
  editor,
  '\n}\n\nfunction toFlowEdges(data: MindMapData): Edge[] {',
  '\n});\n\nfunction toFlowEdges(data: MindMapData): Edge[] {',
  "memoized node component end",
);

editor = replaceOnce(
  editor,
  '  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const { fitView } = useReactFlow();',
  '  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const draggingRef = useRef(false);\n  const { fitView } = useReactFlow();',
  "dragging ref",
);

editor = replaceOnce(
  editor,
  '  const flowNodes = useMemo<Node<MindNodeData>[]>(() => mapData.nodes.map((node) => ({',
  '  const projectedNodes = useMemo<Node<MindNodeData>[]>(() => mapData.nodes.map((node) => ({',
  "projected nodes name",
);

editor = replaceOnce(
  editor,
  '    type: "mind",\n    position: { x: node.x, y: node.y },',
  '    type: "mind",\n    selected: node.id === selectedId,\n    position: { x: node.x, y: node.y },',
  "selected state in projected nodes",
);

const projectedStart = editor.indexOf("  const projectedNodes = useMemo");
const flowEdgesMarker = "  const flowEdges = useMemo(() => toFlowEdges(mapData), [mapData]);";
const flowEdgesIndex = editor.indexOf(flowEdgesMarker, projectedStart);
if (projectedStart < 0 || flowEdgesIndex < 0) {
  throw new Error("Unable to locate projected nodes block");
}

editor = `${editor.slice(0, flowEdgesIndex)}  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<MindNodeData>>(projectedNodes);\n\n  useEffect(() => {\n    if (draggingRef.current) return;\n    setFlowNodes(projectedNodes);\n  }, [projectedNodes, setFlowNodes]);\n\n${editor.slice(flowEdgesIndex)}`;

editor = replaceOnce(
  editor,
  '          nodes={flowNodes.map((node) => ({ ...node, selected: node.id === selectedId }))}\n          edges={flowEdges}',
  '          nodes={flowNodes}\n          onNodesChange={onNodesChange}\n          edges={flowEdges}',
  "controlled nodes change handler",
);

editor = replaceOnce(
  editor,
  '          onNodeDragStop={(_, dragged) => {\n            const nextData = {',
  '          onNodeDragStart={(_, dragged) => {\n            draggingRef.current = true;\n            setSelectedId(dragged.id);\n          }}\n          onNodeDragStop={(_, dragged) => {\n            draggingRef.current = false;\n            const nextData = {',
  "drag start and stop handlers",
);

editor = replaceOnce(
  editor,
  '          selectionOnDrag={false}\n          nodesConnectable={false}',
  '          selectionOnDrag={false}\n          nodeDragThreshold={1}\n          onlyRenderVisibleElements={mapData.nodes.length > 80}\n          nodesConnectable={false}',
  "drag tuning props",
);

await writeFile(editorPath, editor);

let css = await readFile(cssPath, "utf8");
const smoothDragCss = `

/* Keep React Flow node dragging on the compositor and remove expensive visual transitions mid-drag. */
.react-flow__node {
  touch-action: none;
}

.react-flow__node.dragging {
  z-index: 120 !important;
  will-change: transform;
}

.react-flow__node.dragging .mind-node,
.react-flow__node.dragging .mind-node-selected {
  transform: none;
  transition: none;
  box-shadow: 0 5px 15px rgba(30, 45, 75, .12);
}
`;

if (!css.includes("Keep React Flow node dragging on the compositor")) {
  css += smoothDragCss;
  await writeFile(cssPath, css);
}
