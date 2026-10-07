import { z } from "zod";

const color = z.string().regex(/^#[\da-fA-F]{6}$/, "Use a six-digit hex color");
// Empty string means "automatic" (contrast derived from the canvas or chart
// background). Any non-empty value must be a six-digit hex color.
const autoColor = z
  .string()
  .refine(
    (v) => v === "" || /^#[\da-fA-F]{6}$/.test(v),
    "Use empty (automatic) or a six-digit hex color",
  )
  .default("");
const fixed = z.object({ kind: z.literal("fixed"), value: color });
const fillProp = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("fixed"), value: color }),
]);
const dash = z.enum(["solid", "dashed", "dotted"]).default("solid");

/** A data row. `null` marks explicitly missing data — it is never coerced
 * to zero by bindings, reductions, or rules. */
const rowValue = z.union([z.string(), z.number().finite(), z.null()]);
const rowsSchema = z
  .array(z.record(z.string(), rowValue))
  .max(1000);
export type Row = z.infer<typeof rowsSchema>[number];

const datasetName = z
  .string()
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    "Use a letter followed by letters, digits, _ or -",
  );

const inlineSource = z.object({
  kind: z.literal("inline"),
  name: datasetName,
  rows: rowsSchema,
});
const esSource = z.object({
  kind: z.literal("elasticsearch"),
  name: datasetName,
  /** Index pattern, e.g. `logs-*`. Required for Elasticsearch export. */
  index: z.string().default(""),
  /** Query DSL body as JSON text. Validated as a JSON object at export. */
  query: z.string().default(""),
  /** Response extraction path, e.g. `hits.hits._source`. Also emitted as
   * Kibana `format.property` so local fixtures and exports share semantics. */
  extractPath: z.string().default("hits.hits._source"),
  /** Emit `%context%: true` (dashboard filters). Per Elastic docs the body
   * must then not contain its own `query`. */
  dashboardFilter: z.boolean().default(true),
  /** Emit `%timefield%` for the dashboard time range. Also forbids a body
   * `query` for the same reason. */
  dashboardTime: z.boolean().default(false),
  timestampField: z.string().default(""),
  /** Representative extracted rows for local preview (never a live call). */
  fixture: z.object({ rows: rowsSchema }).nullable().default(null),
});
const namedSource = z.discriminatedUnion("kind", [inlineSource, esSource]);
export type NamedSource = z.infer<typeof namedSource>;

const placed = {
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
  name: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  visible: z.boolean(),
  locked: z.boolean(),
  parentId: z.string().nullable().default(null),
};
const sized = {
  ...placed,
  width: z.number().min(20).max(4000),
  height: z.number().min(20).max(4000),
};

/** Documented system-font list. Keys are stored; stacks are emitted to Vega. */
export const FONT_FAMILIES = ["studio", "arial", "georgia", "mono", "verdana"] as const;
export const FONT_STACKS: Record<(typeof FONT_FAMILIES)[number], string> = {
  studio: "Inter, Segoe UI, sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  georgia: "Georgia, Times New Roman, serif",
  mono: '"Courier New", Courier, monospace',
  verdana: "Verdana, Geneva, sans-serif",
};

export const BAR_SORTS = [
  "input",
  "category-asc",
  "category-desc",
  "value-asc",
  "value-desc",
] as const;
export const VALUE_FORMATS = ["number", "percent", "bytes"] as const;

/**
 * Shared data-binding model (v1.2.0). A pick resolves a dataset to one
 * scalar row value — never silently the first row of a multirow dataset:
 * - match: first row (dataset order) where String(row[matchField]) equals
 *   String(matchValue). No match → null.
 * - latest: row with the greatest timestampField (numbers numerically,
 *   strings lexicographically so ISO-8601 works). Null/missing values are
 *   ignored; ties resolve to the first such row in dataset order.
 * - reduce: count/sum/average/minimum/maximum over a field. Non-finite
 *   values are ignored; empty input → null (never a healthy zero).
 * The read `field` applies to match/latest. Reductions always produce an
 * aggregate row whose value lives under `value`.
 */
