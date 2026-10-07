import { ELEMENT_ICONS } from "./elementIcons";
import { PanelHeader } from "./ui";
import { useEffect, useRef, useState } from "react";
import {
  Layers,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  LockKeyhole,
  UnlockKeyhole,
  ArrowUp,
  ArrowDown,
  Group,
  Ungroup,
} from "lucide-react";
import { useEditor } from "./store";
import {
  ancestors,
  children,
  isLocked,
  isVisible,
  subtreeLocked,
} from "./hierarchy";
import { groupLayers, reorder, ungroup } from "./commands";

/** Pointer travel, in px, before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

interface Gesture {
  id: string;
  parent: string;
  startY: number;
  from: number;
  steps: number;
  active: boolean;
  row: HTMLElement;
}

export function LayersPanel({ act }: { act: (action: () => void) => void }) {
  const s = useEditor(),
    p = s.project;
  const listRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTop, setDropTop] = useState<number | null>(null);

  // Photoshop-style drag reordering: press a row, move past the threshold,
  // an insertion line follows the pointer between siblings, release commits
  // the whole move as a single history entry.
  const startDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".layer-action")) return;
    if (subtreeLocked(p, id)) return;
    const row = e.currentTarget as HTMLElement;
    const parent = row.getAttribute("data-parent") || "";
    const sibs = children(p, parent || null);
    const target = sibs.find((x) => x.id === id);
    if (!target) return;
    gesture.current = {
      id,
      parent,
      startY: e.clientY,
      from: sibs.slice().reverse().indexOf(target),
      steps: 0,
      active: false,
      row,
    };
    // Deliberately no setPointerCapture here. Capturing on pointerdown
    // retargets the derived click to the row, which stops the layer-name
    // button from ever receiving it and breaks selection entirely. Capture is
    // taken in moveDrag, once the press has become a real drag.
  };

  const moveDrag = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.active) {
      if (Math.abs(e.clientY - g.startY) < DRAG_THRESHOLD) return;
      g.active = true;
      setDragging(g.id);
      try {
        g.row.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort; the list-level handler keeps the drag live */
      }
    }
    const list = listRef.current;
    if (!list) return;
    const rows = [
      ...list.querySelectorAll<HTMLElement>(
        `.layer-row[data-parent="${g.parent}"]`,
      ),
    ];
    // Insertion index in display order, plus the boundary to draw the line at.
    let raw = rows.length;
    let edge = list.getBoundingClientRect().bottom;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        raw = i;
        edge = r.top;
        break;
      }
      edge = r.bottom;
    }
    // Removing the dragged row shifts everything after it up by one.
    const target = raw > g.from ? raw - 1 : raw;
    const steps = g.from - target;
    g.steps = steps;
    // No line when the drop would not move anything.
    setDropY(edge, list, steps !== 0);
  };

  const setDropY = (edge: number, list: HTMLElement, show: boolean) => {
    setDropTop(show ? edge - list.getBoundingClientRect().top : null);
  };

  const endDrag = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    try {
      g?.row.releasePointerCapture(e.pointerId);
    } catch {
      /* capture was never taken, or the pointer is already released */
    }
    setDragging(null);
    setDropTop(null);
    if (!g || !g.active || g.steps === 0) return;
    act(() => {
      const dir = g.steps > 0 ? 1 : -1;
      let next = p;
      for (let i = 0; i < Math.abs(g.steps); i++)
        next = reorder(next, g.id, dir);
      if (next !== p) s.commit(next);
    });
  };

  const cancelDrag = () => {
    gesture.current = null;
    setDragging(null);
    setDropTop(null);
  };

  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragging]);

  const group = (ids: string[]) =>
    act(() => {
      const result = groupLayers(p, ids);
      s.commit(result.project);
      s.select(result.id);
    });
  const tree = (parent: string | null, depth = 0): React.ReactNode =>
    [...children(p, parent)].reverse().map((e) => {
      const Icon = ELEMENT_ICONS[e.type];
      const inherited = ancestors(p, e.id).some((a) => a.locked);
      const collapsed = s.collapsed.includes(e.id);
      return (
        <div key={e.id}>
          <div
            className={`layer-row ${s.selection.includes(e.id) ? "active" : ""} ${!isVisible(p, e.id) ? "hidden-layer" : ""} ${dragging === e.id ? "dragging" : ""} ${subtreeLocked(p, e.id) ? "locked-row" : ""}`}
            data-layer-id={e.id}
            data-parent={e.parentId ?? ""}
            style={{ paddingLeft: depth * 14 }}
            onPointerDown={(ev) => startDrag(ev, e.id)}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
          >
            {e.type === "group" ? (
              <button
                className="layer-action"
                aria-label={`${collapsed ? "Expand" : "Collapse"} ${e.name}`}
                aria-expanded={!collapsed}
                onClick={() => s.toggleCollapsed(e.id)}
              >
                {collapsed ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
              </button>
            ) : (
              <span className="tree-spacer" />
            )}
            <button
              className="layer-name"
              aria-pressed={s.selection.includes(e.id)}
              onClick={(event) =>
                s.select(e.id, event.shiftKey || event.ctrlKey || event.metaKey)
              }
            >
              <Icon size={15} />
              <span>{e.name}</span>
            </button>
            <button
              className="layer-action"
              aria-label={`${e.visible ? "Hide" : "Show"} ${e.name}`}
              disabled={isLocked(p, e.id)}
              onClick={() => s.edit(e.id, { visible: !e.visible })}
            >
              {e.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              className="layer-action"
              aria-label={`${e.locked ? "Unlock" : "Lock"} ${e.name}`}
              disabled={inherited}
              title={inherited ? "Locked by parent group" : undefined}
              onClick={() => s.edit(e.id, { locked: !e.locked })}
            >
              {isLocked(p, e.id) ? (
                <LockKeyhole size={13} />
              ) : (
                <UnlockKeyhole size={13} />
              )}
            </button>
          </div>
          {e.type === "group" && !collapsed && tree(e.id, depth + 1)}
        </div>
      );
    });
  const selected = p.elements.find((e) => e.id === s.selected);
  return (
    <aside className="layers">
      <PanelHeader title="Layers" icon={Layers}>
        <button
          className="icon-button"
          aria-label="New group"
          onClick={() => group([])}
        >
          <FolderPlus size={16} />
        </button>
      </PanelHeader>
      <button
        className={`canvas-entry ${!s.selection.length ? "active" : ""}`}
        onClick={() => s.select(null)}
      >
        <span className="artboard-icon" />
        <span>
          Canvas{" "}
          <small>
            {p.canvas.width} × {p.canvas.height}
          </small>
        </span>
      </button>
      <div className="layer-list" ref={listRef} onPointerMove={moveDrag}>
        {tree(null)}
        {dropTop !== null && (
          <div className="drop-line" style={{ top: dropTop }} />
        )}
        {!p.elements.length && (
          <div className="empty-state">
            <Layers size={24} />
            <p>No layers yet</p>
            <span>Add an element to begin designing.</span>
          </div>
        )}
      </div>
      <div className="layer-tools">
        <button
          aria-label="Group selection"
          title="Group selection (Ctrl+G)"
          disabled={!s.selection.length}
          onClick={() => group(s.selection)}
        >
          <Group size={17} />
        </button>
        <button
          aria-label="Ungroup"
          disabled={selected?.type !== "group"}
          onClick={() =>
            act(() => {
              s.commit(ungroup(p, s.selected!));
              s.select(null);
            })
          }
        >
          <Ungroup size={17} />
        </button>
        <span />
        <button
          aria-label="Move layer up"
          disabled={!s.selected}
          onClick={() => act(() => s.commit(reorder(p, s.selected!, 1)))}
        >
          <ArrowUp size={15} />
        </button>
        <button
          aria-label="Move layer down"
          disabled={!s.selected}
          onClick={() => act(() => s.commit(reorder(p, s.selected!, -1)))}
        >
          <ArrowDown size={15} />
        </button>
      </div>
    </aside>
  );
}
