from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Missing patch target: {label}")
    return source.replace(old, new, 1)


editor_path = Path("components/MindMapEditor.tsx")
note_path = Path("components/NodeNoteCard.tsx")
css_path = Path("components/NodeInteraction.module.css")

editor = editor_path.read_text()
editor = replace_once(
    editor,
    'import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";\nimport Link from "next/link";',
    'import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";\nimport Link from "next/link";\nimport { createPortal } from "react-dom";',
    "editor imports",
)
editor = replace_once(
    editor,
    '  branchContext: string[];\n  onAddSibling: (nodeId: string) => void;',
    '  branchContext: string[];\n  onSelect: (nodeId: string) => void;\n  onAddSibling: (nodeId: string) => void;',
    "node select callback type",
)

start = editor.index("const MindNodeCard = memo(function MindNodeCard")
end = editor.index("\n\nfunction toFlowEdges", start)
new_node_block = r'''type NodeMenuAnchor = {
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

  function openMenuFromButton(event: ReactPointerEvent<HTMLButtonElement>) {
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
            onPointerDown={openMenuFromButton}
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
});'''
editor = editor[:start] + new_node_block + editor[end:]
editor = replace_once(
    editor,
    '      branchContext: branchContext(mapData, node.id),\n      onAddSibling: addSiblingFor,',
    '      branchContext: branchContext(mapData, node.id),\n      onSelect: setSelectedId,\n      onAddSibling: addSiblingFor,',
    "projected node select callback",
)
editor_path.write_text(editor)

note = note_path.read_text()
note = replace_once(
    note,
    '  type ClipboardEvent,\n  type ReactNode,',
    '  type ClipboardEvent,\n  type PointerEvent as ReactPointerEvent,\n  type ReactNode,',
    "note pointer type import",
)
note = replace_once(
    note,
    'type ChatMessage = {\n  id: string;\n  role: "user" | "assistant";\n  content: string;\n  candidate?: string;\n};',
    'type ChatMessage = {\n  id: string;\n  role: "user" | "assistant";\n  content: string;\n  candidate?: string;\n};\n\ntype FloatingPoint = {\n  x: number;\n  y: number;\n};',
    "floating point type",
)
note = replace_once(
    note,
    '  const [error, setError] = useState("");\n  const [mounted, setMounted] = useState(false);\n  const textareaRef = useRef<HTMLTextAreaElement | null>(null);',
    '  const [error, setError] = useState("");\n  const [mounted, setMounted] = useState(false);\n  const [canDragNote, setCanDragNote] = useState(false);\n  const [floatingPosition, setFloatingPosition] = useState<FloatingPoint | null>(null);\n  const cardRef = useRef<HTMLElement | null>(null);\n  const dragRef = useRef<{\n    pointerId: number;\n    startX: number;\n    startY: number;\n    originX: number;\n    originY: number;\n  } | null>(null);\n  const textareaRef = useRef<HTMLTextAreaElement | null>(null);',
    "note drag state",
)
mounted_effect = '''  useEffect(() => {
    setMounted(true);
    return () => {
      requestSequenceRef.current += 1;
      abortRef.current?.abort();
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);'''
note = replace_once(
    note,
    mounted_effect,
    mounted_effect + '''

  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const update = () => setCanDragNote(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!floatingPosition || !canDragNote || variant !== "popover") return;
    const clampToViewport = () => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      setFloatingPosition((current) => current ? {
        x: Math.max(8, Math.min(current.x, window.innerWidth - rect.width - 8)),
        y: Math.max(70, Math.min(current.y, window.innerHeight - rect.height - 8)),
      } : current);
    };
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, [canDragNote, floatingPosition, variant]);''',
    "mounted effect and desktop media",
)
note = replace_once(
    note,
    '    setDraft(note);\n    setChatInput("");',
    '    setDraft(note);\n    setFloatingPosition(null);\n    setChatInput("");',
    "reset note position on node change",
)

drag_functions = r'''
  function startNoteDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canDragNote || variant !== "popover" || event.button !== 0) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveNoteDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const card = cardRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !card) return;
    const rect = card.getBoundingClientRect();
    const nextX = drag.originX + event.clientX - drag.startX;
    const nextY = drag.originY + event.clientY - drag.startY;
    setFloatingPosition({
      x: Math.max(8, Math.min(nextX, window.innerWidth - rect.width - 8)),
      y: Math.max(70, Math.min(nextY, window.innerHeight - rect.height - 8)),
    });
  }

  function endNoteDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
'''
note = replace_once(
    note,
    '  const card = (\n',
    drag_functions + '\n  const card = (\n',
    "note drag handlers",
)
note = replace_once(
    note,
    '    <section\n      className={`${styles.noteCard} ${variant === "sidebar" ? styles.noteSidebar : styles.notePopover} nodrag nopan nowheel`}\n      onClick={(event) => event.stopPropagation()}',
    '    <section\n      ref={cardRef}\n      className={`${styles.noteCard} ${variant === "sidebar" ? styles.noteSidebar : styles.notePopover} nodrag nopan nowheel`}\n      style={canDragNote && variant === "popover" && floatingPosition ? { left: floatingPosition.x, top: floatingPosition.y, right: "auto", bottom: "auto" } : undefined}\n      onClick={(event) => event.stopPropagation()}',
    "note card ref and position",
)
note = replace_once(
    note,
    '      <header className={styles.noteHeader}>\n        <strong title={nodeText}>註解 · {nodeText}</strong>',
    '      <header className={styles.noteHeader}>\n        <div\n          className={styles.noteDragHandle}\n          onPointerDown={startNoteDrag}\n          onPointerMove={moveNoteDrag}\n          onPointerUp={endNoteDrag}\n          onPointerCancel={endNoteDrag}\n          title={canDragNote && variant === "popover" ? "拖曳移動筆記視窗" : undefined}\n        >\n          <span className={styles.noteDragGrip} aria-hidden="true">⠿</span>\n          <strong title={nodeText}>註解 · {nodeText}</strong>\n        </div>',
    "draggable note header",
)
note_path.write_text(note)

