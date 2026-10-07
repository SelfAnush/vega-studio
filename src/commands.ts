import {
  newElement,
  type Project,
  type Element,
  type StudioClipboard,
  validateClipboard,
} from "./model";
import {
  ancestors,
  bounds,
  children,
  descendants,
  isLocked,
  selectionRoots,
  subtreeLocked,
  worldPosition,
} from "./hierarchy";
import { ELEMENTS } from "./registry";

export function groupLayers(
  p: Project,
  ids: string[],
): { project: Project; id: string } {
  const selected = selectionRoots(p, ids);
  if (selected.some((e) => subtreeLocked(p, e.id)))
    throw new Error(
      "Unlock the selected layers and their children before grouping.",
    );
  const parentId = selected[0]?.parentId ?? null;
  if (selected.some((e) => e.parentId !== parentId))
    throw new Error("Select layers in the same group before grouping them.");
  const group = newElement("group");
  group.parentId = parentId;
  if (selected.length) {
    group.x = Math.min(...selected.map((e) => e.x));
    group.y = Math.min(...selected.map((e) => e.y));
  }
  const elements = p.elements.map((e) =>
    selected.some((s) => s.id === e.id)
      ? { ...e, parentId: group.id, x: e.x - group.x, y: e.y - group.y }
      : e,
  );
  const index = selected.length
    ? Math.max(
        ...selected.map((e) => elements.findIndex((n) => n.id === e.id)),
      ) + 1
    : elements.length;
  elements.splice(index, 0, group);
  return { project: { ...p, elements }, id: group.id };
}
export function ungroup(p: Project, id: string): Project {
  const group = p.elements.find((e) => e.id === id);
  if (!group || group.type !== "group") return p;
  if (subtreeLocked(p, id))
    throw new Error("Unlock this group and its children before ungrouping.");
  const direct = children(p, id).map((e) => ({
    ...e,
    parentId: group.parentId,
    x: e.x + group.x,
    y: e.y + group.y,
  }));
  return {
    ...p,
    elements: p.elements.flatMap((e) =>
      e.id === id ? direct : e.parentId === id ? [] : [e],
    ),
  };
}
export function reparent(
  p: Project,
  ids: string[],
  parentId: string | null,
): Project {
  const roots = selectionRoots(p, ids);
  const parent = p.elements.find((e) => e.id === parentId);
  if (parentId && (!parent || parent.type !== "group"))
    throw new Error("Choose a valid destination group.");
  if (parentId && isLocked(p, parentId))
    throw new Error("Unlock the destination group first.");
  for (const e of roots) {
    if (subtreeLocked(p, e.id))
      throw new Error("Unlock the selected layers and their children first.");
    if (
      e.id === parentId ||
      (parentId && ancestors(p, parentId).some((a) => a.id === e.id))
    )
      throw new Error(
        "A group cannot be moved into itself or its descendants.",
      );
  }
  const origin = parent ? worldPosition(p, parent) : { x: 0, y: 0 };
  const moved = roots.map((e) => {
    const pos = worldPosition(p, e);
    return { ...e, parentId, x: pos.x - origin.x, y: pos.y - origin.y };
  });
  return {
    ...p,
    elements: [
      ...p.elements.filter((e) => !roots.some((r) => r.id === e.id)),
      ...moved,
    ],
  };
}
export function moveLayers(
  p: Project,
  ids: string[],
  dx: number,
  dy: number,
): Project {
  const roots = selectionRoots(p, ids).filter((e) => !subtreeLocked(p, e.id));
  return {
    ...p,
    elements: p.elements.map((e) =>
      roots.some((r) => r.id === e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e,
    ),
  };
}
export function removeLayers(p: Project, ids: string[]): Project {
  const roots = selectionRoots(p, ids);
  if (roots.some((e) => subtreeLocked(p, e.id)))
    throw new Error(
      "Unlock the selected layers and their children before deleting.",
    );
  const removed = new Set(
    roots.flatMap((e) => [e.id, ...descendants(p, e.id).map((d) => d.id)]),
  );
  return { ...p, elements: p.elements.filter((e) => !removed.has(e.id)) };
}
export function duplicateLayers(
  p: Project,
  ids: string[],
): { project: Project; ids: string[] } {
  const roots = selectionRoots(p, ids);
  if (roots.some((e) => subtreeLocked(p, e.id)))
    throw new Error(
      "Unlock the selected layers and their children before duplicating.",
    );
  const source = roots.flatMap((e) => [e, ...descendants(p, e.id)]),
    idMap = new Map(source.map((e) => [e.id, `layer_${crypto.randomUUID()}`]));
  const copies = source.map((e) => ({
    ...structuredClone(e),
    id: idMap.get(e.id)!,
    parentId: idMap.get(e.parentId ?? "") ?? e.parentId,
    name: roots.includes(e) ? `${e.name} copy` : e.name,
    x: e.x + (roots.includes(e) ? 20 : 0),
    y: e.y + (roots.includes(e) ? 20 : 0),
  }));
  return {
    project: { ...p, elements: [...p.elements, ...copies] },
    ids: roots.map((e) => idMap.get(e.id)!),
  };
}
export function reorder(p: Project, id: string, direction: number): Project {
  const e = p.elements.find((e) => e.id === id);
  if (!e) return p;
  const siblings = children(p, e.parentId),
    i = siblings.indexOf(e),
    other = siblings[i + direction];
  if (!other || subtreeLocked(p, id) || subtreeLocked(p, other.id)) return p;
  const elements = [...p.elements],
    a = elements.indexOf(e),
    b = elements.indexOf(other);
  [elements[a], elements[b]] = [elements[b], elements[a]];
  return { ...p, elements };
}
export function align(p: Project, e: Element, side: number): Project {
  // Sides: 0 left, 1 horizontal center, 2 right, 3 top, 4 vertical center,
  // 5 bottom — all relative to the canvas. Sides 0-2 preserve the original
  // foundation behavior exactly.
  const box = bounds(p, e);
  const targetX =
    side === 0
      ? 0
      : side === 1
        ? (p.canvas.width - box.width) / 2
        : side === 2
          ? p.canvas.width - box.width
          : null;
  if (targetX !== null) return moveLayers(p, [e.id], targetX - box.x, 0);
  const targetY =
    side === 3
      ? 0
      : side === 4
        ? (p.canvas.height - box.height) / 2
        : p.canvas.height - box.height;
  return moveLayers(p, [e.id], 0, targetY - box.y);
}
/**
 * Align every selection root to the canvas edge/center. Coordinates use
 * world bounds so elements nested in different groups align by what the
 * user sees; moveLayers shifts local coordinates by the same world delta,
 * so one commit moves the whole selection and locked roots stay put.
 */
export function alignRoots(p: Project, ids: string[], side: number): Project {
  const roots = selectionRoots(p, ids).filter((e) => !subtreeLocked(p, e.id));
  if (!roots.length)
    throw new Error("Unlock the selected layers before aligning.");
  let next = p;
  for (const root of roots) {
    const box = bounds(next, root);
    const dx =
      side === 0
        ? 0 - box.x
        : side === 1
          ? (next.canvas.width - box.width) / 2 - box.x
          : side === 2
            ? next.canvas.width - box.width - box.x
            : 0;
    const dy =
      side === 3
        ? 0 - box.y
        : side === 4
          ? (next.canvas.height - box.height) / 2 - box.y
          : side === 5
            ? next.canvas.height - box.height - box.y
            : 0;
    next = moveLayers(next, [root.id], dx, dy);
  }
  return next;
}
/**
 * Distribute three or more selection roots with equal gaps between their
 * world bounds. First and last (in sort order) stay; the middle roots move
 * along one axis. One commit, one undo step.
 */
export function distribute(
  p: Project,
  ids: string[],
  axis: "x" | "y",
): Project {
  const roots = selectionRoots(p, ids).filter((e) => !subtreeLocked(p, e.id));
  if (roots.length < 3)
    throw new Error("Select three or more unlocked layers to distribute.");
  const boxes = roots
    .map((e) => ({ e, box: bounds(p, e) }))
    .sort((a, b) =>
      axis === "x" ? a.box.x - b.box.x : a.box.y - b.box.y,
    );
  const lo = axis === "x" ? boxes[0].box.x : boxes[0].box.y;
  const last = boxes[boxes.length - 1];
  const hi =
    (axis === "x" ? last.box.x : last.box.y) +
    (axis === "x" ? last.box.width : last.box.height);
  const total = boxes.reduce(
    (sum, b) => sum + (axis === "x" ? b.box.width : b.box.height),
    0,
  );
  const gap = (hi - lo - total) / (boxes.length - 1);
  let cursor = lo,
    next = p;
  for (const { e, box } of boxes) {
    const target = cursor;
    cursor += (axis === "x" ? box.width : box.height) + gap;
    const d = target - (axis === "x" ? box.x : box.y);
    if (d !== 0)
      next = moveLayers(next, [e.id], axis === "x" ? d : 0, axis === "y" ? d : 0);
  }
  return next;
}
/** Snap a coordinate to the grid. Grid size lives in the editor store. */
export const snapValue = (value: number, grid = 8) =>
  Math.round(value / grid) * grid;

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/**
 * Resize a world-space box from one handle by (dx, dy). Left/top handles
 * move position and size together; dimensions clamp at minimums so boxes
 * never flip through negative sizes; `keepAspect` (Shift on corners, or an
 * aspect lock) preserves the original ratio from the fixed corner.
 */
export function resizeBox(
  box: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
  keepAspect: boolean,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = box;
  const ratio = box.height === 0 ? 1 : box.width / box.height;
  const movesX = handle.includes("w");
  const movesY = handle.includes("n");
  const sizesX = handle.includes("w") || handle.includes("e");
  const sizesY = handle.includes("n") || handle.includes("s");
  let w = width + (handle.includes("e") ? dx : handle.includes("w") ? -dx : 0);
  let h = height + (handle.includes("s") ? dy : handle.includes("n") ? -dy : 0);
  if (keepAspect && sizesX && sizesY) {
    // Grow from the dominant axis, anchored at the fixed corner.
    if (Math.abs(dx) >= Math.abs(dy)) {
      w = Math.max(minW, minH * ratio, w);
      h = w / ratio;
    } else {
      h = Math.max(minH, minW / ratio, h);
      w = h * ratio;
    }
  } else {
    w = Math.max(minW, w);
    h = Math.max(minH, h);
  }
  if (!sizesX) w = width;
  if (!sizesY) h = height;
  if (movesX) x = x + width - w;
  if (movesY) y = y + height - h;
  return { x, y, width: Math.max(0, w), height: Math.max(0, h) };
}

/**
 * Collect copyable layers: selection roots plus full subtrees. Locked
 * subtrees refuse with an explicit error (existing lock policy).
 */
export function copyLayers(p: Project, ids: string[]): StudioClipboard {
  const roots = selectionRoots(p, ids);
  if (!roots.length) throw new Error("Select one or more layers to copy.");
  if (roots.some((e) => subtreeLocked(p, e.id)))
    throw new Error(
      "Unlock the selected layers and their children before copying.",
    );
  const elements = roots.flatMap((e) => [e, ...descendants(p, e.id)]);
  return validateClipboard({
    app: "vega-studio",
    schema: 4,
    elements: structuredClone(elements),
  });
}

/**
 * Paste clipboard layers with fresh ids, repaired parents, and a
 * predictable cascade offset (16px × step, roots only so relative
 * positions survive). A root keeps its parent only when that group still
 * exists and is unlocked; otherwise it lands on the canvas. Dataset
 * references are kept verbatim — missing ones surface as setup warnings,
 * never silent rebinds. One call = one commit = one undo step.
 */
export function pasteLayers(
  p: Project,
  clip: StudioClipboard,
  step: number,
): { project: Project; ids: string[]; missingDatasets: string[] } {
  const roots = clip.elements.filter(
    (e) => !clip.elements.some((o) => o.id === e.parentId),
  );
  const known = new Set(p.elements.map((e) => e.id));
  const idMap = new Map(
    clip.elements.map((e) => {
      let id = `layer_${crypto.randomUUID()}`;
      while (known.has(id)) id = `layer_${crypto.randomUUID()}`;
      known.add(id);
      return [e.id, id] as const;
    }),
  );
  const dx = 16 * step,
    dy = 16 * step;
  const copies = clip.elements.map((e) => {
    const parentId =
      e.parentId && idMap.has(e.parentId)
        ? idMap.get(e.parentId)!
        : (() => {
            const target = e.parentId
              ? p.elements.find((e2) => e2.id === e.parentId)
              : null;
            return target && target.type === "group" && !subtreeLocked(p, target.id)
              ? target.id
              : null;
          })();
    const isRoot = roots.includes(e);
    return {
      ...structuredClone(e),
      id: idMap.get(e.id)!,
      parentId,
      x: e.x + (isRoot ? dx : 0),
      y: e.y + (isRoot ? dy : 0),
    };
  });
  const datasets = new Set(p.sources.map((s) => s.name));
  const missing = new Set<string>();
  for (const e of copies) {
    const refs: string[] = e.type === "bar" ? [e.dataset] : [];
    const picks = [
      ...(e.type === "text"
        ? [
            e.contentFrom?.pick,
            e.colorRules?.pick,
            e.visibility.mode === "rule" ? e.visibility.pick : undefined,
          ]
        : []),
      ...(e.type === "rectangle" || e.type === "ellipse"
        ? [
            e.fillFrom,
            e.fillRules?.pick,
            e.opacityMap?.pick,
            e.visibility.mode === "rule" ? e.visibility.pick : undefined,
          ]
        : []),
      ...(e.type === "line"
        ? [
            e.strokeFrom,
            e.widthMap?.pick,
            e.opacityMap?.pick,
            e.visibility.mode === "rule" ? e.visibility.pick : undefined,
          ]
        : []),
      ...(e.type === "group" && e.visibility.mode === "rule"
        ? [e.visibility.pick]
        : []),
    ];
    for (const pk of picks) if (pk && !datasets.has(pk.dataset)) missing.add(pk.dataset);
    for (const r of refs) if (!datasets.has(r)) missing.add(r);
  }
  return {
    project: { ...p, elements: [...p.elements, ...copies] },
    ids: roots.map((e) => idMap.get(e.id)!),
    missingDatasets: [...missing],
  };
}

/**
 * Resize a group by proportionally scaling descendants about the corner
 * opposite the dragged edge. Positions and sizes scale in world space and
 * are converted back to local coordinates, so hierarchy and world layout
 * survive. Font sizes and stroke widths are deliberately NOT scaled: only
 * the group bounds change, which must not imply content scaling.
 */
export function resizeGroup(
  p: Project,
  id: string,
  oldBox: { x: number; y: number; width: number; height: number },
  newBox: { x: number; y: number; width: number; height: number },
): Project {
  const group = p.elements.find((e) => e.id === id);
  if (!group || group.type !== "group") return p;
  if (subtreeLocked(p, id)) return p;
  const sized = descendants(p, id).filter((e) => "width" in e);
  const minX = Math.max(0, ...sized.map((e) => ELEMENTS[e.type].minWidth / e.width));
  const minY = Math.max(0, ...sized.map((e) => (ELEMENTS[e.type].minHeight ?? 20) / e.height));
  const maxX = Math.min(Infinity, ...sized.map((e) => 4000 / e.width));
  const maxY = Math.min(Infinity, ...sized.map((e) => 4000 / e.height));
  const sx = Math.min(maxX, Math.max(minX, oldBox.width === 0 ? 1 : newBox.width / oldBox.width));
  const sy = Math.min(maxY, Math.max(minY, oldBox.height === 0 ? 1 : newBox.height / oldBox.height));
  // Anchor: the corner that did not move (within rounding).
  const ax =
    Math.abs(newBox.x - oldBox.x) < 0.5
      ? oldBox.x
      : oldBox.x + oldBox.width;
  const ay =
    Math.abs(newBox.y - oldBox.y) < 0.5
      ? oldBox.y
      : oldBox.y + oldBox.height;
  const scalePt = (x: number, y: number) => ({
    x: ax + (x - ax) * sx,
    y: ay + (y - ay) * sy,
  });
  const byId = new Map(p.elements.map((e) => [e.id, e]));
  // New world geometry for the group and every descendant, from old world
  // geometry. Lines scale both endpoints; text boxes scale, font sizes do not.
  interface WBox { x: number; y: number; w: number; h: number; x2?: number; y2?: number }
  const worldOf = (el: Element): WBox => {
    const o = worldPosition(p, el);
    if (el.type === "line")
      return { x: o.x, y: o.y, w: 0, h: 0, x2: o.x + el.x2, y2: o.y + el.y2 };
    if ("width" in el) return { x: o.x, y: o.y, w: el.width, h: el.height };
    return { x: o.x, y: o.y, w: 0, h: 0 };
  };
  const scaled = new Map<string, WBox>();
  for (const el of [group, ...descendants(p, id)]) {
    const w = worldOf(el);
    const s = scalePt(w.x, w.y);
    const box: WBox = {
      x: s.x,
      y: s.y,
      w: "width" in el ? Math.max(1, (scalePt(w.x + w.w, w.y).x - s.x)) : 0,
      h: "height" in el ? Math.max(1, (scalePt(w.x, w.y + w.h).y - s.y)) : 0,
    };
    if (w.x2 !== undefined && w.y2 !== undefined) {
      const t = scalePt(w.x2, w.y2);
      box.x2 = t.x;
      box.y2 = t.y;
    }
    scaled.set(el.id, box);
  }
  // Convert back to local coordinates top-down so nested children subtract
  // their (already scaled) parent's new world position.
  const depth = (el: Element): number =>
    el.parentId && byId.get(el.parentId) ? 1 + depth(byId.get(el.parentId)!) : 0;
  const order = [group, ...descendants(p, id)].sort(
    (a, b) => depth(a) - depth(b),
  );
  const next = new Map<string, Element>();
  const outer = { x: 0, y: 0 };
  for (const a of ancestors(p, id)) {
    outer.x += a.x;
    outer.y += a.y;
  }
  for (const el of order) {
    const w = scaled.get(el.id)!;
    const parentW = el.parentId
      ? scaled.get(el.parentId)
      : { x: outer.x, y: outer.y };
    const px = parentW ? parentW.x : outer.x;
    const py = parentW ? parentW.y : outer.y;
    const copy = { ...structuredClone(el) } as Element;
    copy.x = Math.round(w.x - px);
    copy.y = Math.round(w.y - py);
    if (copy.type === "line" && w.x2 !== undefined && w.y2 !== undefined) {
      copy.x2 = Math.round(w.x2 - w.x);
      copy.y2 = Math.round(w.y2 - w.y);
    } else if ("width" in copy) {
      copy.width = Math.max(1, Math.round(w.w));
      copy.height = Math.max(1, Math.round(w.h));
    }
    next.set(el.id, copy);
  }
  return {
    ...p,
    elements: p.elements.map((e) => next.get(e.id) ?? e),
  };
}