export const PICK_MODES = ["match", "latest", "reduce"] as const;
export const REDUCE_OPS = ["count", "sum", "average", "min", "max"] as const;
const pickSchema = z.object({
  dataset: z.string().min(1).default("source"),
  mode: z.enum(PICK_MODES).default("reduce"),
  matchField: z.string().default(""),
  matchValue: z.union([z.string(), z.number()]).default(""),
  timestampField: z.string().default(""),
  op: z.enum(REDUCE_OPS).default("sum"),
  reduceField: z.string().default(""),
  field: z.string().default("value"),
});
export type DataPick = z.infer<typeof pickSchema>;
export const neutralPick = (): DataPick => ({
  dataset: "source",
  mode: "reduce",
  matchField: "",
  matchValue: "",
  timestampField: "",
  op: "sum",
  reduceField: "",
  field: "value",
});

export const COMPARE_OPS = ["==", "!=", ">", ">=", "<", "<=", "between"] as const;
const colorRule = z.object({
  operator: z.enum(COMPARE_OPS).default(">="),
  value: z.union([z.string(), z.number()]).default(0),
  value2: z.union([z.string(), z.number()]).optional(),
  color: fixed,
});
export type ColorRule = z.infer<typeof colorRule>;
const colorRules = z.object({
  /** Shared source for every rule; first matching rule wins. */
  pick: pickSchema.default(neutralPick()),
  rules: z.array(colorRule).max(8).default([]),
  default: color,
});
export type ColorRules = z.infer<typeof colorRules>;

/** Bounded numeric mapping: dataMin..dataMax → outMin..outMax (clamped).
 * Missing/non-finite data yields `fallback`, never an implicit zero. */
const numMap = z.object({
  pick: pickSchema.default(neutralPick()),
  dataMin: z.number().finite().default(0),
  dataMax: z.number().finite().default(100),
  outMin: z.number().finite(),
  outMax: z.number().finite(),
  fallback: z.number().finite(),
});
export type NumMap = z.infer<typeof numMap>;

/** Data-driven visibility. Compiles to an opacity gate on the element's
 * own marks (transparent in the scenegraph, excluded from interaction
 * only visually). `onMissing` decides null data explicitly. */
const visibility = z.object({
  mode: z.enum(["always", "rule"]).default("always"),
  pick: pickSchema.default(neutralPick()),
  operator: z.enum(COMPARE_OPS).default(">="),
  value: z.union([z.string(), z.number()]).default(0),
  value2: z.union([z.string(), z.number()]).optional(),
  whenTrue: z.enum(["show", "hide"]).default("show"),
  onMissing: z.enum(["show", "hide"]).default("hide"),
});
export type Visibility = z.infer<typeof visibility>;
export const visibleAlways = (): Visibility => ({
  mode: "always",
  pick: neutralPick(),
  operator: ">=",
  value: 0,
  value2: undefined,
  whenTrue: "show",
  onMissing: "hide",
});

/** Data-bound text content with numeric formatting. Non-finite scalars
 * render as raw strings; null falls back to the fixed content. */
const textValue = z.object({
  pick: pickSchema.default(neutralPick()),
  format: z.enum(VALUE_FORMATS).default("number"),
  decimals: z.number().int().min(0).max(5).default(0),
});
export type TextValue = z.infer<typeof textValue>;

const chartPadding = z.object({
  top: z.number().min(0).max(80).default(0),
  right: z.number().min(0).max(80).default(0),
  bottom: z.number().min(0).max(80).default(0),
  left: z.number().min(0).max(80).default(0),
});

