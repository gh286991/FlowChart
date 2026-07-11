"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useReactFlow
} from "@xyflow/react";
import {
  addChildNode,
  autoLayoutMindMap,
  deleteNodeTree,
  type LayoutMode,
  type MindMapData
} from "@/lib/mind-map";

export type EditorMap = {
  id: string;
  title: string;
  data: MindMapData;
};

type MindNodeData = {
  text: string;
  color: string;
  isRoot: boolean;
  side?: "left" | "right";
};

function MindNodeCard({ data, selected }: NodeProps<Node<MindNodeData>>) {
  return (
    <div
      className={`mind-node ${data.isRoot ? "mind-node-root" : ""} ${selected ? "mind-node-selected" : ""}`}
      style={{ "--branch-color": data.color } as CSSProperties}
    >
      <Handle id="left-target" type="target" position={Position.Left} className="mind-handle" />
      <Handle id="left-source" type="source" position={Position.Left} className="mind-handle" />
      <div className="mind-node-text">{data.text}</div>
      <Handle id="right-target" type="target" position={Position.Right} className="mind-handle" />
      <Handle id="right-source" type="source" position={Position.Right} className="mind-handle" />
    </div>
  );
}

function toFlowNodes(data: MindMapData): Node<MindNodeData>[] {
  return data.nodes.map(node => ({
    id: node.id,
    type: "mind",
    position: { x: node.x, y: node.y },
    data: {
      text: node.text,
      color: node.color,
      isRoot: node.parentId === null,
      side: node.side
    }
  }));
}

function toFlowEdges(data: MindMapData): Edge[] {
  const nodeById = new Map(data.nodes.map(node => [node.id, node]));
  return data.edges.map(edge => {
    const child = nodeById.get(edge.target);
    const left = child?.side === "left";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: left ? "left-source" : "right-source",
      targetHandle: left ? "right-target" : "left-target",
      type: "smoothstep",
      animated: false,
      style: { stroke: child?.color ?? "#64748b", strokeWidth: 2.5 }
    };
  });
}

