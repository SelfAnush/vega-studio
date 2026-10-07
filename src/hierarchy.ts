import type { Element, LineEl, Project } from "./model";

export const children = (p: Project, parentId: string | null) =>
  p.elements.filter((e) => e.parentId === parentId);
export function ancestors(p: Project, id: string): Element[] {
  const result: Element[] = [];
  let current = p.elements.find((e) => e.id === id);
  while (current?.parentId) {
    current = p.elements.find((e) => e.id === current!.parentId);
    if (current) result.push(current);
  }
  return result;
}
export const isLocked = (p: Project, id: string) =>
  [p.elements.find((e) => e.id === id), ...ancestors(p, id)].some(
    (e) => e?.locked,
  );
export const isVisible = (p: Project, id: string) =>
  [p.elements.find((e) => e.id === id), ...ancestors(p, id)].every(
    (e) => e?.visible,
  );
export const descendants = (p: Project, id: string): Element[] =>
  children(p, id).flatMap((e) => [e, ...descendants(p, e.id)]);
export const subtreeLocked = (p: Project, id: string) =>
  isLocked(p, id) || descendants(p, id).some((e) => e.locked);
export function worldPosition(p: Project, e: Element) {
  return ancestors(p, e.id).reduce(
    (pos, a) => ({ x: pos.x + a.x, y: pos.y + a.y }),
    { x: e.x, y: e.y },
  );
}
/**
 * World-space start and end points of a line. Offsets (x2/y2) are stored
 * relative to the start, so ancestor offsets shift both endpoints equally.
 */
export function worldEndpoints(p: Project, e: LineEl) {
  const origin = worldPosition(p, e);
  return {
    x1: origin.x,
    y1: origin.y,
    x2: origin.x + e.x2,
    y2: origin.y + e.y2,
  };
}
export type Bounds = { x: number; y: number; width: number; height: number };
export function bounds(p: Project, e: Element): Bounds {
  if (e.type === "line") {
    const pts = worldEndpoints(p, e);
    const x = Math.min(pts.x1, pts.x2),
      y = Math.min(pts.y1, pts.y2);
    return { x, y, width: Math.abs(pts.x2 - pts.x1), height: Math.abs(pts.y2 - pts.y1) };
  }
  if (e.type === "group") {
    const parts = children(p, e.id);
    if (!parts.length) {
      // Empty groups keep a small selectable frame at their origin.
      return { ...worldPosition(p, e), width: 40, height: 40 };
    }
    const boxes = parts.map((c) => bounds(p, c));
    const x = Math.min(...boxes.map((b) => b.x)),
      y = Math.min(...boxes.map((b) => b.y));
    return {
      x,
      y,
      width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
      height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
    };
  }
  return { ...worldPosition(p, e), width: e.width, height: e.height };
}
export function ordered(p: Project): Element[] {
  const visit = (parent: string | null): Element[] =>
    children(p, parent).flatMap((e) => [e, ...visit(e.id)]);
  return visit(null);
}
export function selectionRoots(p: Project, ids: string[]): Element[] {
  return p.elements.filter(
    (e) =>
      ids.includes(e.id) && !ancestors(p, e.id).some((a) => ids.includes(a.id)),
  );
}
