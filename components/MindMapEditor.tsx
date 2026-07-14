"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
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
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import MapAiPanel from "@/components/MapAiPanel";
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
  onSelect: (nodeId: string) => void;
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

type NodeMenuAnchor = {
  x: number;
  y: number;
};

const MindNodeCard = memo(function MindNodeCard({ data, selected }: NodeProps<Node<MindNodeData>>) {
  const [menuAnchor, setMenuAnchor] = useState<NodeMenuAnchor | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    if (!selected) setMenuAnchor(null);
  }, [selected]);

  useEffect(() => {
    if (!menuAnchor) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as HTMLElement)) return;
      setMenuAnchor(null);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAnchor(null);
    };
    window.addEventListener("pointerdown", closeFromOutside);
    window.addEventListener("keydown", closeFromEscape);
    return () => {
      window.removeEventListener("pointerdown", closeFromOutside);
      window.removeEventListener("keydown", closeFromEscape);
    };
  }, [menuAnchor]);

  useEffect(() => () => {
    if (longPressRef.current) clearTimeout(longPressRef.current.timer);
  }, []);

  function openMenuAt(x: number, y: number) {
    data.onSelect(data.nodeId);
    const menuWidth = 236;
    const menuHeight = 356;
    setMenuAnchor({
      x: Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12)),
    });
  }

  function openMenuFromButton(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = data.side === "left" ? rect.left - 228 : rect.right + 8;
    openMenuAt(x, rect.top);
  }

  function clearLongPress() {
    if (!longPressRef.current) return;
    clearTimeout(longPressRef.current.timer);
    longPressRef.current = null;
  }

  function startLongPress(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || event.button !== 0) return;
    clearLongPress();
    const x = event.clientX;
    const y = event.clientY;
    const pointerId = event.pointerId;
    const timer = setTimeout(() => {
      openMenuAt(x, y);
      longPressRef.current = null;
    }, 520);
    longPressRef.current = { timer, x, y, pointerId };
  }

  function moveLongPress(event: ReactPointerEvent<HTMLDivElement>) {
    const pending = longPressRef.current;
    if (!pending || pending.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - pending.x) > 10 || Math.abs(event.clientY - pending.y) > 10) {
      clearLongPress();
    }
  }

  function runMenuAction(action: () => void) {
    setMenuAnchor(null);
    action();
  }

  const menu = menuAnchor && typeof document !== "undefined" ? createPortal(
    <>
      <button
        type="button"
        className={styles.nodeMenuBackdrop}
        aria-label="關閉節點選單"
        onClick={() => setMenuAnchor(null)}
      />
      <div
        ref={menuRef}
        className={`${styles.nodeMenu} nodrag nopan nowheel`}
        style={{ left: menuAnchor.x, top: menuAnchor.y }}
        role="menu"
        aria-label={`${data.text} 的節點操作`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={styles.nodeMenuHeader}>
          <span>節點操作</span>
          <strong title={data.text}>{data.text}</strong>
        </div>
        <div className={styles.nodeMenuGrid}>
          <button type="button" role="menuitem" onClick={() => runMenuAction(() => data.onAddSibling(data.nodeId))}>
            <span>＋</span><strong>同層主題</strong><small>新增在相同層級</small>
          </button>
          <button type="button" role="menuitem" onClick={() => runMenuAction(() => data.onAddChild(data.nodeId))}>
            <span>↳</span><strong>子主題</strong><small>建立下一層節點</small>
          </button>
          <button type="button" role="menuitem" onClick={() => runMenuAction(() => data.onToggleNote(data.nodeId))}>
            <span>▤</span><strong>筆記</strong><small>Markdown 與圖片</small>
          </button>
          <button type="button" role="menuitem" onClick={() => runMenuAction(() => data.onToggleAi(data.nodeId))}>
            <span>✦</span><strong>節點 AI</strong><small>只修改目前節點</small>
          </button>
        </div>
        <div className={styles.nodeMenuSecondary}>
          <button type="button" role="menuitem" onClick={() => runMenuAction(() => data.onRename(data.nodeId))}>重新命名</button>
          {!data.isRoot && (
            <button type="button" role="menuitem" className={styles.nodeMenuDanger} onClick={() => runMenuAction(() => data.onDelete(data.nodeId))}>
              刪除節點
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <div className={`${styles.nodeStage} ${data.isRoot ? styles.rootStage : ""} ${selected ? styles.selectedStage : ""}`}>
      <div
        className={`mind-node ${data.isRoot ? "mind-node-root" : ""} ${selected ? "mind-node-selected" : ""}`}
        style={{ "--branch-color": data.color } as CSSProperties}
        title={data.note || data.text}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openMenuAt(event.clientX, event.clientY);
        }}
        onPointerDown={startLongPress}
        onPointerMove={moveLongPress}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
      >
        <Handle id="left-target" type="target" position={Position.Left} className="mind-handle" />
        <Handle id="left-source" type="source" position={Position.Left} className="mind-handle" />
        <div className="mind-node-text">{data.text}</div>
        {data.note && <div className={styles.noteBadge} aria-label="包含 Markdown 註解">MD</div>}
        <Handle id="right-target" type="target" position={Position.Right} className="mind-handle" />
        <Handle id="right-source" type="source" position={Position.Right} className="mind-handle" />
      </div>

      {selected && (
        <>
          <button
            type="button"
            className={`${styles.nodeQuickAdd} ${data.side === "left" ? styles.nodeQuickAddLeft : styles.nodeQuickAddRight} nodrag nopan`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              data.onAddChild(data.nodeId);
            }}
            aria-label={`在 ${data.text} 下新增子主題`}
            title="新增子主題"
          >
            ＋
          </button>
          <button
            type="button"
            className={`${styles.nodeMoreTrigger} nodrag nopan`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={openMenuFromButton}
            aria-haspopup="menu"
            aria-expanded={Boolean(menuAnchor)}
            aria-label={`開啟 ${data.text} 的節點操作`}
            title="更多節點操作"
          >
            ⋯
          </button>
        </>
      )}

      {data.expanded && (
        <NodeNoteCard
          nodeId={data.nodeId}
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
      {menu}
    </div>
  );
});

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
  const [mapAiOpen, setMapAiOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
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
    setMapAiOpen(false);
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
    setMapAiOpen(false);
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

  const applyWholeMap = useCallback((next: MindMapData) => {
    const nextTitle = next.nodes.find((node) => node.id === "root")?.text || title;
    setTitle(nextTitle);
    updateData(next, true, nextTitle);
  }, [title, updateData]);

  const projectedNodes = useMemo<Node<MindNodeData>[]>(() => mapData.nodes.map((node) => ({
    id: node.id,
    type: "mind",
    selected: node.id === selectedId,
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
      onSelect: setSelectedId,
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
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<MindNodeData>>(projectedNodes);

  useEffect(() => {
    if (draggingRef.current) return;
    setFlowNodes(projectedNodes);
  }, [projectedNodes, setFlowNodes]);

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
      if (event.key === "Escape" && (expandedNoteId || mapAiOpen)) {
        event.preventDefault();
        closeNote();
        setMapAiOpen(false);
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
  }, [addChildFor, closeNote, expandedNoteId, mapAiOpen, removeNode, renameNode, selectedNode]);

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
        <button
          type="button"
          className={`button global-ai-trigger ${mapAiOpen ? "button-active" : ""}`}
          onClick={() => {
            closeNote();
            setMapAiOpen((open) => !open);
          }}
        >
          ✦ 整體 AI
        </button>
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

      <div className="editor-help">節點 AI 只處理目前節點；整體 AI 只讀節點名稱與結構，可預覽新增、移動與排序。</div>

      <main className="editor-canvas">
        <ReactFlow
          nodes={flowNodes}
          onNodesChange={onNodesChange}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId("")}
          onNodeDoubleClick={(_, node) => {
            setSelectedId(node.id);
            renameNode(node.id);
          }}
          onNodeDragStart={(_, dragged) => {
            draggingRef.current = true;
            setSelectedId(dragged.id);
          }}
          onNodeDragStop={(_, dragged) => {
            draggingRef.current = false;
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
          nodeDragThreshold={1}
          onlyRenderVisibleElements={mapData.nodes.length > 80}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} />
          <MiniMap pannable zoomable nodeColor={(node) => (node.data as MindNodeData).color} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </main>

      <MapAiPanel
        open={mapAiOpen}
        data={mapData}
        onClose={() => setMapAiOpen(false)}
        onApply={applyWholeMap}
      />
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
