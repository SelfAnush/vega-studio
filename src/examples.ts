import {
  newElement,
  paint,
  none,
  type Project,
  type Element,
  type Bar,
  type Row,
} from "./model";

/**
 * Synthetic demonstration fixtures. These rows are hand-written for Vega
 * Studio and are NOT exports from Kibana sample datasets — see
 * docs/sample-data.md for provenance. They are shaped like web-log and
 * service-health data so the bar examples exercise realistic fields.
 */
export const endpointRows: Row[] = [
  { endpoint: "GET /search", requests: 1240, errors: 18 },
  { endpoint: "POST /events", requests: 860, errors: 42 },
  { endpoint: "GET /assets", requests: 1530, errors: 7 },
  { endpoint: "POST /ingest", requests: 640, errors: 55 },
  { endpoint: "GET /status", requests: 2100, errors: 3 },
];

export const serviceRows: Row[] = [
  { service: "ingest", load: 42.5, label: "ingest" },
  { service: "events", load: 78.2, label: "events" },
  { service: "archive", load: 91.7, label: "archive" },
  { service: "search", load: 63.9, label: "search" },
  { service: "alerts", load: 28.4, label: "alerts" },
];

/** Shared dataset for the reactive example: every element below reads it. */
export const reactiveRows: Row[] = [
  { service: "ingest", load: 42, status: "ok", updated: "2026-09-22T08:00:00Z" },
  { service: "events", load: 78, status: "warn", updated: "2026-09-22T08:05:00Z" },
  { service: "archive", load: 95, status: "crit", updated: "2026-09-22T08:09:00Z" },
];

const text = (overrides: Partial<Element>): Element =>
  ({ ...newElement("text"), ...overrides }) as Element;

const inlineSource = (name: string, rows: Row[]) => ({
  kind: "inline" as const,
  name,
  rows: structuredClone(rows),
});

export function shapesExample(): Project {
  return {
    version: 4,
    name: "Shapes and text",
    canvas: { width: 900, height: 560, background: "#ffffff" },
    sources: [inlineSource("source", [])],
    elements: [
      text({
        id: "title",
        name: "Panel title",
        x: 40, y: 32, width: 820, height: 40,
        content: "Shapes, lines, and styled text",
        fontSize: 28, weight: "bold",
        color: paint("#202b40"),
      }),
      text({
        id: "subtitle",
        name: "Subtitle",
        x: 40, y: 80, width: 820, height: 64,
        content: "Centered multiline text\nSecond line stays centered",
        fontFamily: "georgia",
        fontSize: 16,
        align: "center",
        vertical: "middle",
        lineHeight: 1.4,
        color: paint("#43516b"),
      }),
      {
        ...newElement("rectangle"),
        id: "card", name: "Card",
        x: 40, y: 168, width: 300, height: 150,
        fill: paint("#5965dd"),
        stroke: paint("#202b40"),
        strokeWidth: 3, strokeDash: "dashed",
        radius: 16,
      } as Element,
      {
        ...newElement("ellipse"),
        id: "badge", name: "Badge",
        x: 380, y: 168, width: 150, height: 150,
        fill: none(),
        stroke: paint("#ee7686"),
        strokeWidth: 4, strokeDash: "solid",
        lockAspect: true,
      } as Element,
      {
        ...newElement("line"),
        id: "connector", name: "Connector",
        x: 570, y: 168, x2: 250, y2: 150,
        color: paint("#67b9a0"),
        strokeWidth: 4, strokeDash: "dashed", cap: "round",
      } as Element,
      text({
        id: "caption",
        name: "Caption",
        x: 40, y: 360, width: 820, height: 120,
        content:
          "Dashed card, outlined circle, and a round-capped connector.\nEverything here exports to plain Vega marks.",
        fontSize: 14,
        lineHeight: 1.5,
        color: paint("#43516b"),
      }),
    ],
  };
}

