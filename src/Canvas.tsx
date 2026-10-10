import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BarChart3 } from "lucide-react";
import { VegaRenderer } from "./VegaRenderer";
import { useEditor } from "./store";
import {
  chartSetup,
  newElement,
  type Project,
  type Element,
  type LineEl,
} from "./model";
import {
  bounds,
  isVisible,
  subtreeLocked,
  ancestors,
  descendants,
  worldEndpoints,
  type Bounds,
} from "./hierarchy";
import {
  moveLayers,
  snapValue,
  resizeBox,
  resizeGroup,
  type ResizeHandle,
} from "./commands";
import { ELEMENTS } from "./registry";
import { paletteDrag, endPaletteDrag } from "./dnd";

const GUIDE_PX = 6;
const LINE_SLOP = 6;

function union(boxes: Bounds[]): Bounds {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

function parentOffset(p: Project, id: string): { x: number; y: number } {
  const off = { x: 0, y: 0 };
  for (const a of ancestors(p, id)) {
    off.x += a.x;
    off.y += a.y;
  }
  return off;
}

const HANDLES: { id: ResizeHandle; cursor: string }[] = [
  { id: "nw", cursor: "nwse-resize" },
  { id: "n", cursor: "ns-resize" },
  { id: "ne", cursor: "nesw-resize" },
  { id: "e", cursor: "ew-resize" },
  { id: "se", cursor: "nwse-resize" },
  { id: "s", cursor: "ns-resize" },
  { id: "sw", cursor: "nesw-resize" },
  { id: "w", cursor: "ew-resize" },
];

function handlePos(
  handle: ResizeHandle,
  box: Bounds,
  size: number,
): { left: number; top: number } {
  const o = size / 2;
  const xs = { w: box.x, e: box.x + box.width, c: box.x + box.width / 2 };
  const ys = { n: box.y, s: box.y + box.height, c: box.y + box.height / 2 };
  const map: Record<ResizeHandle, [number, number]> = {
    nw: [xs.w, ys.n],
    n: [xs.c, ys.n],
    ne: [xs.e, ys.n],
    e: [xs.e, ys.c],
    se: [xs.e, ys.s],
    s: [xs.c, ys.s],
    sw: [xs.w, ys.s],
    w: [xs.w, ys.c],
  };
  const [x, y] = map[handle];
  return { left: x - o, top: y - o };
}

const inEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  !!t.closest('input,textarea,select,[contenteditable="true"]');

export function Canvas({
  onError,
  onPlace,
}: {
  onError: (message: string) => void;
  onPlace: (element: Element) => void;
}) {
  const s = useEditor(),
    {
      project,
      selection,
      select,
      zoom,
      pan,
      viewport,
      tool,
      snap,
      gridVisible,
      gridSpacing,
    } = s;
  const area = useRef<HTMLDivElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    shellRef = useRef<HTMLDivElement>(null),
    [draft, setDraft] = useState<Project | null>(null),
    draftRef = useRef<Project | null>(null),
    [dragIds, setDragIds] = useState<Set<string> | null>(null),
    [guides, setGuides] = useState<{ v: number[]; h: number[] }>({
      v: [],
      h: [],
    }),
    [ghost, setGhost] = useState<Element | null>(null),
    [altPan, setAltPan] = useState(false),
    [spacePan, setSpacePan] = useState(false),
    [panning, setPanning] = useState(false);
  const gesture = useRef<{
    pointer: number;
    x: number;
    y: number;
    zoom: number;
    ids: string[];
    element: Element;
    resize: ResizeHandle | true | null;
    endpoint: "start" | "end" | null;
    original: Project;
  } | null>(null);
  const panRef = useRef<{
    pointer: number;
    x: number;
    y: number;
    pan: typeof pan;
  } | null>(null);
  const displayed = draft ?? project;
  const cancel = () => {
    gesture.current = null;
    panRef.current = null;
    draftRef.current = null;
    setDraft(null);
    setDragIds(null);
    setGuides({ v: [], h: [] });
    setGhost(null);
    setPanning(false);
  };
  const effectivePan = tool === "pan" || altPan || spacePan;
  function fit() {
    const r = area.current?.getBoundingClientRect();
    if (r)
      viewport(
        Math.min(
          (r.width - 100) / project.canvas.width,
          (r.height - 140) / project.canvas.height,
          1,
        ),
        { x: 0, y: 0 },
      );
  }
  useEffect(() => {
    fit();
  }, []);
  useEffect(() => {
    const node = area.current!;
    // Pointer-anchored wheel zoom: the canvas point under the pointer stays
    // under the pointer (within rounding). Pan is adjusted analytically —
    // never reset or recentered. Only Ctrl/Cmd+wheel is captured, so normal
    // scrolling and browser zoom elsewhere are untouched.
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const shell = shellRef.current;
        if (!shell) return;
        const st = useEditor.getState();
        const rect = shell.getBoundingClientRect();
        if (!rect.width) return;
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        const factor = Math.min(2, Math.max(0.5, Math.exp(-step * 0.0015)));
        const z2 = Math.min(2, Math.max(0.15, st.zoom * factor));
        if (z2 === st.zoom) return;
        const W = st.project.canvas.width,
          H = st.project.canvas.height;
        const fx = (e.clientX - rect.left) / rect.width;
        const fy = (e.clientY - rect.top) / rect.height;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        st.viewport(z2, {
          x: e.clientX - fx * z2 * W + (z2 * W) / 2 - (cx - st.pan.x),
          y: e.clientY - fy * z2 * H + (z2 * H) / 2 - (cy - st.pan.y),
        });
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      // Temporary hand: Alt (not AltGr) or Space, never inside editable
      // controls, buttons, or dialogs. Local state only — no history.
      if (
        e.key === "Alt" &&
        !e.ctrlKey &&
        !e.repeat &&
        !inEditable(e.target)
      ) {
        e.preventDefault();
        setAltPan(true);
      }
      if (
        e.code === "Space" &&
        !e.repeat &&
        !inEditable(e.target) &&
        !(e.target instanceof HTMLElement && e.target.closest("button,[role=dialog]"))
      ) {
        e.preventDefault();
        setSpacePan(true);
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltPan(false);
      if (e.code === "Space") setSpacePan(false);
    };
    const blur = () => {
      setAltPan(false);
      setSpacePan(false);
      cancel();
    };
    const dragend = () => setGhost(null);
    node.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    window.addEventListener("dragend", dragend);
    return () => {
      node.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      window.removeEventListener("dragend", dragend);
    };
  }, [viewport]);

  /** Alignment guides from the canvas and other visible elements. */
  function guideTargets(original: Project, ids: string[]) {
    const hidden = new Set(
      ids.flatMap((id) => [
        id,
        ...descendants(original, id).map((d) => d.id),
      ]),
    );
    const boxes = original.elements
      .filter((e) => !hidden.has(e.id) && isVisible(original, e.id))
      .map((e) => bounds(original, e));
    const v = new Set<number>([0, original.canvas.width / 2, original.canvas.width]);
    const h = new Set<number>([0, original.canvas.height / 2, original.canvas.height]);
    for (const b of boxes) {
      v.add(b.x);
      v.add(b.x + b.width / 2);
      v.add(b.x + b.width);
      h.add(b.y);
      h.add(b.y + b.height / 2);
      h.add(b.y + b.height);
    }
    return { v: [...v], h: [...h] };
  }

  const toCanvas = (clientX: number, clientY: number) => {
    const rect = shellRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * project.canvas.width,
      y: ((clientY - rect.top) / rect.height) * project.canvas.height,
      inside:
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom,
    };
  };

  return (
    <main className="workspace" ref={area} aria-label="Design workspace">
      <div className="canvas-heading">
        <button onClick={() => select(null)}>
          Canvas <span className="muted">/ {project.name}</span>
        </button>
        <span>
          {project.canvas.width} × {project.canvas.height}
        </span>
      </div>
      <div
        ref={stageRef}
        className={`canvas-stage ${effectivePan ? "panning" : ""}`}
        style={{ cursor: effectivePan ? (panning ? "grabbing" : "grab") : undefined }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget && tool === "select") select(null);
          if (effectivePan || e.button === 1) {
            e.preventDefault();
            panRef.current = {
              pointer: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              pan,
            };
            setPanning(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const p = panRef.current;
          if (p && p.pointer === e.pointerId)
            viewport(zoom, {
              x: p.pan.x + e.clientX - p.x,
              y: p.pan.y + e.clientY - p.y,
            });
        }}
        onPointerUp={(e) => {
          if (panRef.current?.pointer === e.pointerId) {
            panRef.current = null;
            setPanning(false);
          }
          if (!gesture.current) cancel();
        }}
        onPointerCancel={cancel}
        onDragOver={(e) => {
          if (!paletteDrag) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          const pt = toCanvas(e.clientX, e.clientY);
          if (!pt.inside) {
            setGhost(null);
            return;
          }
          setGhost((g) => {
            const create = newElement as (t: Element["type"]) => Element;
            const base =
              g ??
              ({
                ...create(paletteDrag!.type),
                ...(paletteDrag!.preset ?? {}),
              } as Element);
            const w =
              base.type === "line"
                ? Math.abs((base as LineEl).x2)
                : (base as { width: number }).width;
            const h =
              base.type === "line"
                ? Math.abs((base as LineEl).y2)
                : (base as { height: number }).height;
            let x = Math.round(pt.x - w / 2),
              y = Math.round(pt.y - h / 2);
            if (snap) {
              x = snapValue(x, gridSpacing);
              y = snapValue(y, gridSpacing);
            }
            return { ...base, x, y } as Element;
          });
        }}
        onDragLeave={() => setGhost(null)}
        onDrop={(e) => {
          if (!paletteDrag) return;
          e.preventDefault();
          const g = ghost;
          endPaletteDrag();
          setGhost(null);
          if (!g) return;
          const pt = toCanvas(e.clientX, e.clientY);
          if (!pt.inside) return;
          onPlace(g);
        }}
      >
        <div
          ref={shellRef}
          className="panel-shell"
          style={{
            width: project.canvas.width,
            height: project.canvas.height,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          <VegaRenderer project={displayed} onError={onError} preview={!!draft} />
          {gridVisible && (
            <div
              className="canvas-grid"
              aria-hidden="true"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--dot) 1px, transparent 1px), linear-gradient(to bottom, var(--dot) 1px, transparent 1px)",
                backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
              }}
            />
          )}
          <div
            className="overlays"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) select(null);
            }}
            style={{ pointerEvents: effectivePan ? "none" : "auto" }}
          >
            {guides.v.map((x) => (
              <div key={`v${x}`} className="guide vertical" style={{ left: x }} />
            ))}
            {guides.h.map((y) => (
              <div key={`h${y}`} className="guide horizontal" style={{ top: y }} />
            ))}
            {draft && s.selected && (()=>{const selected=draft.elements.find(e=>e.id===s.selected);if(!selected)return null;const box=bounds(draft,selected);return <><div className="guide vertical" style={{left:box.x}}/><div className="guide horizontal" style={{top:box.y}}/></>;})()}
            {ghost && (
              <div
                className="placement-ghost"
                style={{
                  left: ghost.x,
                  top: ghost.y,
                  width:
                    ghost.type === "line"
                      ? Math.max(Math.abs((ghost as LineEl).x2), 2)
                      : (ghost as { width: number }).width,
                  height:
                    ghost.type === "line"
                      ? Math.max(Math.abs((ghost as LineEl).y2), 2)
                      : (ghost as { height: number }).height,
                }}
              />
            )}
            {displayed.elements
              .filter((e) => isVisible(displayed, e.id))
              .map((element) => {
                const box = bounds(displayed, element),
                  selected = selection.includes(element.id),
                  locked = subtreeLocked(project, element.id),
                  group = element.type === "group";
                const hiddenByCollapsed = ancestors(project, element.id).some(
                  (a) => s.collapsed.includes(a.id),
                );
                const setup =
                  element.type === "bar" ? chartSetup(project, element) : null;
                const line = element.type === "line" ? element : null;
                const slop = line ? LINE_SLOP : 0;
                const overlay = {
                  left: box.x - slop,
                  top: box.y - slop,
                  width: Math.max(box.width + slop * 2, line ? slop * 2 : 0),
                  height: Math.max(box.height + slop * 2, line ? slop * 2 : 0),
                };
                const endpoints = line
                  ? worldEndpoints(displayed, line as LineEl)
                  : null;
                const dragging = !!dragIds?.has(element.id);
                const showHandles =
                  selected &&
                  !locked &&
                  selection.length === 1 &&
                  !dragging;
                const resizable =
                  element.type === "text" ||
                  element.type === "rectangle" ||
                  element.type === "ellipse" ||
                  element.type === "bar" ||
                  element.type === "group";
                // Keep the pointer target generous while drawing a smaller, zoom-stable grip.
                const hs = 16 / zoom;
                return (
                  <div
                    key={element.id}
                    role="button"
                    tabIndex={hiddenByCollapsed ? -1 : 0}
                    aria-label={`Select ${element.name}`}
                    data-testid={`overlay-${element.id}`}
                    className={`element-overlay ${selected ? "selected" : ""} ${locked ? "locked" : ""} ${group ? "group-overlay" : ""}`}
                    style={{
                      ...({
                        "--selection-stroke": `${1 / zoom}px`,
                        "--grip-size": `${8 / zoom}px`,
                        "--grip-stroke": `${1.5 / zoom}px`,
                        "--grip-radius": `${2 / zoom}px`,
                      } as CSSProperties),
                      left: overlay.left,
                      top: overlay.top,
                      width: overlay.width,
                      height: overlay.height,
                      pointerEvents:
                        hiddenByCollapsed ||
                        (group &&
                          !selected &&
                          !s.collapsed.includes(element.id))
                          ? "none"
                          : undefined,
                      zIndex: group && selected ? 2 : undefined,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") select(element.id, e.shiftKey);
                    }}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || effectivePan) return;
                      event.stopPropagation();
                      const handle = (event.target as HTMLElement).dataset.handle;
                      if (!handle && (event.shiftKey || event.ctrlKey || event.metaKey)) {
                        select(element.id, true);
                        return;
                      }
                      const ids = selected ? selection : [element.id];
                      if (!selected) select(element.id);
                      if (locked) return;
                      const roots = ids.flatMap((id) => {
                        const el = project.elements.find((x) => x.id === id)!;
                        return [el, ...descendants(project, id)];
                      });
                      setDragIds(new Set(roots.map((r) => r.id)));
                      gesture.current = {
                        pointer: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        zoom,
                        ids,
                        element: project.elements.find(
                          (e) => e.id === element.id,
                        )!,
                        resize:
                          handle === "resize"
                            ? true
                            : handle?.startsWith("corner-")
                              ? (handle.split("-")[1] as ResizeHandle)
                              : null,
                        endpoint:
                          handle === "endpoint-start"
                            ? "start"
                            : handle === "endpoint-end"
                              ? "end"
                              : null,
                        original: project,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const g = gesture.current;
                      if (!g || g.pointer !== event.pointerId) return;
                      const st = useEditor.getState();
                      const spacing = st.gridSpacing;
                      const dx = Math.round((event.clientX - g.x) / g.zoom),
                        dy = Math.round((event.clientY - g.y) / g.zoom);
                      if (g.endpoint && g.element.type === "line") {
                        const e = g.element;
                        let nx = e.x,
                          ny = e.y,
                          nx2 = e.x2,
                          ny2 = e.y2;
                        if (g.endpoint === "start") {
                          nx = e.x + dx;
                          ny = e.y + dy;
                          nx2 = e.x2 - dx;
                          ny2 = e.y2 - dy;
                        } else {
                          nx2 = e.x2 + dx;
                          ny2 = e.y2 + dy;
                        }
                        if (st.snap) {
                          // Snap world endpoints to the grid.
                          const off = parentOffset(g.original, e.id);
                          if (g.endpoint === "start") {
                            const sx = snapValue(nx + off.x, spacing) - off.x,
                              sy = snapValue(ny + off.y, spacing) - off.y;
                            nx2 += nx - sx;
                            ny2 += ny - sy;
                            nx = sx;
                            ny = sy;
                          } else {
                            nx2 = snapValue(nx + nx2 + off.x, spacing) - off.x - nx;
                            ny2 = snapValue(ny + ny2 + off.y, spacing) - off.y - ny;
                          }
                        }
                        const next = {
                          ...g.original,
                          elements: g.original.elements.map((el) =>
                            el.id === e.id
                              ? { ...el, x: nx, y: ny, x2: nx2, y2: ny2 }
                              : el,
                          ),
                        };
                        draftRef.current = next;
                        setDraft(next);
                        return;
                      }
                      let next: Project;
                      if (g.resize) {
                        next = applyResize(g, dx, dy, event.shiftKey, spacing, st.snap);
                      } else {
                        let ax = dx,
                          ay = dy;
                        const active = { v: [] as number[], h: [] as number[] };
                        const selBox = union(
                          g.ids
                            .map((id) =>
                              g.original.elements.find((el) => el.id === id),
                            )
                            .filter((el) => el)
                            .map((el) => bounds(g.original, el!)),
                        );
                        // Guides win over grid snapping to avoid jitter.
                        if (st.guidesSnap) {
                          const targets = guideTargets(g.original, g.ids);
                          for (const edge of [
                            selBox.x,
                            selBox.x + selBox.width / 2,
                            selBox.x + selBox.width,
                          ]) {
                            const hit = targets.v.find(
                              (t) => Math.abs(t - (edge + ax)) * g.zoom < GUIDE_PX,
                            );
                            if (hit !== undefined) {
                              ax += hit - (edge + ax);
                              active.v.push(hit);
                              break;
                            }
                          }
                          for (const edge of [
                            selBox.y,
                            selBox.y + selBox.height / 2,
                            selBox.y + selBox.height,
                          ]) {
                            const hit = targets.h.find(
                              (t) => Math.abs(t - (edge + ay)) * g.zoom < GUIDE_PX,
                            );
                            if (hit !== undefined) {
                              ay += hit - (edge + ay);
                              active.h.push(hit);
                              break;
                            }
                          }
                        }
                        if (st.snap) {
                          if (!active.v.length)
                            ax += snapValue(selBox.x + ax, spacing) - (selBox.x + ax);
                          if (!active.h.length)
                            ay += snapValue(selBox.y + ay, spacing) - (selBox.y + ay);
                        }
                        setGuides(active);
                        next = moveLayers(g.original, g.ids, ax, ay);
                      }
                      draftRef.current = next;
                      setDraft(next);
                    }}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      if (gesture.current && draftRef.current) {
                        try {
                          s.commit(draftRef.current);
                        } catch (err) {
                          onError((err as Error).message);
                        }
                      }
                      cancel();
                    }}
                    onPointerCancel={cancel}
                    onLostPointerCapture={cancel}
                  >
                    {!dragging && setup && (
                      <div className="chart-setup" data-testid="chart-setup">
                        <BarChart3 size={32} />
                        <strong>Configure your bar chart</strong>
                        <span>{setup}</span>
                      </div>
                    )}
                    {selected && !dragging && (
                      <>
                        {showHandles && resizable && selection.length === 1 && (
                          <>
                            {HANDLES.map(({ id, cursor }) => {
                              const pos = handlePos(id, box, hs);
                              return (
                                <span
                                  key={id}
                                  data-handle={`corner-${id}`}
                                  data-testid={`resize-${id}`}
                                  className={`resize-handle rh-${id}`}
                                  style={{
                                    left: pos.left - overlay.left,
                                    top: pos.top - overlay.top,
                                    width: hs,
                                    height: hs,
                                    cursor,
                                  }}
                                />
                              );
                            })}
                          </>
                        )}
                        {showHandles &&
                          line &&
                          endpoints &&
                          selection.length === 1 && (
                            <>
                              <span
                                data-handle="endpoint-start"
                                data-testid="endpoint-start"
                                className="endpoint-handle endpoint-start"
                                style={{
                                  left: endpoints.x1 - overlay.left - hs / 2,
                                  top: endpoints.y1 - overlay.top - hs / 2,
                                  width: hs,
                                  height: hs,
                                }}
                              />
                              <span
                                data-handle="endpoint-end"
                                data-testid="endpoint-end"
                                className="endpoint-handle endpoint-end"
                                style={{
                                  left: endpoints.x2 - overlay.left - hs / 2,
                                  top: endpoints.y2 - overlay.top - hs / 2,
                                  width: hs,
                                  height: hs,
                                }}
                              />
                            </>
                          )}
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
        {!project.elements.length && !ghost && (
          <div className="canvas-empty-state">Your canvas is ready
            <span>Add an element from the toolbar to get started.</span>
          </div>
        )}
      </div>
      <div className="canvas-bottom">
        <span>
          {effectivePan
            ? "Drag to pan"
            : "Drag to move · Shift-click to select"}{" "}
          <span className="muted">/ Esc cancels</span>
        </span>
        <div className="zoom-control">
          <button aria-label="Zoom out" onClick={() => viewport(zoom - 0.1)}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" onClick={() => viewport(zoom + 0.1)}>
            +
          </button>
          <button onClick={fit}>Fit</button>
          <button
            aria-label="Toggle grid snapping"
            aria-pressed={snap}
            title="Snap gestures to the canvas grid"
            className={`icon-button ${snap ? "active" : ""}`}
            onClick={() => s.toggleSnap()}
          >
            {snap ? "Snap on" : "Snap off"}
          </button>
        </div>
      </div>
    </main>
  );
}