export const elementSchema = z.discriminatedUnion("type", [
  z.object({
    ...placed,
    type: z.literal("group"),
    visibility: visibility.default(visibleAlways()),
  }),
  z.object({
    ...sized,
    type: z.literal("text"),
    content: z.string(),
    contentFrom: textValue.optional(),
    colorRules: colorRules.optional(),
    visibility: visibility.default(visibleAlways()),
    fontFamily: z.enum(FONT_FAMILIES).default("studio"),
    fontSize: z.number().min(8).max(160),
    weight: z.enum(["normal", "bold"]),
    align: z.enum(["left", "center", "right"]).default("left"),
    vertical: z.enum(["top", "middle", "bottom"]).default("top"),
    lineHeight: z.number().min(0.8).max(3).default(1.2),
    color: fixed,
    opacity: z.number().min(0).max(1).default(1),
  }),
  z.object({
    ...sized,
    type: z.literal("rectangle"),
    fill: fillProp,
    fillFrom: pickSchema.optional(),
    fillRules: colorRules.optional(),
    opacityMap: numMap.optional(),
    visibility: visibility.default(visibleAlways()),
    stroke: fillProp.default({ kind: "none" }),
    strokeWidth: z.number().min(1).max(20).default(2),
    strokeDash: dash,
    opacity: z.number().min(0).max(1),
    radius: z.number().min(0).max(200),
  }),
  z.object({
    ...sized,
    type: z.literal("ellipse"),
    fill: fillProp,
    fillFrom: pickSchema.optional(),
    fillRules: colorRules.optional(),
    opacityMap: numMap.optional(),
    visibility: visibility.default(visibleAlways()),
    stroke: fillProp.default({ kind: "none" }),
    strokeWidth: z.number().min(1).max(20).default(2),
    strokeDash: dash,
    opacity: z.number().min(0).max(1).default(1),
    lockAspect: z.boolean().default(false),
  }),
  z.object({
    ...placed,
    type: z.literal("line"),
    // x/y is the start point (parent-local). x2/y2 is the end-point OFFSET
    // from the start, so moving a line only changes x/y and grouping never
    // has to rewrite endpoints. Offsets may be zero or negative, which is
    // how horizontal, vertical, and diagonal lines are represented.
    x2: z.number().finite(),
    y2: z.number().finite(),
    color: fixed,
    strokeFrom: pickSchema.optional(),
    widthMap: numMap.optional(),
    opacityMap: numMap.optional(),
    visibility: visibility.default(visibleAlways()),
    strokeWidth: z.number().min(0.5).max(50).default(2),
    strokeDash: dash,
    cap: z.enum(["butt", "round", "square"]).default("butt"),
    opacity: z.number().min(0).max(1).default(1),
  }),
  z.object({
    ...sized,
    type: z.literal("bar"),
    width: z.number().min(360).max(4000),
    height: z.number().min(220).max(4000),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
    dataset: z.string().min(1).default("source"),
    category: z.object({ kind: z.literal("field"), field: z.string() }),
    value: z.object({ kind: z.literal("field"), field: z.string() }),
    sort: z.enum(BAR_SORTS).default("input"),
    colorMode: z.enum(["single", "threshold"]).default("threshold"),
    color: fixed,
    labels: z.boolean(),
    labelPosition: z.enum(["outside", "inside"]).default("outside"),
    valueFormat: z.enum(VALUE_FORMATS).default("number"),
    decimals: z.number().int().min(0).max(5).default(0),
    tooltip: z.boolean().default(true),
    axisMax: z.number().positive(),
    showValueAxis: z.boolean().default(true),
    showCategoryAxis: z.boolean().default(true),
    valueTitle: z.string().default(""),
    categoryTitle: z.string().default(""),
    labelFontSize: z.number().min(8).max(24).default(12),
    labelColor: autoColor,
    showGrid: z.boolean().default(true),
    gridColor: autoColor,
    gridWidth: z.number().min(0.5).max(4).default(1),
    tickCount: z.number().int().min(2).max(10).default(5),
    bandPadding: z.number().min(0).max(0.9).default(0.38),
    padding: chartPadding.default({ top: 0, right: 0, bottom: 0, left: 0 }),
    warning: z.number().nonnegative(),
    critical: z.number().nonnegative(),
    // Healthy is the base band (value < warning) and so has no threshold of its
    // own. Its colour is optional and falls back to the bar colour, which keeps
    // every project saved before this field existed rendering identically.
    healthyColor: fixed.optional(),
    warningColor: fixed,
    criticalColor: fixed,
    showLegend: z.boolean().default(true),
  }),
]);
export const projectSchema = z.object({
  version: z.literal(4),
  name: z.string().min(1),
  canvas: z.object({
    width: z.number().min(400).max(4000),
    height: z.number().min(300).max(4000),
    background: color,
  }),
  sources: z.array(namedSource).min(1).max(8),
  elements: z.array(elementSchema).max(100),
});
export type Project = z.infer<typeof projectSchema>;
export type Element = z.infer<typeof elementSchema>;
export type Group = Extract<Element, { type: "group" }>;
export type TextEl = Extract<Element, { type: "text" }>;
export type RectEl = Extract<Element, { type: "rectangle" }>;
export type EllipseEl = Extract<Element, { type: "ellipse" }>;
export type LineEl = Extract<Element, { type: "line" }>;
export type Bar = Extract<Element, { type: "bar" }>;
export type BarSort = (typeof BAR_SORTS)[number];
export type ValueFormat = (typeof VALUE_FORMATS)[number];
export type FillProp = z.infer<typeof fillProp>;
export const paint = (value: string) => ({ kind: "fixed" as const, value });
export const none = () => ({ kind: "none" as const });