export function barsExample(): Project {
  return {
    version: 4,
    name: "Horizontal and vertical bars",
    canvas: { width: 1000, height: 720, background: "#171c27" },
    sources: [inlineSource("source", endpointRows)],
    elements: [
      text({
        id: "title",
        name: "Panel title",
        x: 40, y: 28, width: 920, height: 40,
        content: "Traffic and errors share one source",
        fontSize: 26, weight: "bold",
      }),
      {
        ...newElement("bar"),
        id: "requests", name: "Requests",
        x: 40, y: 84, width: 920, height: 290,
        category: { kind: "field", field: "endpoint" },
        value: { kind: "field", field: "requests" },
        sort: "value-desc",
        colorMode: "single",
        color: paint("#6c7df0"),
        axisMax: 2500,
        valueTitle: "requests",
        labelPosition: "outside",
        valueFormat: "number",
        decimals: 0,
      } as Bar as Element,
      {
        ...newElement("bar"),
        id: "errors", name: "Errors",
        x: 40, y: 394, width: 920, height: 290,
        orientation: "vertical",
        category: { kind: "field", field: "endpoint" },
        value: { kind: "field", field: "errors" },
        sort: "category-asc",
        colorMode: "threshold",
        color: paint("#6c7df0"),
        axisMax: 60,
        warning: 20, critical: 40,
        valueTitle: "errors",
        labelPosition: "outside",
        valueFormat: "number",
        decimals: 0,
      } as Bar as Element,
    ],
  };
}

export function dashboardExample(): Project {
  return {
    version: 4,
    name: "Service load panel",
    canvas: { width: 1000, height: 600, background: "#171c27" },
    sources: [inlineSource("source", serviceRows)],
    elements: [
      {
        ...newElement("rectangle"),
        id: "header", name: "Header",
        x: 24, y: 20, width: 952, height: 84,
        fill: paint("#232b3d"),
        radius: 12,
      } as Element,
      text({
        id: "title",
        name: "Panel title",
        x: 48, y: 34, width: 700, height: 34,
        content: "Service load overview",
        fontSize: 24, weight: "bold",
      }),
      text({
        id: "subtitle",
        name: "Subtitle",
        x: 48, y: 68, width: 700, height: 22,
        content: "Fixed-size panel · shapes, text, and a configured chart",
        fontSize: 13,
        color: paint("#929db2"),
      }),
      {
        ...newElement("ellipse"),
        id: "status", name: "Status dot",
        x: 904, y: 40, width: 44, height: 44,
        fill: paint("#67b9a0"),
        lockAspect: true,
      } as Element,
      {
        ...newElement("line"),
        id: "divider", name: "Divider",
        x: 24, y: 120, x2: 952, y2: 0,
        color: paint("#303747"),
        strokeWidth: 1,
      } as Element,
      {
        ...newElement("bar"),
        id: "load", name: "Load",
        x: 24, y: 140, width: 952, height: 420,
        category: { kind: "field", field: "label" },
        value: { kind: "field", field: "load" },
        sort: "value-desc",
        colorMode: "threshold",
        color: paint("#6c7df0"),
        axisMax: 100,
        warning: 70, critical: 90,
        labelPosition: "outside",
        valueFormat: "percent",
        decimals: 1,
        valueTitle: "load %",
      } as Bar as Element,
    ],
  };
}

/**
 * Reactive example: text content, rectangle fill, ellipse fill, line
 * width, group visibility, and chart colors all read the same `metrics`
 * dataset through the shared binding model. Edit the rows under Data
 * sources and watch the whole panel react.
 */
