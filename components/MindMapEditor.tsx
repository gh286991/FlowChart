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
  useReactFlow,
} from "@xyflow/react";
import NodeNoteCard from "@/components/NodeNoteCard";
import styles from "@/components/NodeInteraction.module.css";
import {
  addChildNode,
  autoLayoutMindMap,
  deleteNodeTree,
  type LayoutMode,
  type MindMapData,
} from "@/lib/mind-map";

export type EditorMap = {
  id: string;
  title: string;
  data: MindMapData;
};

type NoteDisplayMode = "popover" | "sidebar";

type MindNodeData = {
  nodeId: string;
  text: string;
  color: string;
  isRoot: boolean;
  side?: "left" | "right";
  note?: string;
  expanded: boolean;
  noteMode: NoteDisplayMode;
  aiOpen: boolean;
  branchContext: string[];
  onAddSibling: (nodeId: string) => void;
  onAddChild: (nodeId: string) => void;
  onRename: (nodeId: string) => void;
  onToggleNote: (nodeId: string) => void;
  onToggleAi: (nodeId: string) => void;
  onExpandNote: (nodeId: string) => void;
  onCollapseNote: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onNoteChange: (nodeId: string, markdown: string) => void;
};

function MindNodeCard({ data, selected }: NodeProps<Node<MindNodeData>>) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className={`${styles.nodeStage} ${data.isRoot ? styles.rootStage : ""} ${selected ? styles.selectedStage : ""}`}>
      {selected && (
        <div
          className={`${styles.contextToolbar} nodrag nopan nowheel`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" className={styles.contextButton} onClick={() => data.onAddSibling(data.nodeId)}>
            <span className={styles.contextIcon}>＋</span><span>同層主題</span>
          </button>
          <button type="button" className={styles.contextButton} onClick={() => data.onAddChild(data.nodeId)}>
            <span className={styles.contextIcon}>↳</span><span>子主題</span>
          </button>
          <button
            type="button"
            className={`${styles.contextButton} ${data.expanded ? styles.contextButtonActive : ""}`}
            onClick={() => data.onToggleNote(data.nodeId)}
          >
            <span className={styles.contextIcon}>▤</span><span>筆記</span>
          </button>
          <button
            type="button"
            className={`${styles.contextButton} ${data.aiOpen ? styles.contextButtonActive : ""}`}
            onClick={() => data.onToggleAi(data.nodeId)}
          >
            <span className={styles.contextIcon}>✦</span><span>AI</span>
          </button>
          <div className={styles.moreWrap}>
            <button type="button" className={styles.contextButton} onClick={() => setMoreOpen((open) => !open)}>
              <span className={styles.contextIcon}>⋯</span><span>更多</span>
            </button>
            {moreOpen && (
              <div className={styles.moreMenu}>
                <button type="button" onClick={() => { setMoreOpen(false); data.onRename(data.nodeId); }}>重新命名</button>
                {!data.isRoot && (
                  <button type="button" className={styles.dangerAction} onClick={() => { setMoreOpen(false); data.onDelete(data.nodeId); }}>
                    刪除節點
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={`mind-node ${data.isRoot ? "mind-node-root" : ""} ${selected ? "mind-node-selected" : ""}`}
        style={{ "--branch-color": data.color } as CSSProperties}
        title={data.note || data.text}
      >
        <Handle id="left-target" type="target" position={Position.Left} className="mind-handle" />
        <Handle id="left-source" type="source" position={Position.Left} className="mind-handle" />
        <div className="mind-node-text">{data.text}</div>
        {data.note && <div className={styles.noteBadge} aria-label="包含 Markdown 註解">MD</div>}
        <Handle id="right-target" type="target" position={Position.Right} className="mind-handle" />
        <Handle id="right-source" type="source" position={Position.Right} className="mind-handle" />
      </div>

      {data.expanded && (
        <NodeNoteCard
          nodeText={data.text}
          note={data.note ?? ""}
          side={data.side}
          isRoot={data.isRoot}
          branchContext={data.branchContext}
          aiOpen={data.aiOpen}
          variant={data.noteMode}
          onToggleAi={() => data.onToggleAi(data.nodeId)}
          onExpand={() => data.onExpandNote(data.nodeId)}
          onCollapse={() => data.onCollapseNote(data.nodeId)}
          onChange={(markdown) => data.onNoteChange(data.nodeId, markdown)}
          onClose={() => data.onToggleNote(data.nodeId)}
        />
      )}
    </div>
  );
}

function toFlowEdges(data: MindMapData): Edge[] {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  return data.edges.map((edge) => {
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
      style: { stroke: child?.color ?? "#64748b", strokeWidth: 2.5 },
    };
  });
}

function branchContext(data: MindMapData, nodeId: string): string[] {
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const result: string[] = [];
  let current = byId.get(nodeId);
  const visited = new Set<string>();

  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    result.unshift(parent.text);
    current = parent;
  }

  return result;
}

function EditorCanvas({ initialMap }: { initialMap: EditorMap }) {
  const [title, setTitle] = useState(initialMap.title);
  const [mapData, setMapData] = useState<MindMapData>(initialMap.data);
  const [selectedId, setSelectedId] = useState("root");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [sidebarNoteId, setSidebarNoteId] = useState<string | null>(null);
  const [aiNoteId, setAiNoteId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fitView } = useReactFlow();

  const nodeTypes = useMemo(() => ({ mind: MindNodeCard }), []);
  const selectedNode = mapData.nodes.find((node) => node.id === selectedId) ?? null;

  const save = useCallback(async (nextTitle: string, nextData: MindMapData) => {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/maps/${initialMap.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: nextTitle, data: nextData }),
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

  const closeNote = useCallback(() => {
    setExpandedNoteId(null);
    setSidebarNoteId(null);
    setAiNoteId(null);
  }, []);

  const renameNode = useCallback((nodeId: string) => {
    const target = mapData.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const nextText = window.prompt("節點名稱", target.text)?.trim();
    if (!nextText) return;
    const nextNodes = mapData.nodes.map((node) => node.id === target.id ? { ...node, text: nextText } : node);
    const nextTitle = target.id === "root" ? nextText : title;
    setTitle(nextTitle);
    updateData({ ...mapData, nodes: nextNodes }, false, nextTitle);
  }, [mapData, title, updateData]);

  const addChildFor = useCallback((nodeId: string) => {
    const next = addChildNode(mapData, nodeId, "新子主題");
    const added = next.nodes.at(-1);
    if (added) setSelectedId(added.id);
    closeNote();
    updateData(next, true);
  }, [closeNote, mapData, updateData]);

  const addSiblingFor = useCallback((nodeId: string) => {
    const target = mapData.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const parentId = target.parentId ?? target.id;
    const next = addChildNode(mapData, parentId, "新主題");
    const added = next.nodes.at(-1);
    if (added) setSelectedId(added.id);
    closeNote();
    updateData(next, true);
  }, [closeNote, mapData, updateData]);

  const removeNode = useCallback((nodeId: string) => {
    const target = mapData.nodes.find((node) => node.id === nodeId);
    if (!target || nodeId === "root") return;
    const next = deleteNodeTree(mapData, nodeId);
    setSelectedId(target.parentId ?? "root");
    if (expandedNoteId === nodeId) closeNote();
    updateData(next, true);
  }, [closeNote, expandedNoteId, mapData, updateData]);

  const toggleNote = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setExpandedNoteId((current) => {
      if (current === nodeId) {
        setSidebarNoteId(null);
        setAiNoteId(null);
        return null;
      }
      setSidebarNoteId(null);
      setAiNoteId(null);
      return nodeId;
    });
  }, []);

  const toggleAi = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setExpandedNoteId(nodeId);
    setAiNoteId((current) => current === nodeId ? null : nodeId);
  }, []);

  const expandNote = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setExpandedNoteId(nodeId);
    setSidebarNoteId(nodeId);
  }, []);

  const collapseNote = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setExpandedNoteId(nodeId);
    setSidebarNoteId(null);
  }, []);

  const updateNodeNote = useCallback((nodeId: string, markdown: string) => {
    const next = {
      ...mapData,
      nodes: mapData.nodes.map((node) => node.id === nodeId
        ? { ...node, ...(markdown ? { note: markdown } : { note: undefined }) }
        : node),
    };
    updateData(next);
  }, [mapData, updateData]);

  const flowNodes = useMemo<Node<MindNodeData>[]>(() => mapData.nodes.map((node) => ({
    id: node.id,
    type: "mind",
    position: { x: node.x, y: node.y },
    draggable: sidebarNoteId === null,
    zIndex: node.id === expandedNoteId ? 80 : node.id === selectedId ? 30 : 1,
    data: {
      nodeId: node.id,
      text: node.text,
      color: node.color,
      isRoot: node.parentId === null,
      side: node.side,
      note: node.note,
      expanded: expandedNoteId === node.id,
      noteMode: sidebarNoteId === node.id ? "sidebar" : "popover",
      aiOpen: aiNoteId === node.id,
      branchContext: branchContext(mapData, node.id),
      onAddSibling: addSiblingFor,
      onAddChild: addChildFor,
      onRename: renameNode,
      onToggleNote: toggleNote,
      onToggleAi: toggleAi,
      onExpandNote: expandNote,
      onCollapseNote: collapseNote,
      onDelete: removeNode,
      onNoteChange: updateNodeNote,
    },
  })), [
    addChildFor,
    addSiblingFor,
    aiNoteId,
    collapseNote,
    expandNote,
    expandedNoteId,
    mapData,
    removeNode,
    renameNode,
    selectedId,
    sidebarNoteId,
    toggleAi,
    toggleNote,
    updateNodeNote,
  ]);
  const flowEdges = useMemo(() => toFlowEdges(mapData), [mapData]);

  const arrange = useCallback((layoutMode = mapData.layoutMode) => {
    const next = autoLayoutMindMap({ ...mapData, layoutMode });
    updateData(next, true);
  }, [mapData, updateData]);

  const changeLayout = (layoutMode: LayoutMode) => arrange(layoutMode);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, button, [contenteditable='true']")) return;
      if (event.key === "Escape" && expandedNoteId) {
        event.preventDefault();
        closeNote();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        addChildFor(selectedNode?.id ?? "root");
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNode?.id && selectedNode.id !== "root") {
        event.preventDefault();
        removeNode(selectedNode.id);
      }
      if (event.key === "Enter" && selectedNode?.id) {
        event.preventDefault();
        renameNode(selectedNode.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addChildFor, closeNote, expandedNoteId, removeNode, renameNode, selectedNode]);

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    const nextData = {
      ...mapData,
      nodes: mapData.nodes.map((node) => node.id === "root" ? { ...node, text: nextTitle || "未命名心智圖" } : node),
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
          onChange={(event) => handleTitleChange(event.target.value)}
          aria-label="心智圖名稱"
        />
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

      <div className="editor-help">筆記會浮在節點上方，不會改動畫布；內容較多時可展開成右側欄。Esc 可關閉筆記。</div>

      <main className="editor-canvas">
        <ReactFlow
          nodes={flowNodes.map((node) => ({ ...node, selected: node.id === selectedId }))}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId("")}
          onNodeDoubleClick={(_, node) => {
            setSelectedId(node.id);
            renameNode(node.id);
          }}
          onNodeDragStop={(_, dragged) => {
            const nextData = {
              ...mapData,
              nodes: mapData.nodes.map((node) => node.id === dragged.id
                ? { ...node, x: dragged.position.x, y: dragged.position.y }
                : node),
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
          <MiniMap pannable zoomable nodeColor={(node) => (node.data as MindNodeData).color} />
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