export const sourceByName = (p: Project, name: string): NamedSource | undefined =>
  p.sources.find((s) => s.name === name);
export const datasetNames = (p: Project): string[] =>
  p.sources.map((s) => s.name);
/** Element names whose bindings read a dataset (bars plus every pick). */
export function datasetUsers(p: Project, name: string): string[] {
  const users: string[] = [];
  const uses = (pk: DataPick | undefined) => pk !== undefined && pk.dataset === name;
  for (const e of p.elements) {
    const hit =
      (e.type === "bar" && e.dataset === name) ||
      (e.type === "text" &&
        (uses(e.contentFrom?.pick) ||
          uses(e.colorRules?.pick) ||
          (e.visibility.mode === "rule" && uses(e.visibility.pick)))) ||
      ((e.type === "rectangle" || e.type === "ellipse") &&
        (uses(e.fillFrom) ||
          uses(e.fillRules?.pick) ||
          uses(e.opacityMap?.pick) ||
          (e.visibility.mode === "rule" && uses(e.visibility.pick)))) ||
      (e.type === "line" &&
        (uses(e.strokeFrom) ||
          uses(e.widthMap?.pick) ||
          uses(e.opacityMap?.pick) ||
          (e.visibility.mode === "rule" && uses(e.visibility.pick)))) ||
      (e.type === "group" &&
        e.visibility.mode === "rule" &&
        uses(e.visibility.pick));
    if (hit) users.push(e.name);
  }
  return users;
}
/** Preview rows for a dataset: inline rows, or an ES fixture when one is
 * supplied. Empty when an Elasticsearch source has no fixture — local
 * preview then renders no tuples (never a live call). */
export function resolvedRows(p: Project, name: string): Row[] {
  const s = sourceByName(p, name);
  if (!s) return [];
  if (s.kind === "inline") return s.rows;
  return s.fixture ? s.fixture.rows : [];
}
/**
 * Extract rows from an Elasticsearch response along a dotted path, e.g.
 * `hits.hits._source`. Each segment traverses an object; when an
 * intermediate value is an array, the remainder maps over its elements.
 * Numeric segments index arrays. This is the same extraction the
 * Elasticsearch export declares via Kibana `format.property`.
 */
