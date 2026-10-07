import { create } from "zustand";
import {
  blankProject,
  validateProject,
  type Project,
  type Element,
} from "./model";
import { ancestors, isLocked, subtreeLocked, ordered } from "./hierarchy";
interface Editor {
  project: Project;
  past: Project[];
  future: Project[];
  saved: string;
  selected: string | null;
  selection: string[];
  collapsed: string[];
  screen: "welcome" | "editor";
  documentEpoch: number;
  theme: "light" | "dark";
  setScreen: (screen: Editor["screen"]) => void;
  setTheme: (theme: Editor["theme"]) => void;
  selectMany: (ids: string[]) => void;
  toggleCollapsed: (id: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  tool: "select" | "pan";
  snap: boolean;
  toggleSnap: () => void;
  /** Editor-only grid/overlay settings. Never part of the document: they
   * cannot dirty the project and never reach Vega export. */
  gridVisible: boolean;
  toggleGridVisible: () => void;
  gridSpacing: number;
  setGridSpacing: (spacing: number) => void;
  guidesSnap: boolean;
  toggleGuidesSnap: () => void;
  /** Width of the Properties panel, in CSS pixels. Editor-only like the grid
   *  settings: it cannot dirty the project and never reaches Vega export. */
  propertiesWidth: number;
  setPropertiesWidth: (width: number) => void;
  /** Consecutive-paste cascade step. Reset on copy. */
  pasteStep: number;
  notePaste: () => void;
  resetPaste: () => void;
  select: (id: string | null, additive?: boolean) => void;
  viewport: (zoom: number, pan?: { x: number; y: number }) => void;
  setTool: (tool: Editor["tool"]) => void;
  commit: (next: Project) => void;
  edit: (id: string, change: Partial<Element>) => void;
  undo: () => void;
  redo: () => void;
  open: (p: Project) => void;
  markSaved: () => void;
}
const initial = blankProject();
/** Properties panel width bounds. The max keeps the canvas usable on the
 *  documented 1024px minimum layout, and 240px is the narrowest width where
 *  the two-column inspector grid still fits. */
export const PANEL_MIN = 240;
export const PANEL_MAX = 520;
export const PANEL_DEFAULT = 320;
export function clampPanelWidth(width: number) {
  if (!Number.isFinite(width)) return PANEL_DEFAULT;
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(width)));
}
function readPanelWidth() {
  try {
    const raw = localStorage.getItem("vega-studio-properties-width");
    return raw === null ? PANEL_DEFAULT : clampPanelWidth(Number(raw));
  } catch {
    return PANEL_DEFAULT;
  }
}
export function storePanelWidth(width: number) {
  try {
    localStorage.setItem("vega-studio-properties-width", String(width));
  } catch {
    /* storage unavailable; the width simply will not persist */
  }
}
function validSelection(project: Project, selection: string[], collapsed: string[]) {
  const ids = new Set(project.elements.map((e) => e.id));
  const next = selection.filter((id) => ids.has(id));
  return { selection: next, selected: next.at(-1) ?? null,
    collapsed: collapsed.filter((id) => ids.has(id)) };
}
function storedTheme(): "light" | "dark" {
  try {
    return localStorage.getItem("vega-studio-theme") === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}
export const useEditor = create<Editor>((set, get) => ({
  project: initial,
  past: [],
  future: [],
  saved: JSON.stringify(initial),
  selected: null,
  selection: [],
  collapsed: [],
  screen: "welcome",
  documentEpoch: 0,
  theme: storedTheme(),
  setScreen: (screen) => set({ screen }),
  setTheme: (theme) => {
    try {
      localStorage.setItem("vega-studio-theme", theme);
    } catch {
      /* Theme remains usable when storage is unavailable. */
    }
    set({ theme });
  },
  selectMany: (selection) =>
    set({ selection, selected: selection.at(-1) ?? null }),
  toggleCollapsed: (id) =>
    set((s) => ({
      collapsed: s.collapsed.includes(id)
        ? s.collapsed.filter((x) => x !== id)
        : [...s.collapsed, id],
    })),
  zoom: 0.8,
  pan: { x: 0, y: 0 },
  tool: "select",
  snap: false,
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  gridVisible: false,
  toggleGridVisible: () => set((s) => ({ gridVisible: !s.gridVisible })),
  gridSpacing: 8,
  setGridSpacing: (spacing) =>
    set({
      gridSpacing: Math.min(200, Math.max(1, Math.round(spacing) || 8)),
    }),
  guidesSnap: true,
  toggleGuidesSnap: () => set((s) => ({ guidesSnap: !s.guidesSnap })),
  propertiesWidth: readPanelWidth(),
  setPropertiesWidth: (width) =>
    set({ propertiesWidth: clampPanelWidth(width) }),
  pasteStep: 0,
  notePaste: () => set((s) => ({ pasteStep: s.pasteStep + 1 })),
  resetPaste: () => set({ pasteStep: 0 }),
  select: (id, additive = false) => {
    const s = get();
    const selection = id
      ? additive
        ? s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id]
        : [id]
      : [];
    set({ selection, selected: selection.at(-1) ?? null });
  },
  viewport: (zoom, pan) =>
    set({ zoom: Math.min(2, Math.max(0.15, zoom)), ...(pan ? { pan } : {}) }),
  setTool: (tool) => set({ tool }),
  commit: (next) => {
    const s = get();
    const validated = validateProject(next);
    const project = { ...validated, elements: ordered(validated) };
    if (JSON.stringify(project) === JSON.stringify(s.project)) return;
    set({ project, past: [...s.past.slice(-99), s.project], future: [],
      ...validSelection(project, s.selection, s.collapsed) });
  },
  edit: (id, change) => {
    const s = get(),
      e = s.project.elements.find((e) => e.id === id);
    if (!e) return;
    if (
      isLocked(s.project, id) &&
      !(
        Object.keys(change).length === 1 &&
        change.locked === false &&
        !ancestors(s.project, id).some((a) => a.locked)
      )
    )
      return;
    if (("x" in change || "y" in change) && subtreeLocked(s.project, id))
      return;
    s.commit({
      ...s.project,
      elements: s.project.elements.map((e) =>
        e.id === id ? ({ ...e, ...change } as Element) : e,
      ),
    });
  },
  undo: () => {
    const s = get(),
      p = s.past.at(-1);
    if (p)
      set({
        project: p,
        ...validSelection(p, s.selection, s.collapsed),
        past: s.past.slice(0, -1),
        future: [s.project, ...s.future],
      });
  },
  redo: () => {
    const s = get(),
      p = s.future[0];
    if (p)
      set({
        project: p,
        ...validSelection(p, s.selection, s.collapsed),
        past: [...s.past, s.project],
        future: s.future.slice(1),
      });
  },
  open: (p) => {
    const project = validateProject(p);
    set({
      project,
      documentEpoch: get().documentEpoch + 1,
      pasteStep: 0,
      past: [],
      future: [],
      selected: null,
      selection: [],
      collapsed: [],
      screen: "editor",
      pan: { x: 0, y: 0 },
      tool: "select",
      saved: JSON.stringify(project),
    });
  },
  markSaved: () => set({ saved: JSON.stringify(get().project) }),
}));