export function reactiveExample(): Project {
  const maxLoad = {
    dataset: "metrics",
    mode: "reduce" as const,
    matchField: "",
    matchValue: "",
    timestampField: "",
    op: "max" as const,
    reduceField: "load",
    field: "value",
  };
  return {
    version: 4,
    name: "Reactive data panel",
    canvas: { width: 1000, height: 640, background: "#171c27" },
    sources: [inlineSource("metrics", reactiveRows)],
    elements: [
      text({
        id: "title",
        name: "Panel title",
        x: 40, y: 28, width: 600, height: 40,
        content: "Worst load right now",
        fontSize: 26, weight: "bold",
      }),
      text({
        id: "bigvalue",
        name: "Worst load value",
        x: 40, y: 72, width: 300, height: 64,
        content: "—",
        fontSize: 44, weight: "bold",
        contentFrom: {
          pick: maxLoad,
          format: "percent" as const,
          decimals: 0,
        },
        colorRules: {
          pick: maxLoad,
          rules: [
            { operator: ">=" as const, value: 90, color: paint("#ee7686") },
            { operator: ">=" as const, value: 70, color: paint("#e8b65c") },
          ],
          default: "#67b9a0",
        },
      }),
      {
        ...newElement("rectangle"),
        id: "banner", name: "Status banner",
        x: 360, y: 72, width: 600, height: 64,
        fill: paint("#67b9a0"),
        fillRules: {
          pick: maxLoad,
          rules: [
            { operator: ">=" as const, value: 90, color: paint("#ee7686") },
            { operator: ">=" as const, value: 70, color: paint("#e8b65c") },
          ],
          default: "#67b9a0",
        },
        radius: 12,
      } as Element,
      {
        ...newElement("ellipse"),
        id: "dot", name: "Latest status",
        x: 896, y: 28, width: 44, height: 44,
        fill: paint("#67b9a0"),
        lockAspect: true,
        fillRules: {
          pick: {
            dataset: "metrics",
            mode: "latest" as const,
            matchField: "",
            matchValue: "",
            timestampField: "updated",
            op: "sum" as const,
            reduceField: "",
            field: "status",
          },
          rules: [
            { operator: "==" as const, value: "crit", color: paint("#ee7686") },
            { operator: "==" as const, value: "warn", color: paint("#e8b65c") },
          ],
          default: "#67b9a0",
        },
      } as Element,
      {
        ...newElement("line"),
        id: "rule", name: "Load rule",
        x: 40, y: 160, x2: 920, y2: 0,
        color: paint("#6c7df0"),
        strokeWidth: 3,
        widthMap: {
          pick: {
            dataset: "metrics",
            mode: "reduce" as const,
            matchField: "",
            matchValue: "",
            timestampField: "",
            op: "average" as const,
            reduceField: "load",
            field: "value",
          },
          dataMin: 0,
          dataMax: 100,
          outMin: 1,
          outMax: 8,
          fallback: 2,
        },
      } as Element,
      {
        ...newElement("group"),
        id: "alerts", name: "Alerts",
        x: 40, y: 184,
        visibility: {
          mode: "rule" as const,
          pick: maxLoad,
          operator: ">=" as const,
          value: 70,
          value2: undefined,
          whenTrue: "show" as const,
          onMissing: "hide" as const,
        },
      } as Element,
      text({
        id: "alert-text",
        name: "Alert text",
        x: 0, y: 0, width: 920, height: 28,
        parentId: "alerts",
        content: "⚠ Load above warning threshold — check events and archive.",
        fontSize: 15, weight: "bold",
        color: paint("#e8b65c"),
      }),
      {
        ...newElement("bar"),
        id: "loads", name: "Loads",
        x: 40, y: 228, width: 920, height: 372,
        dataset: "metrics",
        category: { kind: "field", field: "service" },
        value: { kind: "field", field: "load" },
        sort: "value-desc",
        colorMode: "threshold",
        color: paint("#6c7df0"),
        axisMax: 100,
        warning: 70, critical: 90,
        labelPosition: "outside",
        valueFormat: "percent",
        decimals: 0,
      } as Bar as Element,
    ],
  };
}

export const EXAMPLE_PROJECTS: {
  id: string;
  title: string;
  blurb: string;
  build: () => Project;
}[] = [
  {
    id: "shapes",
    title: "Shapes and text",
    blurb: "Text, rectangles, ellipses, and lines.",
    build: shapesExample,
  },
  {
    id: "bars",
    title: "Bars, both ways",
    blurb: "Horizontal and vertical bars, one source.",
    build: barsExample,
  },
  {
    id: "dashboard",
    title: "Service load panel",
    blurb: "Shapes, text, and a configured chart.",
    build: dashboardExample,
  },
  {
    id: "reactive",
    title: "Reactive data panel",
    blurb: "Every element reads one dataset.",
    build: reactiveExample,
  },
];