export function extractResponse(path: string, response: unknown): Row[] {
  const segs = path.split(".").filter((s) => s.length);
  if (!segs.length) throw new Error("Extraction path must not be empty.");
  let current: unknown[] = [response];
  for (const seg of segs) {
    const next: unknown[] = [];
    for (const node of current) {
      if (Array.isArray(node)) {
        if (/^\d+$/.test(seg)) {
          const item = node[Number(seg)];
          if (item !== undefined) next.push(item);
        } else {
          for (const item of node) {
            if (
              item !== null &&
              typeof item === "object" &&
              seg in (item as Record<string, unknown>)
            )
              next.push((item as Record<string, unknown>)[seg]);
          }
        }
      } else if (node !== null && typeof node === "object") {
        const rec = node as Record<string, unknown>;
        if (seg in rec) next.push(rec[seg]);
      }
    }
    current = next;
  }
  const flatten = (nodes: unknown[]): unknown[] =>
    nodes.flatMap((n) => (Array.isArray(n) ? flatten(n) : [n]));
  const rows = flatten(current).filter(
    (r): r is Row => r !== null && typeof r === "object" && !Array.isArray(r),
  );
  if (!rows.length)
    throw new Error(
      `Path “${path}” extracted no objects. Check the path against the response JSON.`,
    );
  return rows as Row[];
}
function checkPick(e: { name: string }, pick: DataPick, what: string): void {
  if (pick.mode === "match" && !pick.matchField.trim())
    throw new Error(`${e.name}: ${what} needs a match field.`);
  if (pick.mode === "latest" && !pick.timestampField.trim())
    throw new Error(`${e.name}: ${what} needs a timestamp field.`);
  if (
    pick.mode === "reduce" &&
    pick.op !== "count" &&
    !pick.reduceField.trim()
  )
    throw new Error(
      `${e.name}: ${what} reduction “${pick.op}” needs a field.`,
    );
}
function checkNumMap(
  e: { name: string },
  m: NumMap,
  what: string,
  lo: number,
  hi: number,
): void {
  if (!(m.dataMin < m.dataMax))
    throw new Error(
      `${e.name}: ${what} needs dataMin < dataMax for a bounded mapping.`,
    );
  for (const [k, v] of [
    ["outMin", m.outMin],
    ["outMax", m.outMax],
    ["fallback", m.fallback],
  ] as const)
    if (!(v >= lo && v <= hi))
      throw new Error(
        `${e.name}: ${what} ${k} must stay within ${lo}–${hi} so data cannot produce invalid output.`,
      );
}
function checkRules(e: { name: string }, cr: ColorRules, what: string): void {
  checkPick(e, cr.pick, what);
  for (const r of cr.rules) {
    const numeric = [">", ">=", "<", "<=", "between"].includes(r.operator);
    if (numeric && typeof r.value !== "number")
      throw new Error(`${e.name}: ${what} “${r.operator}” needs a numeric value.`);
    if (r.operator === "between" && typeof r.value2 !== "number")
      throw new Error(
        `${e.name}: ${what} “between” needs a numeric upper bound.`,
      );
  }
}
export function validateProject(input: unknown): Project {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("\n"),
    );
  const p = parsed.data;
  if (new Set(p.elements.map((e) => e.id)).size !== p.elements.length)
    throw new Error("Layer IDs must be unique.");
  if (new Set(p.sources.map((s) => s.name)).size !== p.sources.length)
    throw new Error("Dataset names must be unique.");
  const checkVisibility = (e: Element, v: Visibility | undefined) => {
    if (!v || v.mode === "always") return;
    checkPick(e, v.pick, "visibility");
    if ([">", ">=", "<", "<=", "between"].includes(v.operator) && typeof v.value !== "number")
      throw new Error(`${e.name}: visibility “${v.operator}” needs a numeric value.`);
    if (v.operator === "between" && typeof v.value2 !== "number")
      throw new Error(`${e.name}: visibility “between” needs a numeric upper bound.`);
  };
  for (const e of p.elements) {
    const visited = new Set([e.id]);
    let parentId = e.parentId;
    while (parentId) {
      if (visited.has(parentId))
        throw new Error("Groups cannot contain hierarchy cycles.");
      visited.add(parentId);
      const parent = p.elements.find((layer) => layer.id === parentId);
      if (!parent || parent.type !== "group")
        throw new Error(`${e.name}: parent must be an existing group.`);
      parentId = parent.parentId;
    }
    if (e.type === "line" && e.x2 === 0 && e.y2 === 0)
      throw new Error(
        `${e.name}: line endpoints must differ. Use a zero offset on exactly one axis for horizontal or vertical lines.`,
      );
    if (
      e.type === "ellipse" &&
      (e.width < 20 || e.height < 20)
    )
      throw new Error(`${e.name}: ellipse dimensions must be at least 20.`);
    checkVisibility(e, "visibility" in e ? e.visibility : undefined);
    if (e.type === "text") {
      if (e.contentFrom) checkPick(e, e.contentFrom.pick, "content");
      if (e.colorRules) checkRules(e, e.colorRules, "color");
    }
    if (e.type === "rectangle" || e.type === "ellipse") {
      if (e.fillFrom) checkPick(e, e.fillFrom, "fill");
      if (e.fillRules) checkRules(e, e.fillRules, "fill");
      if (e.opacityMap) checkNumMap(e, e.opacityMap, "opacity", 0, 1);
    }
    if (e.type === "line") {
      if (e.strokeFrom) checkPick(e, e.strokeFrom, "stroke");
      if (e.widthMap) checkNumMap(e, e.widthMap, "stroke width", 0.5, 50);
      if (e.opacityMap) checkNumMap(e, e.opacityMap, "opacity", 0, 1);
    }
  }
  for (const e of p.elements)
    if (e.type === "bar") {
      // A missing dataset is a setup warning (see chartSetup), not a
      // validation error, so cross-project pastes keep their references
      // visibly instead of failing or silently rebinding.
      if (
        e.colorMode === "threshold" &&
        (e.warning >= e.critical || e.critical > e.axisMax)
      )
        throw new Error(
          `${e.name}: thresholds must satisfy 0 ≤ warning < critical ≤ axis maximum.`,
        );
      const rows = resolvedRows(p, e.dataset);
      const previewable =
        sourceByName(p, e.dataset)?.kind === "inline" || rows.length > 0;
      if (!previewable) continue;
      const seen = new Set<string>();
      for (const [i, row] of rows.entries()) {
        const label = row[e.category.field],
          value = row[e.value.field];
        if (e.category.field && (typeof label !== "string" || !label.trim()))
          throw new Error(
            `Row ${i + 1}: missing text category “${e.category.field}”.`,
          );
        if (e.category.field && seen.has(String(label)))
          throw new Error(
            `Duplicate category “${label}”. Use unique host/pipeline labels.`,
          );
        seen.add(String(label));
        if (
          e.value.field &&
          (typeof value !== "number" || !Number.isFinite(value) || value < 0)
        )
          throw new Error(
            `Row ${i + 1}: “${e.value.field}” must be a finite, non-negative number.`,
          );
      }
    }
  return p;
}
export function openProject(text: string): Project {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON. Check commas, quotes, and brackets.");
  }
  if (
    typeof input !== "object" ||
    input === null ||
    !("version" in input) ||
    (input.version !== 1 &&
      input.version !== 2 &&
      input.version !== 3 &&
      input.version !== 4)
  )
    throw new Error(
      "Unsupported project version. Open a Vega Studio version 1, 2, 3, or 4 project, not a Vega specification.",
    );
  if (input.version === 4) return validateProject(input);
  return validateProject(migrateToV4(input as Record<string, unknown>));
}
/** Upgrade versions 1–3 to the schema-4 document shape. Older settings
 * keep Zod-default filling (no visual rewrites); the single v3 inline
 * source becomes the named `sources` list so elements can bind by name. */
