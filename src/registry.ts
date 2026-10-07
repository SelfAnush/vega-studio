import type { Element } from "./model";

export type ElementKind = Element["type"];
export type PaletteCategory = "basic" | "charts" | "structure";

export interface ElementCapabilities {
  /** Solid fill, no fill, or both. */
  fill: "fixed" | "none" | "both" | null;
  /** Optional stroke (color + width + dash). */
  stroke: boolean;
  /** Opacity control. */
  opacity: boolean;
  /** Field bindings compiled into marks. */
  bindings: boolean;
  /** Corner resize handle. */
  resize: boolean;
  /** Endpoint handles instead of corner resize. */
  endpoints: boolean;
  /** Optional aspect-ratio lock. */
  aspectLock: boolean;
}

export interface ElementDef {
  type: ElementKind;
  displayName: string;
  /** Lucide icon rendered for this type in the palette and layer list. */
  icon: string;
  /** Vega construct produced by src/compiler.ts for this type. */
  vega: string;
  category: PaletteCategory;
  minWidth: number;
  /** Lines have no height field; bounds derive from endpoints. */
  minHeight: number | null;
  capabilities: ElementCapabilities;
  /** Property-inspector sections in display order. */
  sections: string[];
}

const shapeResize = {
  fill: "both" as const,
  stroke: true,
  opacity: true,
  bindings: true,
  resize: true,
  endpoints: false,
  aspectLock: false,
};

export const ELEMENTS: Record<ElementKind, ElementDef> = {
  text: {
    type: "text",
    displayName: "Text",
    icon: "Type",
    vega: "text mark (lineBreak, limit, align, baseline)",
    category: "basic",
    minWidth: 20,
    minHeight: 20,
    capabilities: {
      fill: null,
      stroke: false,
      opacity: true,
      bindings: true,
      resize: true,
      endpoints: false,
      aspectLock: false,
    },
    sections: [
      "Layer",
      "Layout",
      "Content",
      "Typography",
      "Appearance",
      "Data & rules",
      "Visibility",
    ],
  },
  rectangle: {
    type: "rectangle",
    displayName: "Rectangle",
    icon: "Square",
    vega: "rect mark",
    category: "basic",
    minWidth: 20,
    minHeight: 20,
    capabilities: { ...shapeResize },
    sections: ["Layer", "Layout", "Appearance", "Data & rules", "Visibility"],
  },
  ellipse: {
    type: "ellipse",
    displayName: "Ellipse",
    icon: "Circle",
    vega: "path mark (two-arc ellipse)",
    category: "basic",
    minWidth: 20,
    minHeight: 20,
    capabilities: { ...shapeResize, aspectLock: true },
    sections: ["Layer", "Layout", "Appearance", "Data & rules", "Visibility"],
  },
  line: {
    type: "line",
    displayName: "Line",
    icon: "Minus",
    vega: "rule mark",
    category: "basic",
    minWidth: 0,
    minHeight: null,
    capabilities: {
      fill: null,
      stroke: true,
      opacity: true,
      bindings: true,
      resize: false,
      endpoints: true,
      aspectLock: false,
    },
    sections: [
      "Layer",
      "Endpoints",
      "Appearance",
      "Data & rules",
      "Visibility",
    ],
  },
  bar: {
    type: "bar",
    displayName: "Bar chart",
    icon: "BarChartHorizontal / ChartColumn",
    vega: "nested group (band + linear scales, collect sort, format signals)",
    category: "charts",
    minWidth: 360,
    minHeight: 220,
    capabilities: {
      fill: "fixed",
      stroke: false,
      opacity: false,
      bindings: true,
      resize: true,
      endpoints: false,
      aspectLock: false,
    },
    sections: [
      "Layer",
      "Layout",
      "Data & rules",
      "Axes",
      "Chart grid",
      "Bars & value labels",
      "Colors & thresholds",
      "Advanced",
    ],
  },
  group: {
    type: "group",
    displayName: "Group",
    icon: "Folder",
    vega: "nested group mark",
    category: "structure",
    minWidth: 20,
    minHeight: 20,
    capabilities: {
      fill: null,
      stroke: false,
      opacity: false,
      bindings: true,
      resize: true,
      endpoints: false,
      aspectLock: false,
    },
    sections: ["Layer", "Layout", "Visibility"],
  },
};

export const PALETTE: {
  category: PaletteCategory;
  title: string;
  items: ElementKind[];
}[] = [
  {
    category: "basic",
    title: "Basic",
    items: ["text", "rectangle", "ellipse", "line"],
  },
  { category: "charts", title: "Charts", items: ["bar"] },
];

export interface PaletteEntry {
  id: string;
  type: ElementKind;
  label: string;
  description: string;
  preset?: Partial<Element>;
}
const descriptions: Record<ElementKind, string> = {
  text: "Headings, labels, and data-bound text",
  rectangle: "Cards, backgrounds, and containers",
  ellipse: "Circles and oval shapes",
  line: "Dividers and connecting lines",
  bar: "Compare values across categories",
  group: "Organize related layers",
};
export const PALETTE_GROUPS = PALETTE.map((group) => ({
  ...group,
  entries: group.items.flatMap((type): PaletteEntry[] =>
    type === "bar"
      ? ["horizontal", "vertical"].map((orientation) => ({
          id: `bar-${orientation}`,
          type,
          label: `${orientation === "horizontal" ? "Horizontal" : "Vertical"} bar chart`,
          description: descriptions[type],
          preset: { orientation } as Partial<Element>,
        }))
      : [
          {
            id: type,
            type,
            label: ELEMENTS[type].displayName,
            description: descriptions[type],
          },
        ],
  ),
}));
