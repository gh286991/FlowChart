from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Missing patch target: {label}")
    return source.replace(old, new, 1)


editor_path = Path("components/MindMapEditor.tsx")
note_path = Path("components/NodeNoteCard.tsx")

editor = editor_path.read_text()
editor = replace_once(
    editor,
    'type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";',
    'type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";',
    "mouse event import",
)
editor = replace_once(
    editor,
    '  function openMenuFromButton(event: ReactPointerEvent<HTMLButtonElement>) {',
    '  function openMenuFromButton(event: ReactMouseEvent<HTMLButtonElement>) {',
    "menu button mouse event",
)
editor = replace_once(
    editor,
    '            onPointerDown={openMenuFromButton}\n            aria-label={`開啟 ${data.text} 的節點操作`}\n            title="更多節點操作"',
    '            onPointerDown={(event) => event.stopPropagation()}\n            onClick={openMenuFromButton}\n            aria-haspopup="menu"\n            aria-expanded={Boolean(menuAnchor)}\n            aria-label={`開啟 ${data.text} 的節點操作`}\n            title="更多節點操作"',
    "accessible menu trigger",
)
editor_path.write_text(editor)

note = note_path.read_text()
old_effect = '''  useEffect(() => {
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
  }, [canDragNote, floatingPosition, variant]);'''
new_effect = '''  useEffect(() => {
    if (!canDragNote || variant !== "popover") return;
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
  }, [canDragNote, variant]);'''
note = replace_once(note, old_effect, new_effect, "stable resize listener")
note_path.write_text(note)

Path("scripts/refine-draggable-note-menu.py").unlink(missing_ok=True)
Path(".github/workflows/refine-draggable-note-menu-temp.yml").unlink(missing_ok=True)