export function migrateToV4(input: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = { ...input, version: 4 };
  if (out.sources === undefined && "source" in out) {
    const legacy = out.source as { kind?: unknown; rows?: unknown };
    out.sources = [
      {
        kind: "inline",
        name: "source",
        rows: Array.isArray(legacy?.rows) ? legacy.rows : [],
      },
    ];
  }
  delete out.source;
  return out;
}
export function availableFields(
  p: Project,
  type: "string" | "number",
  dataset = "source",
) {
  const rows = resolvedRows(p, dataset);
  return Object.keys(rows[0] ?? {}).filter((key) =>
    rows.every((row) => typeof row[key] === type),
  );
}
export function newElement(type: "group"): Group;
export function newElement(type: "text"): TextEl;
export function newElement(type: "rectangle"): RectEl;
export function newElement(type: "ellipse"): EllipseEl;
export function newElement(type: "line"): LineEl;
export function newElement(type: "bar"): Bar;
export function newElement(type: Element["type"]): Element {
  const placedBase = {
    id: `layer_${crypto.randomUUID()}`,
    visible: true,
    locked: false,
    parentId: null,
  };
  if (type === "group")
    return {
      ...placedBase,
      type,
      name: "Group",
      x: 48,
      y: 48,
      visibility: visibleAlways(),
    };
  if (type === "line")
    return {
      ...placedBase,
      type,
      name: "Line",
      x: 48,
      y: 48,
      x2: 200,
      y2: 0,
      color: paint("#e6e9f0"),
      visibility: visibleAlways(),
      strokeWidth: 2,
      strokeDash: "solid" as const,
      cap: "butt" as const,
      opacity: 1,
    };
  const b = {
    ...placedBase,
    name:
      type === "bar"
        ? "Bar chart"
        : type === "text"
          ? "Text"
          : type === "ellipse"
            ? "Ellipse"
            : "Rectangle",
    x: 48,
    y: 48,
    width: 240,
    height: 48,
  };
  if (type === "text")
    return {
      ...b,
      type,
      content: "Your text here",
      visibility: visibleAlways(),
      fontFamily: "studio" as const,
      fontSize: 24,
      weight: "normal" as const,
      align: "left" as const,
      vertical: "top" as const,
      lineHeight: 1.2,
      color: paint("#e6e9f0"),
      opacity: 1,
    };
  if (type === "rectangle")
    return {
      ...b,
      type,
      height: 100,
      fill: paint("#5965dd"),
      visibility: visibleAlways(),
      stroke: none(),
      strokeWidth: 2,
      strokeDash: "solid" as const,
      opacity: 1,
      radius: 8,
    };
  if (type === "ellipse")
    return {
      ...b,
      type,
      width: 160,
      height: 160,
      fill: paint("#67b9a0"),
      visibility: visibleAlways(),
      stroke: none(),
      strokeWidth: 2,
      strokeDash: "solid" as const,
      opacity: 1,
      lockAspect: false,
    };
  return {
    ...b,
    type,
    width: 700,
    height: 340,
    orientation: "horizontal" as const,
    dataset: "source",
    category: { kind: "field", field: "" },
    value: { kind: "field", field: "" },
    sort: "input" as const,
    colorMode: "threshold" as const,
    color: paint("#6c7df0"),
    labels: true,
    labelPosition: "outside" as const,
    valueFormat: "number" as const,
    decimals: 0,
    tooltip: true,
    axisMax: 100,
    showValueAxis: true,
    showCategoryAxis: true,
    valueTitle: "",
    categoryTitle: "",
    labelFontSize: 12,
    labelColor: "",
    showGrid: true,
    gridColor: "",
    gridWidth: 1,
    tickCount: 5,
    bandPadding: 0.38,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    warning: 65,
    critical: 85,
    warningColor: paint("#e8b65c"),
    criticalColor: paint("#ee7686"),
    showLegend: true,
  };
}
const chart = newElement("bar");
export const sample: Project = {
  version: 4,
  name: "Logstash queue usage",
  canvas: { width: 900, height: 560, background: "#171c27" },
  sources: [
    {
      kind: "inline",
      name: "source",
      rows: [
      ["edge-01", "ingest", 32],
      ["edge-02", "ingest", 48],
      ["core-01", "events", 72],
      ["core-02", "events", 91],
      ["worker-01", "archive", 58],
    ].map(([host, pipeline, usage_pct]) => ({
      host: host as string,
      pipeline: pipeline as string,
      usage_pct: usage_pct as number,
      label: `${host} / ${pipeline}`,
    })),
    },
  ],
  elements: [
    {
      ...newElement("text"),
      id: "title",
      name: "Panel title",
      x: 40,
      y: 32,
      width: 800,
      height: 40,
      content: "Logstash queue usage",
      fontSize: 28,
      weight: "bold",
    } as Element,
    {
      ...newElement("text"),
      id: "description",
      name: "Description",
      x: 40,
      y: 80,
      width: 820,
      height: 24,
      content: "Pipeline capacity across your infrastructure · sample snapshot",
      fontSize: 14,
      color: paint("#929db2"),
    } as Element,
    {
      ...chart,
      type: "bar",
      name: "Queue usage",
      id: "queues",
      x: 40,
      y: 142,
      width: 820,
      height: 368,
      category: { kind: "field", field: "label" },
      value: { kind: "field", field: "usage_pct" },
    } as Bar,
  ],
};
export function blankProject(
  name = "Untitled project",
  width = 900,
  height = 560,
  background = "#ffffff",
): Project {
  return validateProject({
    version: 4,
    name,
    canvas: { width, height, background },
    sources: [{ kind: "inline", name: "source", rows: [] }],
    elements: [],
  });
}
export function chartSetup(p: Project, e: Bar, esExport = false): string | null {
  const ds = sourceByName(p, e.dataset);
  if (!ds)
    return `Dataset “${e.dataset}” is missing here. Bind the chart to an existing dataset; pasted references are kept, never silently rebound.`;
  const rows = resolvedRows(p, e.dataset);
  if (!rows.length) {
    if (esExport && ds.kind === "elasticsearch") return null;
    return "Add data, then choose category and numeric fields.";
  }
  if (!e.category.field || !e.value.field)
    return "Choose category and numeric fields in Properties.";
  return null;
}
/** Setup hint for data-bound (non-bar) elements whose dataset is missing. */
export function bindingDatasetIssue(p: Project, dataset: string): string | null {
  if (!dataset || sourceByName(p, dataset)) return null;
  return `Dataset “${dataset}” is missing here. Bind to an existing dataset; pasted references are kept, never silently rebound.`;
}
export function exportIssues(p: Project, esExport = false): string[] {
  const barIssues = p.elements.flatMap((e) =>
    e.type === "bar" && chartSetup(p, e, esExport)
      ? [`${e.name}: ${chartSetup(p, e, esExport)}`]
      : [],
  );
  if (!esExport) return barIssues;
  return [...barIssues, ...esExportIssues(p)];
}
/** Blockers specific to Elasticsearch export. Incomplete live-export
 * configuration never blocks editing or inline export — only this list. */