function EditorCanvas({ initialMap }: { initialMap: EditorMap }) {
  const [title, setTitle] = useState(initialMap.title);
  const [mapData, setMapData] = useState<MindMapData>(initialMap.data);
  const [selectedId, setSelectedId] = useState("root");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fitView } = useReactFlow();

  const nodeTypes = useMemo(() => ({ mind: MindNodeCard }), []);
  const flowNodes = useMemo(() => toFlowNodes(mapData), [mapData]);
  const flowEdges = useMemo(() => toFlowEdges(mapData), [mapData]);
  const selectedNode = mapData.nodes.find(node => node.id === selectedId) ?? mapData.nodes[0];

  const save = useCallback(async (nextTitle: string, nextData: MindMapData) => {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/maps/${initialMap.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: nextTitle, data: nextData })
      });
      if (!response.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [initialMap.id]);

  const queueSave = useCallback((nextTitle: string, nextData: MindMapData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(nextTitle, nextData), 650);
  }, [save]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const updateData = useCallback((nextData: MindMapData, shouldFit = false, nextTitle = title) => {
    setMapData(nextData);
    queueSave(nextTitle, nextData);
    if (shouldFit) setTimeout(() => void fitView({ padding: 0.25, duration: 350 }), 40);
  }, [fitView, queueSave, title]);

  const renameNode = useCallback((nodeId: string) => {
    const target = mapData.nodes.find(node => node.id === nodeId);
    if (!target) return;
    const nextText = window.prompt("節點名稱", target.text)?.trim();
    if (!nextText) return;
    const nextNodes = mapData.nodes.map(node => node.id === target.id ? { ...node, text: nextText } : node);
    const nextTitle = target.id === "root" ? nextText : title;
    setTitle(nextTitle);
    updateData({ ...mapData, nodes: nextNodes }, false, nextTitle);
  }, [mapData, title, updateData]);

  const renameSelected = useCallback(() => {
    if (selectedNode) renameNode(selectedNode.id);
  }, [renameNode, selectedNode]);

  const addChild = useCallback(() => {
    const parentId = selectedNode?.id ?? "root";
    const next = addChildNode(mapData, parentId, "新節點");
    const newNode = next.nodes.at(-1);
    if (newNode) setSelectedId(newNode.id);
    updateData(next, true);
  }, [mapData, selectedNode, updateData]);

  const removeSelected = useCallback(() => {
    if (!selectedNode || selectedNode.id === "root") return;
    const parentId = selectedNode.parentId ?? "root";
    const next = deleteNodeTree(mapData, selectedNode.id);
    setSelectedId(parentId);
    updateData(next, true);
  }, [mapData, selectedNode, updateData]);

  const arrange = useCallback((layoutMode = mapData.layoutMode) => {
    const next = autoLayoutMindMap({ ...mapData, layoutMode });
    updateData(next, true);
  }, [mapData, updateData]);

  const changeLayout = (layoutMode: LayoutMode) => arrange(layoutMode);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "Tab") {
        event.preventDefault();
        addChild();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelected();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        renameSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addChild, removeSelected, renameSelected]);

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    const nextData = {
      ...mapData,
      nodes: mapData.nodes.map(node => node.id === "root" ? { ...node, text: nextTitle || "未命名心智圖" } : node)
    };
    setMapData(nextData);
    queueSave(nextTitle || "未命名心智圖", nextData);
  };

  return (
    <div className="editor-shell">
      <header className="editor-toolbar">
        <Link href="/dashboard" className="button button-ghost">← 全部心智圖</Link>
        <input
          className="editor-title"
          value={title}
          onChange={event => handleTitleChange(event.target.value)}
          aria-label="心智圖名稱"
        />
        <div className="toolbar-group">
          <button className="button" onClick={addChild}>＋ 子節點</button>
          <button className="button" onClick={renameSelected}>重新命名</button>
          <button className="button button-danger" onClick={removeSelected} disabled={selectedId === "root"}>刪除</button>
        </div>
        <div className="toolbar-group">
          <button className={`button ${mapData.layoutMode === "both" ? "button-active" : ""}`} onClick={() => changeLayout("both")}>雙向</button>
          <button className={`button ${mapData.layoutMode === "right" ? "button-active" : ""}`} onClick={() => changeLayout("right")}>向右</button>
          <button className={`button ${mapData.layoutMode === "left" ? "button-active" : ""}`} onClick={() => changeLayout("left")}>向左</button>
          <button className="button button-primary" onClick={() => arrange()}>自動排列</button>
        </div>
        <span className={`save-state save-${saveState}`}>
          {saveState === "saving" ? "儲存中…" : saveState === "error" ? "儲存失敗" : "已儲存"}
        </span>
      </header>

      <div className="editor-help">選取節點後：Tab 新增、Enter 改名、Delete 刪除。可拖曳節點與畫布，滾輪縮放。</div>

      <main className="editor-canvas">
        <ReactFlow
          nodes={flowNodes.map(node => ({ ...node, selected: node.id === selectedId }))}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onNodeDoubleClick={(_, node) => {
            setSelectedId(node.id);
            renameNode(node.id);
          }}
          onNodeDragStop={(_, dragged) => {
            const nextData = {
              ...mapData,
              nodes: mapData.nodes.map(node => node.id === dragged.id ? { ...node, x: dragged.position.x, y: dragged.position.y } : node)
            };
            updateData(nextData);
          }}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2}
          panOnDrag
          selectionOnDrag={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <MiniMap pannable zoomable nodeColor={node => (node.data as MindNodeData).color} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </main>
    </div>
  );
}

export default function MindMapEditor({ initialMap }: { initialMap: EditorMap }) {
  return (
    <ReactFlowProvider>
      <EditorCanvas initialMap={initialMap} />
    </ReactFlowProvider>
  );
}