/** Apply an 8-handle resize gesture. Returns the next project (uncommitted).
 * Left/top handles move position and size; dimensions clamp at minimums so
 * nothing flips; Shift on corners (or ellipse aspect lock) preserves ratio;
 * grid snapping applies to the dragged edges. Groups scale descendants
 * proportionally (see resizeGroup); text boxes resize without font changes;
 * charts relayout without touching data. */
function applyResize(
  g: {
    element: Element;
    original: Project;
    resize: ResizeHandle | true | null;
  },
  dx: number,
  dy: number,
  shiftKey: boolean,
  spacing: number,
  snap: boolean,
): Project {
  const el = g.element;
  const off = parentOffset(g.original, el.id);
  if (el.type === "group") {
    const oldBox = bounds(g.original, el);
    const handle = typeof g.resize === "string" ? g.resize : "se";
    if (snap) {
      if (handle.includes("e")) dx = snapValue(oldBox.x + oldBox.width + dx, spacing) - oldBox.x - oldBox.width;
      if (handle.includes("w")) dx = snapValue(oldBox.x + dx, spacing) - oldBox.x;
      if (handle.includes("s")) dy = snapValue(oldBox.y + oldBox.height + dy, spacing) - oldBox.y - oldBox.height;
      if (handle.includes("n")) dy = snapValue(oldBox.y + dy, spacing) - oldBox.y;
    }
    const next = resizeBox(oldBox, handle, dx, dy, 8, 8, shiftKey);
    return resizeGroup(g.original, el.id, oldBox, next);
  }
  if (!("width" in el)) return g.original;
  const min = ELEMENTS[el.type];
  const box = bounds(g.original, el);
  const handle: ResizeHandle = typeof g.resize === "string" ? g.resize : "se";
  const keepAspect =
    (shiftKey && (handle === "nw" || handle === "ne" || handle === "sw" || handle === "se")) ||
    (el.type === "ellipse" && el.lockAspect);
  if (snap) {
    // Snap the pointer edges first; aspect and minimum constraints take priority.
    if (handle.includes("e")) dx = snapValue(box.x + box.width + dx, spacing) - box.x - box.width;
    if (handle.includes("w")) dx = snapValue(box.x + dx, spacing) - box.x;
    if (handle.includes("s")) dy = snapValue(box.y + box.height + dy, spacing) - box.y - box.height;
    if (handle.includes("n")) dy = snapValue(box.y + dy, spacing) - box.y;
  }
  const next = resizeBox(box, handle, dx, dy, min.minWidth, min.minHeight ?? 20, keepAspect);
  return {
    ...g.original,
    elements: g.original.elements.map((item) =>
      item.id === el.id && "width" in item
        ? {
            ...item,
            x: next.x - off.x,
            y: next.y - off.y,
            width: next.width,
            height: next.height,
          }
        : item,
    ),
  };
}