export function esExportIssues(p: Project): string[] {
  const issues: string[] = [];
  const esSources = p.sources.filter((s) => s.kind === "elasticsearch");
  if (!esSources.length)
    return ["No Elasticsearch source is configured. Add one under Data sources, or export inline sample data."];
  for (const s of esSources) {
    if (s.kind !== "elasticsearch") continue;
    if (!s.index.trim())
      issues.push(`Dataset “${s.name}”: set an index pattern for Elasticsearch export.`);
    let body: unknown = null;
    try {
      body = s.query.trim() ? JSON.parse(s.query) : null;
    } catch {
      issues.push(`Dataset “${s.name}”: query is not valid JSON.`);
      continue;
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      issues.push(`Dataset “${s.name}”: query must be a JSON object (Query DSL body).`);
      continue;
    }
    const hasOwnQuery =
      "query" in (body as Record<string, unknown>) &&
      (body as Record<string, unknown>).query !== undefined;
    // Per Elastic docs, %context%/%timefield% replace the query section, so
    // a body query cannot be combined with either integration.
    if (hasOwnQuery && (s.dashboardFilter || s.dashboardTime))
      issues.push(
        `Dataset “${s.name}”: dashboard filter/time integration replaces the query section — remove the body “query” or turn the integration off.`,
      );
    if (s.dashboardTime && !s.timestampField.trim())
      issues.push(
        `Dataset “${s.name}”: dashboard-time integration needs a timestamp field.`,
      );
    if (!s.extractPath.trim())
      issues.push(`Dataset “${s.name}”: set a response extraction path.`);
  }
  return issues;
}