css = css_path.read_text()
css += r'''

/* Compact node actions: selection stays quiet until the user asks for actions. */
.nodeQuickAdd,
.nodeMoreTrigger {
  position: absolute;
  z-index: 120;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid #c9d3e4;
  border-radius: 999px;
  background: rgba(255, 255, 255, .98);
  color: #3c4b67;
  box-shadow: 0 8px 20px rgba(31, 42, 68, .18);
  font-weight: 900;
  line-height: 1;
}

.nodeQuickAdd:hover,
.nodeMoreTrigger:hover {
  border-color: #8fa2ff;
  background: #eef2ff;
  color: #3046c0;
}

.nodeQuickAdd {
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
}

.nodeQuickAddRight { right: -17px; }
.nodeQuickAddLeft { left: -17px; }

.nodeMoreTrigger {
  top: -13px;
  right: -13px;
  font-size: 18px;
}

.nodeMenuBackdrop {
  position: fixed;
  inset: 0;
  z-index: 720;
  border: 0;
  background: transparent;
}

.nodeMenu {
  position: fixed;
  z-index: 730;
  width: 224px;
  overflow: hidden;
  border: 1px solid #d4dcea;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 68px rgba(31, 42, 68, .26);
  color: #172033;
}

.nodeMenuHeader {
  display: grid;
  gap: 2px;
  padding: 11px 12px 9px;
  border-bottom: 1px solid #e6eaf2;
  background: #f8faff;
}

.nodeMenuHeader span {
  color: #7a8498;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.nodeMenuHeader strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.nodeMenuGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 8px;
}

.nodeMenuGrid button {
  min-height: 78px;
  display: grid;
  grid-template-columns: 24px 1fr;
  align-content: center;
  gap: 2px 6px;
  padding: 9px;
  border: 1px solid #e1e6ef;
  border-radius: 10px;
  background: #fff;
  color: #344054;
  text-align: left;
}

.nodeMenuGrid button:hover {
  border-color: #aebcff;
  background: #f3f5ff;
}

.nodeMenuGrid button > span {
  grid-row: 1 / span 2;
  align-self: center;
  color: #4055cb;
  font-size: 20px;
  font-weight: 900;
}

.nodeMenuGrid button strong { font-size: 11px; }
.nodeMenuGrid button small { color: #7a8498; font-size: 9px; line-height: 1.3; }

.nodeMenuSecondary {
  display: grid;
  gap: 2px;
  padding: 4px 8px 8px;
  border-top: 1px solid #eef1f5;
}

.nodeMenuSecondary button {
  min-height: 36px;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475467;
  text-align: left;
  font-size: 11px;
  font-weight: 800;
}

.nodeMenuSecondary button:hover { background: #f2f5fa; }
.nodeMenuSecondary .nodeMenuDanger { color: #c9364f; }

.noteDragHandle {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.noteDragHandle:active { cursor: grabbing; }

.noteDragGrip {
  flex: 0 0 auto;
  color: #99a4b8;
  font-size: 16px;
  line-height: 1;
}

.noteDragHandle strong {
  min-width: 0;
  flex: 1;
}

@media (max-width: 760px) {
  .nodeMenuBackdrop { background: rgba(16, 24, 40, .38); }

  .nodeMenu {
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: 0 !important;
    width: 100vw;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 20px 20px 0 0;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    box-shadow: 0 -18px 55px rgba(16, 24, 40, .25);
  }

  .nodeMenuHeader { padding: 14px 16px 11px; }
  .nodeMenuGrid { gap: 8px; padding: 10px 12px; }
  .nodeMenuGrid button { min-height: 82px; }
  .nodeMenuSecondary { padding: 5px 12px 8px; }
  .nodeMenuSecondary button { min-height: 44px; }

  .nodeQuickAdd,
  .nodeMoreTrigger {
    width: 34px;
    height: 34px;
  }

  .noteDragHandle {
    cursor: default;
    touch-action: auto;
  }

  .noteDragGrip { display: none; }
}
'''
css_path.write_text(css)

Path("scripts/apply-draggable-notes-context-menu.py").unlink(missing_ok=True)
Path(".github/workflows/apply-draggable-notes-context-menu-temp.yml").unlink(missing_ok=True)