/**
 * JavaScript mirror of the Vega value-label/tooltip formatting compiled in
 * `src/compiler.ts`. Percentage semantics: the stored value is already a
 * percentage, so 42 displays as "42%" — Vega's d3 `%` formatter (which
 * multiplies by 100) is never used.
 */
export function formatValueText(
  format: ValueFormat,
  decimals: number,
  value: number,
): string {
  if (format === "percent") return `${value.toFixed(decimals)}%`;
  if (format === "bytes") {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let v = value,
      u = 0;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u++;
    }
    return `${v.toFixed(u === 0 ? 0 : decimals)} ${units[u]}`;
  }
  return value.toFixed(decimals);
}

/**
 * Versioned Studio clipboard payload. Carries complete element subtrees
 * (styling, bindings, thresholds, local hierarchy). Dataset references are
 * kept verbatim: the receiving project surface dangling references as
 * setup warnings instead of silently rebinding them.
 */
const clipboardSchema = z.object({
  app: z.literal("vega-studio"),
  schema: z.literal(4),
  elements: z.array(elementSchema).min(1).max(100),
});
export type StudioClipboard = z.infer<typeof clipboardSchema>;
export function makeClipboard(elements: Element[]): StudioClipboard {
  return validateClipboard({ app: "vega-studio", schema: 4, elements });
}
export function validateClipboard(input: unknown): StudioClipboard {
  const parsed = clipboardSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Clipboard holds no Vega Studio layers. Copy one or more unlocked layers first.",
    );
  return parsed.data;
}
export function parseClipboardText(text: string): StudioClipboard {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error(
      "Clipboard holds no Vega Studio layers. Copy one or more unlocked layers first.",
    );
  }
  return validateClipboard(input);
}
