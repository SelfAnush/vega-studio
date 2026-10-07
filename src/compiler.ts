import type { Spec, Mark } from "vega";
import {
  type Project,
  type Bar,
  type Element,
  type TextEl,
  type RectEl,
  type EllipseEl,
  type LineEl,
  type FillProp,
  type NamedSource,
  type DataPick,
  type ColorRule,
  type NumMap,
  type TextValue,
  type Visibility,
  chartSetup,
  exportIssues,
  resolvedRows,
  FONT_STACKS,
  formatValueText,
  type BarSort,
  type ValueFormat,
} from "./model";
import { children } from "./hierarchy";
import { isLightColor } from "./color";

// The source adapter is the only data-source boundary. Studio stays local:
// Elasticsearch sources compile to Kibana `url` objects for export, and to
// inline fixture rows (or empty) for local preview. No live calls, ever.
export interface DataSourceAdapter {
  compile(
    source: NamedSource,
    opts: { esExport: boolean },
  ): Record<string, unknown>;
}
export const studioSources: DataSourceAdapter = {
  compile: (source, { esExport }) => {
    if (source.kind === "inline")
      return { name: source.name, values: structuredClone(source.rows) };
    if (!esExport)
      return {
        name: source.name,
        values: source.fixture ? structuredClone(source.fixture.rows) : [],
      };
    const url: Record<string, unknown> = {
      index: source.index,
      body: JSON.parse(source.query),
    };
    if (source.dashboardFilter) url["%context%"] = true;
    if (source.dashboardTime) url["%timefield%"] = source.timestampField;
    return {
      name: source.name,
      url,
      format: { property: source.extractPath },
    };
  },
};
/** Back-compat alias: the default adapter compiles every named source. */
export const inlineSource = studioSources;
export function thresholdLegend(e: Bar): string[] {
  return legendItems(e).map((i) => i.label);
}
/** Legend labels derive units from the chart's own value format — a stored
 * 42 shows as `42` (number), `42%` (percent), or `42 B` (bytes). Boundary
 * inclusion matches barFill: healthy v<w, warning w≤v<c, critical v≥c. */
export function legendItems(e: Bar): { label: string; color: string }[] {
  const w = formatValueText(e.valueFormat, e.decimals, e.warning);
  const c = formatValueText(e.valueFormat, e.decimals, e.critical);
  return [
        { label: `Healthy < ${w}`, color: healthyColor(e) },
    { label: `Warning ${w}–<${c}`, color: e.warningColor.value },
    { label: `Critical ≥ ${c}`, color: e.criticalColor.value },
  ];
}
/** Pack legend items into rows that fit the chart width instead of
 * clipping. Estimates 11px text at ~6.5px/char plus dot and padding. */
export function legendLayout(e: Bar): {
  rows: { label: string; color: string }[][];
  height: number;
} {
  if (e.colorMode !== "threshold" || !e.showLegend)
    return { rows: [], height: 0 };
  const items = legendItems(e);
  const maxW = e.width - 16;
  const est = (label: string) => 30 + label.length * 6.5;
  const rows: { label: string; color: string }[][] = [[]];
  let cur = 0;
  for (const it of items) {
    if (rows[rows.length - 1].length && cur + est(it.label) > maxW) {
      rows.push([]);
      cur = 0;
    }
    rows[rows.length - 1].push(it);
    cur += est(it.label);
  }
  return { rows, height: rows.length * 16 + 8 };
}
/** The healthy band is the base state: value < warning. It has no threshold of
 *  its own, and its colour falls back to the bar colour when unset. */
export const healthyColor = (e: Bar) => e.healthyColor?.value ?? e.color.value;
export function thresholdColor(e: Bar, value: number) {
  return value >= e.critical
    ? e.criticalColor.value
    : value >= e.warning
      ? e.warningColor.value
      : healthyColor(e);
}
/** Vega field references interpret dots/brackets as paths unless escaped. */
export const escapeField = (field: string) =>
  field.replace(/[.\[\]\\]/g, "\\$&");
const dashArray = (dash: "solid" | "dashed" | "dotted") =>
  dash === "dashed" ? [6, 4] : dash === "dotted" ? [2, 3] : undefined;
/** "none" paints map to transparent so every mark carries an explicit paint. */
const fillValue = (fill: FillProp) =>
  fill.kind === "none" ? "transparent" : fill.value;

function textMark(
  e: TextEl,
  b: ElBind,
): Mark {
  // Vega text has no word wrap: `limit` truncates with an ellipsis per line,
  // so the selection rectangle (x/y/width/height) is the layout bounds and
  // overflow clips. Multiline content splits on "\n" via `lineBreak`.
  const x =
    e.align === "center"
      ? e.x + e.width / 2
      : e.align === "right"
        ? e.x + e.width
        : e.x;
  const y =
    e.vertical === "middle"
      ? e.y + e.height / 2
      : e.vertical === "bottom"
        ? e.y + e.height
        : e.y;
  const text = b.content
    ? {
        signal: contentSignal(
          b.content.tv,
          b.content.helper,
          e.content,
        ),
      }
    : { value: e.content };
  return {
    type: "text",
    encode: {
      update: {
        x: { value: x },
        y: { value: y },
        text,
        lineBreak: { value: "\n" },
        lineHeight: { value: Math.round(e.fontSize * e.lineHeight) },
        font: { value: FONT_STACKS[e.fontFamily] },
        fontSize: { value: e.fontSize },
        fontWeight: { value: e.weight },
        align: { value: e.align },
        baseline: { value: e.vertical },
        fill: b.colorRules
          ? colorSignal(
              b.colorRules.helper,
              b.colorRules.pick,
              b.colorRules.rules,
              b.colorRules.def,
            )
          : { value: e.color.value },
        opacity: gatedOpacity({ value: e.opacity }, b.vis),
        limit: { value: e.width },
      },
    },
  };
}

/** Data-bound content: formatted when the scalar is a finite number, raw
 * string otherwise, fixed content when data is missing. */
function contentSignal(tv: TextValue, helper: string, fixed: string): string {
  const s = scalarExpr(helper, tv.pick);
  const fmt = valueSignal(
    { valueFormat: tv.format, decimals: tv.decimals } as Bar,
    s,
  );
  return `(${s}!=null?(isFinite(+${s})?${fmt}:${s}+""):${JSON.stringify(fixed)})`;
}

/** Direct color-from-data: hex strings pass through, anything else falls
 * back to the fixed paint. */
function directColorSignal(
  helper: string,
  pick: DataPick,
  fallback: string,
): { signal: string } {
  const s = scalarExpr(helper, pick);
  return {
    signal: `(${s}!=null&&test(/^#[0-9a-fA-F]{6}$/,${s}+"")?${s}:'${fallback}')`,
  };
}

function rectMark(e: RectEl, b: ElBind): Mark {
  const fill = b.colorRules
    ? colorSignal(b.colorRules.helper, b.colorRules.pick, b.colorRules.rules, b.colorRules.def)
    : b.fillFrom
      ? directColorSignal(b.fillFrom.helper, b.fillFrom.pick, fillValue(e.fill))
      : { value: fillValue(e.fill) };
  const update: Record<string, { value: unknown } | { signal: string }> = {
    x: { value: e.x },
    y: { value: e.y },
    width: { value: e.width },
    height: { value: e.height },
    fill,
    stroke: { value: fillValue(e.stroke) },
    strokeWidth: { value: e.strokeWidth },
    opacity: gatedOpacity(
      b.opacityMap
        ? numSignal(b.opacityMap.map, b.opacityMap.helper)
        : { value: e.opacity },
      b.vis,
    ),
    cornerRadius: { value: e.radius },
  };
  const d = dashArray(e.strokeDash);
  if (d) update["strokeDash"] = { value: d };
  return { type: "rect", encode: { update } };
}

function ellipseMark(e: EllipseEl, b: ElBind): Mark {
  // Vega has no ellipse mark, so ellipses compile to a native `path` mark
  // describing the ellipse with two SVG arcs. Arbitrary width/height are
  // preserved exactly in both preview and export.
  const rx = e.width / 2,
    ry = e.height / 2,
    cx = e.x + rx,
    cy = e.y + ry;
  const d = `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${rx * -2} 0`;
  const fill = b.colorRules
    ? colorSignal(b.colorRules.helper, b.colorRules.pick, b.colorRules.rules, b.colorRules.def)
    : b.fillFrom
      ? directColorSignal(b.fillFrom.helper, b.fillFrom.pick, fillValue(e.fill))
      : { value: fillValue(e.fill) };
  const update: Record<string, { value: unknown } | { signal: string }> = {
    path: { value: d },
    fill,
    stroke: { value: fillValue(e.stroke) },
    strokeWidth: { value: e.strokeWidth },
    opacity: gatedOpacity(
      b.opacityMap
        ? numSignal(b.opacityMap.map, b.opacityMap.helper)
        : { value: e.opacity },
      b.vis,
    ),
  };
  const dash = dashArray(e.strokeDash);
  if (dash) update["strokeDash"] = { value: dash };
  return { type: "path", encode: { update } };
}

function lineMark(e: LineEl, b: ElBind): Mark {
  // Rule endpoints are parent-local, so lines compose inside nested Vega
  // groups with no extra math. Zero width (vertical) or zero height
  // (horizontal) is valid; a zero-length line is rejected by validation.
  const update: Record<string, { value: unknown } | { signal: string }> = {
    x: { value: e.x },
    y: { value: e.y },
    x2: { value: e.x + e.x2 },
    y2: { value: e.y + e.y2 },
    stroke: b.strokeFrom
      ? directColorSignal(b.strokeFrom.helper, b.strokeFrom.pick, e.color.value)
      : { value: e.color.value },
    strokeWidth: b.widthMap
      ? numSignal(b.widthMap.map, b.widthMap.helper)
      : { value: e.strokeWidth },
    strokeCap: { value: e.cap },
    strokeOpacity: gatedOpacity(
      b.opacityMap
        ? numSignal(b.opacityMap.map, b.opacityMap.helper)
        : { value: e.opacity },
      b.vis,
    ),
  };
  const d = dashArray(e.strokeDash);
  if (d) update["strokeDash"] = { value: d };
  return { type: "rule", encode: { update } };
}

/** Resolved per-element bindings: helper dataset names for every pick plus
 * the visibility gate signal (null when always visible). */
interface ElBind {
  vis: string | null;
  content?: { helper: string; tv: TextValue };
  colorRules?: { helper: string; pick: DataPick; rules: ColorRule[]; def: string };
  fillFrom?: { helper: string; pick: DataPick };
  strokeFrom?: { helper: string; pick: DataPick };
  opacityMap?: { helper: string; map: NumMap };
  widthMap?: { helper: string; map: NumMap };
}

const sortField = (e: Bar, sort: BarSort) =>
  sort === "value-asc" || sort === "value-desc" ? e.value.field : e.category.field;
const sortOrder = (sort: BarSort) =>
  sort === "category-desc" || sort === "value-desc" ? "descending" : "ascending";

/**
 * Per-chart derived dataset. Every chart reads its own `data_<id>` dataset
 * sourced from the shared `source`, so sorting happens inside the compiled
 * data pipeline: shared rows are never mutated and charts never share an
 * ordering. The leading `filter` forces each dataset to materialize its own
 * tuple stream — without it, sibling `collect` transforms share the source
 * pulse array and the last sort wins for every chart (verified against the
 * pinned runtime).
 */
export function chartDataset(e: Bar): {
  name: string;
  source: string;
  transform: unknown[];
} {
  return {
    name: `data_${e.id}`,
    source: e.dataset,
    transform: [
      { type: "filter", expr: "true" },
      ...(e.sort === "input"
        ? []
        : [
            {
              type: "collect",
              sort: {
                field: escapeField(sortField(e, e.sort)),
                order: sortOrder(e.sort),
              },
            },
          ]),
    ],
  };
}

/** Vega signal expression for a formatted value. Mirrors formatValueText. */
export function valueSignal(
  e: Bar,
  valueExpr: string,
  format: ValueFormat = e.valueFormat,
  decimals: number = e.decimals,
): string {
  if (format === "percent") return `format(${valueExpr}, '.${decimals}f')+'%'`;
  if (format === "bytes") {
    const scaled = (div: number, unit: string) =>
      `format(${valueExpr}/${div}, '.${decimals}f')+' ${unit}'`;
    return (
      `${valueExpr}>=1099511627776 ? ${scaled(1099511627776, "TB")}` +
      ` : ${valueExpr}>=1073741824 ? ${scaled(1073741824, "GB")}` +
      ` : ${valueExpr}>=1048576 ? ${scaled(1048576, "MB")}` +
      ` : ${valueExpr}>=1024 ? ${scaled(1024, "KB")}` +
      ` : format(${valueExpr}, '.0f')+' B'`
    );
  }
  return `format(${valueExpr}, '.${decimals}f')`;
}

function barFill(e: Bar, valueExpr: string): { value: string } | { signal: string } {
  if (e.colorMode === "single") return { value: e.color.value };
  return {
    // The else branch is the healthy band; it must use the same fallback as
    // thresholdColor, or the legend and the painted bars disagree.
    signal: `${valueExpr} >= ${e.critical} ? '${e.criticalColor.value}' : ${valueExpr} >= ${e.warning} ? '${e.warningColor.value}' : '${healthyColor(e)}'`,
  };
}

interface ChartPalette {
  label: string;
  grid: string;
  track: string;
}
const palette = (background: string): ChartPalette => {
  const light = isLightColor(background);
  return {
    label: light ? "#43516b" : "#bbc4d5",
    grid: light ? "#d4dce8" : "#303747",
    track: light ? "#e9edf5" : "#242c3c",
  };
};

function legendMarks(
  e: Bar,
  pal: ChartPalette,
  blockTop: number,
): Mark[] {
  const { rows } = legendLayout(e);
  if (!rows.length) return [];
  // Items pack left-aligned with the same width estimates used for layout,
  // so positions always match the rows computed for the chrome.
  return rows.flatMap((row, r) => {
    let x = 8;
    const y = blockTop + 8 + r * 16;
    const out: Mark[] = [];
    for (const it of row) {
      out.push(
        {
          type: "symbol",
          encode: {
            update: {
              x: { value: x + 5 },
              y: { value: y },
              size: { value: 55 },
              fill: { value: it.color },
            },
          },
        },
        {
          type: "text",
          encode: {
            update: {
              x: { value: x + 18 },
              y: { value: y },
              text: { value: it.label },
              baseline: { value: "middle" },
              fill: { value: pal.label },
              fontSize: { value: 11 },
            },
          },
        } as Mark,
      );
      x += 30 + it.label.length * 6.5;
    }
    return out;
  }) as Mark[];
}

// ---------------------------------------------------------------------------
// Data bindings: picks resolve to one scalar-or-null per helper dataset.
// Every expression below is compiled Vega (signals/transforms), so bound
// styles keep working after export — React never bakes static colors.
// ---------------------------------------------------------------------------

const lit = (v: string | number): string => JSON.stringify(String(v));

/** Vega filter expression selecting `match` rows. */
function matchExpr(pick: DataPick): string {
  const f = `datum[${JSON.stringify(pick.matchField)}]`;
  return `(${f}!=null&&${f}+""==${lit(pick.matchValue)})`;
}

/** One helper dataset per pick: a forked tuple stream plus the selection
 * transform. `filter`-first keeps sibling sorts independent (see
 * chartDataset). */
export function bindingDataset(
  name: string,
  dataset: string,
  pick: DataPick,
): { name: string; source: string; transform: unknown[] } {
  const fork = { type: "filter", expr: "true" };
  if (pick.mode === "match")
    return { name, source: dataset, transform: [fork, { type: "filter", expr: matchExpr(pick) }] };
  if (pick.mode === "latest")
    return {
      name,
      source: dataset,
      transform: [
        fork,
        { type: "aggregate", fields: [pick.timestampField], ops: ["argmax"], as: ["_rec"] },
      ],
    };
  const agg =
    pick.op === "count"
      ? { type: "aggregate", ops: ["count"], as: ["value"] }
      : {
          type: "aggregate",
          fields: [pick.reduceField],
          ops: [pick.op],
          as: ["value"],
        };
  return { name, source: dataset, transform: [fork, agg] };
}

/** Vega expression evaluating to the picked scalar, or null when the pick
 * resolves to missing data. Null is never coerced to zero by callers. */
export function scalarExpr(helper: string, pick: DataPick): string {
  const d = `data('${helper}')`;
  if (pick.mode === "latest") {
    const f = JSON.stringify(pick.field);
    return `(${d}.length&&${d}[0]._rec!=null&&${d}[0]._rec[${f}]!=null?${d}[0]._rec[${f}]:null)`;
  }
  if (pick.mode === "reduce")
    return `(${d}.length&&${d}[0].value!=null?${d}[0].value:null)`;
  const f = JSON.stringify(pick.field);
  return `(${d}.length&&${d}[0][${f}]!=null?${d}[0][${f}]:null)`;
}

/** Condition over an already-built scalar expression. Ordering operators
 * coerce numerically; equality compares strings (categorical support).
 * `between` is inclusive on both ends. */
export function condExpr(
  scalar: string,
  operator: ColorRule["operator"] | Visibility["operator"],
  value: string | number,
  value2?: string | number,
): string {
  switch (operator) {
    case "==":
      return `(${scalar}+""==${lit(value)})`;
    case "!=":
      return `(${scalar}+""!=${lit(value)})`;
    case ">":
      return `(+${scalar}>${value})`;
    case ">=":
      return `(+${scalar}>=${value})`;
    case "<":
      return `(+${scalar}<${value})`;
    case "<=":
      return `(+${scalar}<=${value})`;
    case "between":
      return `(+${scalar}>=${value}&&+${scalar}<=${value2})`;
  }
}

const definedScalar = (scalar: string) => `(${scalar}!=null&&${scalar}==${scalar})`;

/** First matching rule wins, in list order; otherwise the default. */
export function colorSignal(
  helper: string,
  pick: DataPick,
  rules: ColorRule[],
  defaultColor: string,
): { signal: string } {
  const s = scalarExpr(helper, pick);
  let expr = `'${defaultColor}'`;
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i];
    expr = `${condExpr(s, r.operator, r.value, r.value2)}?'${r.color.value}':${expr}`;
  }
  return { signal: `(${definedScalar(s)}?(${expr}):'${defaultColor}')` };
}

/** Bounded numeric mapping with an explicit fallback for missing data. */
export function numSignal(map: NumMap, helper: string): { signal: string } {
  const s = scalarExpr(helper, map.pick);
  const span = map.dataMax - map.dataMin;
  const out = map.outMax - map.outMin;
  return {
    signal:
      `(${definedScalar(s)}&&isFinite(+${s})` +
      `?(${map.outMin}+((clamp(+${s},${map.dataMin},${map.dataMax})-${map.dataMin})/${span})*(${out}))` +
      `:${map.fallback})`,
  };
}

/** Visibility gate: 1 shows, 0 hides (compiled as opacity). */
export function visibilitySignal(v: Visibility, helper: string): string {
  if (v.mode === "always") return "1";
  const s = scalarExpr(helper, v.pick);
  const matched = `(${definedScalar(s)}&&${condExpr(s, v.operator, v.value, v.value2)})`;
  const onTrue = v.whenTrue === "show" ? 1 : 0;
  const onMissing = v.onMissing === "show" ? 1 : 0;
  return `(${matched}?${onTrue}:${onMissing})`;
}

/** Opacity gated by visibility: base when shown, 0 when hidden. */
function gatedOpacity(
  base: { value: number } | { signal: string },
  vis: string | null,
): { value: number } | { signal: string } {
  if (!vis) return base;
  const b = "value" in base ? String(base.value) : `(${base.signal})`;
  return { signal: `(${vis}?${b}:0)` };
}

function horizontalChart(
  e: Bar,
  pal: ChartPalette,
  ds: string,
  labelColor: string,
  gridColor: string,
): Mark {
  const legendH = legendLayout(e).height;
  const axisRowH = e.showValueAxis ? 26 : 8;
  const titleH = e.valueTitle ? 18 : 0;
  const bottomChrome = axisRowH + titleH + legendH + e.padding.bottom + 8;
  const topPad = e.padding.top;
  const catGutter = e.showCategoryAxis ? 180 : 8;
  const valGutter = e.labels ? 40 : 8;
  const plotX = catGutter + e.padding.left;
  const plotY = topPad;
  const plotWidth = e.width - catGutter - valGutter - e.padding.left - e.padding.right;
  const plotHeight = e.height - topPad - bottomChrome;
  // Vega field references interpret dots/brackets as paths unless escaped.
  const categoryField = escapeField(e.category.field);
  const category = `datum[${JSON.stringify(e.category.field)}]`,
    value = `datum[${JSON.stringify(e.value.field)}]`;
  const label = valueSignal(e, value);
  const fill = (v: string) => barFill(e, v);
  const tooltip = e.tooltip
    ? { signal: `${category} + ': ' + ${valueSignal(e, value)}` }
    : undefined;
  const ticks = Array.from({ length: e.tickCount }, (_, i) => i / (e.tickCount - 1));
  return {
    type: "group",
    encode: {
      update: {
        x: { value: e.x },
        y: { value: e.y },
        width: { value: e.width },
        height: { value: e.height },
      },
    },
    scales: [
      {
        name: "x",
        type: "linear",
        domain: [0, e.axisMax],
        range: [0, plotWidth],
        zero: true,
        clamp: true,
      },
      {
        name: "y",
        type: "band",
        domain: { data: ds, field: categoryField },
        range: [0, plotHeight],
        padding: e.bandPadding,
      },
    ],
    marks: [
      ...(e.showGrid
        ? (ticks.flatMap((t) => [
            {
              type: "rule",
              encode: {
                update: {
                  x: { value: plotX + t * plotWidth },
                  y: { value: plotY },
                  y2: { value: plotY + plotHeight },
                  stroke: { value: gridColor },
                  strokeWidth: { value: e.gridWidth },
                  strokeDash: { value: [3, 4] },
                },
              },
            },
          ]) as Mark[])
        : []),
      ...(e.showValueAxis
        ? (ticks.map((t) => ({
            type: "text",
            encode: {
              update: {
                x: { value: plotX + t * plotWidth },
                y: { value: plotY + plotHeight + 18 },
                text: { value: (t * e.axisMax).toFixed(e.decimals) },
                fill: { value: labelColor },
                fontSize: { value: e.labelFontSize },
                align: { value: "center" },
              },
            },
          })) as Mark[])
        : []),
      ...(e.valueTitle
        ? ([
            {
              type: "text",
              encode: {
                update: {
                  x: { value: plotX + plotWidth / 2 },
                  y: { value: plotY + plotHeight + 26 + 9 },
                  text: { value: e.valueTitle },
                  baseline: { value: "middle" },
                  align: { value: "center" },
                  fill: { value: labelColor },
                  fontSize: { value: e.labelFontSize },
                },
              },
            },
          ] as Mark[])
        : []),
      ...(e.categoryTitle && e.showCategoryAxis
        ? ([
            {
              type: "text",
              encode: {
                update: {
                  x: { value: 14 },
                  y: { value: plotY + plotHeight / 2 },
                  text: { value: e.categoryTitle },
                  angle: { value: -90 },
                  baseline: { value: "middle" },
                  align: { value: "center" },
                  fill: { value: labelColor },
                  fontSize: { value: e.labelFontSize },
                },
              },
            },
          ] as Mark[])
        : []),
      {
        type: "rect",
        from: { data: ds },
        encode: {
          update: {
            x: { value: plotX },
            y: { scale: "y", field: categoryField },
            height: { scale: "y", band: 1 },
            width: { value: plotWidth },
            fill: { value: pal.track },
            cornerRadius: { value: 4 },
          },
        },
      },
      {
        type: "rect",
        from: { data: ds },
        encode: {
          update: {
            x: { value: plotX },
            y: { scale: "y", field: categoryField },
            height: { scale: "y", band: 1 },
            width: { signal: `scale('x', ${value})` },
            fill: fill(value),
            cornerRadius: { value: 4 },
            ...(tooltip ? { tooltip } : {}),
          },
        },
      },
      ...(e.showCategoryAxis
        ? ([
            {
              type: "text",
              from: { data: ds },
              encode: {
                update: {
                  x: { value: 0 },
                  y: { scale: "y", field: categoryField, band: 0.5 },
                  text: { signal: category },
                  baseline: { value: "middle" },
                  fill: { value: labelColor },
                  fontSize: { value: e.labelFontSize },
                  limit: { value: 170 },
                },
              },
            },
          ] as Mark[])
        : []),
      ...(e.labels
        ? [
            {
              type: "text",
              from: { data: ds },
              encode: {
                update:
                  e.labelPosition === "inside"
                    ? {
                        x: {
                          signal: `${plotX} + scale('x', ${value}) - 6`,
                        },
                        y: { scale: "y", field: categoryField, band: 0.5 },
                        text: { signal: label },
                        align: { value: "right" },
                        baseline: { value: "middle" },
                        fill: { value: labelColor },
                        fontSize: { value: e.labelFontSize },
                      }
                    : {
                        x: { value: e.width - e.padding.right },
                        y: { scale: "y", field: categoryField, band: 0.5 },
                        text: { signal: label },
                        align: { value: "right" },
                        baseline: { value: "middle" },
                        fill: { value: labelColor },
                        fontSize: { value: e.labelFontSize },
                      },
              },
            } as Mark,
          ]
        : []),
      ...legendMarks(e, pal, e.height - e.padding.bottom - 8 - legendH),
    ],
  };
}

function verticalChart(
  e: Bar,
  pal: ChartPalette,
  ds: string,
  labelColor: string,
  gridColor: string,
  rowCount: number,
): Mark {
  const legendH = legendLayout(e).height;
  const valGutter =
    (e.showValueAxis ? 48 : 8) + (e.valueTitle ? 18 : 0) + e.padding.left;
  const rightG = 8 + e.padding.right;
  const topG = (e.labels ? 24 : 8) + e.padding.top;
  const catRowH = e.showCategoryAxis ? 22 : 8;
  const catTitleH = e.categoryTitle ? 18 : 0;
  const bottomChrome =
    catRowH + catTitleH + legendH + e.padding.bottom + 8;
  const plotX = valGutter;
  const plotY = topG;
  const plotWidth = e.width - valGutter - rightG;
  const plotHeight = e.height - topG - bottomChrome;
  const categoryField = escapeField(e.category.field);
  const category = `datum[${JSON.stringify(e.category.field)}]`,
    value = `datum[${JSON.stringify(e.value.field)}]`;
  const label = valueSignal(e, value);
  const fill = (v: string) => barFill(e, v);
  const tooltip = e.tooltip
    ? { signal: `${category} + ': ' + ${valueSignal(e, value)}` }
    : undefined;
  const ticks = Array.from({ length: e.tickCount }, (_, i) => i / (e.tickCount - 1));
  const catLimit = Math.max(40, Math.floor(plotWidth / Math.max(1, rowCount)));
  return {
    type: "group",
    encode: {
      update: {
        x: { value: e.x },
        y: { value: e.y },
        width: { value: e.width },
        height: { value: e.height },
      },
    },
    scales: [
      {
        name: "x",
        type: "band",
        domain: { data: ds, field: categoryField },
        range: [0, plotWidth],
        padding: e.bandPadding,
      },
      {
        name: "y",
        type: "linear",
        domain: [0, e.axisMax],
        range: [plotHeight, 0],
        zero: true,
        clamp: true,
      },
    ],
    marks: [
      ...(e.showGrid
        ? (ticks.flatMap((t) => [
            {
              type: "rule",
              encode: {
                update: {
                  x: { value: plotX },
                  x2: { value: plotX + plotWidth },
                  y: { value: plotY + plotHeight - t * plotHeight },
                  stroke: { value: gridColor },
                  strokeWidth: { value: e.gridWidth },
                  strokeDash: { value: [3, 4] },
                },
              },
            },
          ]) as Mark[])
        : []),
      ...(e.showValueAxis
        ? (ticks.map((t) => ({
            type: "text",
            encode: {
              update: {
                x: { value: plotX - 6 },
                y: { value: plotY + plotHeight - t * plotHeight },
                text: { value: (t * e.axisMax).toFixed(e.decimals) },
                fill: { value: labelColor },
                fontSize: { value: e.labelFontSize },
                align: { value: "right" },
                baseline: { value: "middle" },
              },
            },
          })) as Mark[])
        : []),
      ...(e.valueTitle && e.showValueAxis
        ? ([
            {
              type: "text",
              encode: {
                update: {
                  x: { value: e.padding.left + 12 },
                  y: { value: plotY + plotHeight / 2 },
                  text: { value: e.valueTitle },
                  angle: { value: -90 },
                  baseline: { value: "middle" },
                  align: { value: "center" },
                  fill: { value: labelColor },
                  fontSize: { value: e.labelFontSize },
                },
              },
            },
          ] as Mark[])
        : []),
      {
        type: "rect",
        from: { data: ds },
        encode: {
          update: {
            x: { scale: "x", field: categoryField },
            y: { value: plotY },
            width: { scale: "x", band: 1 },
            height: { value: plotHeight },
            fill: { value: pal.track },
            cornerRadius: { value: 4 },
          },
        },
      },
      {
        type: "rect",
        from: { data: ds },
        encode: {
          update: {
            x: { scale: "x", field: categoryField },
            // Vega y grows downward: the bar runs from the value down to the
            // zero baseline. Values above axisMax clamp visually while the
            // label and tooltip keep the original value.
            y: { signal: `${plotY} + scale('y', ${value})` },
            y2: { value: plotY + plotHeight },
            width: { scale: "x", band: 1 },
            fill: fill(value),
            cornerRadius: { value: 4 },
            ...(tooltip ? { tooltip } : {}),
          },
        },
      },
      ...(e.showCategoryAxis
        ? ([
            {
              type: "text",
              from: { data: ds },
              encode: {
                update: {
                  x: { scale: "x", field: categoryField, band: 0.5 },
                  y: { value: plotY + plotHeight + 14 },
                  text: { signal: category },
                  align: { value: "center" },
                  baseline: { value: "top" },
                  fill: { value: labelColor },
                  fontSize: { value: e.labelFontSize },
                  limit: { value: catLimit },
                },
              },
            },
          ] as Mark[])
        : []),
      ...(e.categoryTitle && e.showCategoryAxis
        ? ([
            {
              type: "text",
              encode: {
                update: {
                  x: { value: plotX + plotWidth / 2 },
                  y: { value: plotY + plotHeight + catRowH + 9 },
                  text: { value: e.categoryTitle },
                  baseline: { value: "middle" },
                  align: { value: "center" },
                  fill: { value: labelColor },
                  fontSize: { value: e.labelFontSize },
                },
              },
            },
          ] as Mark[])
        : []),
      ...(e.labels
        ? [
            {
              type: "text",
              from: { data: ds },
              encode: {
                update:
                  e.labelPosition === "inside"
                    ? {
                        x: { scale: "x", field: categoryField, band: 0.5 },
                        y: {
                          signal: `${plotY} + scale('y', ${value}) + 12`,
                        },
                        text: { signal: label },
                        align: { value: "center" },
                        baseline: { value: "top" },
                        fill: { value: labelColor },
                        fontSize: { value: e.labelFontSize },
                      }
                    : {
                        x: { scale: "x", field: categoryField, band: 0.5 },
                        y: {
                          signal: `${plotY} + scale('y', ${value}) - 4`,
                        },
                        text: { signal: label },
                        align: { value: "center" },
                        baseline: { value: "bottom" },
                        fill: { value: labelColor },
                        fontSize: { value: e.labelFontSize },
                      },
              },
            } as Mark,
          ]
        : []),
      ...legendMarks(e, pal, e.height - e.padding.bottom - 8 - legendH),
    ],
  };
}

export function compile(
  p: Project,
  adapter: DataSourceAdapter = studioSources,
  allowIncomplete = false,
  esExport = false,
): Spec {
  const issues = exportIssues(p, esExport);
  if (!allowIncomplete && issues.length)
    throw new Error(
      "Finish chart setup before exporting:\n" + issues.join("\n"),
    );
  const pal = palette(p.canvas.background);
  const bars = p.elements.filter(
    (e): e is Bar => e.type === "bar" && !chartSetup(p, e as Bar, esExport),
  );
  const datasets: Record<string, unknown>[] = p.sources.map((s) =>
    adapter.compile(s, { esExport }),
  );
  const dsName = new Map<string, string>();
  for (const e of bars) {
    const ds = chartDataset(e);
    datasets.push(ds as unknown as Record<string, unknown>);
    dsName.set(e.id, ds.name);
  }
  // Binding pass: one helper dataset per pick, then marks reference them.
  // Helper names derive from element ids, so pasted copies (fresh ids)
  // can never collide with existing compiled names.
  const helpers: Record<string, unknown>[] = [];
  const helperFor = new Map<string, string>();
  const use = (elId: string, role: string, pick: DataPick): string => {
    const key = `${elId}::${role}`;
    let name = helperFor.get(key);
    if (!name) {
      name = `studio_${elId}_${helperFor.size}`;
      helperFor.set(key, name);
      helpers.push(
        bindingDataset(name, pick.dataset, pick) as unknown as Record<string, unknown>,
      );
    }
    return name;
  };
  const visOf = (e: Element): string | null => {
    const v = (e as { visibility?: Visibility }).visibility;
    if (!v || v.mode === "always") return null;
    return visibilitySignal(v, use(e.id, "vis", v.pick));
  };
  const bindOf = (e: Element): ElBind => {
    const vis = visOf(e);
    const b: ElBind = { vis };
    if (e.type === "text") {
      if (e.contentFrom)
        b.content = {
          helper: use(e.id, "content", e.contentFrom.pick),
          tv: e.contentFrom,
        };
      if (e.colorRules?.rules.length)
        b.colorRules = {
          helper: use(e.id, "color", e.colorRules.pick),
          pick: e.colorRules.pick,
          rules: e.colorRules.rules,
          def: e.colorRules.default,
        };
    }
    if (e.type === "rectangle" || e.type === "ellipse") {
      if (e.fillRules?.rules.length)
        b.colorRules = {
          helper: use(e.id, "fill", e.fillRules.pick),
          pick: e.fillRules.pick,
          rules: e.fillRules.rules,
          def: e.fillRules.default,
        };
      else if (e.fillFrom)
        b.fillFrom = { helper: use(e.id, "fill", e.fillFrom), pick: e.fillFrom };
      if (e.opacityMap)
        b.opacityMap = { helper: use(e.id, "opacity", e.opacityMap.pick), map: e.opacityMap };
    }
    if (e.type === "line") {
      if (e.strokeFrom)
        b.strokeFrom = { helper: use(e.id, "stroke", e.strokeFrom), pick: e.strokeFrom };
      if (e.widthMap)
        b.widthMap = { helper: use(e.id, "width", e.widthMap.pick), map: e.widthMap };
      if (e.opacityMap)
        b.opacityMap = { helper: use(e.id, "opacity", e.opacityMap.pick), map: e.opacityMap };
    }
    return b;
  };
  const marks = (parentId: string | null): Mark[] =>
    children(p, parentId)
      .filter((e) => e.visible && !(e.type === "bar" && chartSetup(p, e, esExport)))
      .map((e) => {
        // Editor groups compile to nested Vega groups with relative offsets,
        // so nesting is preserved in preview and export.
        if (e.type === "group")
          return {
            type: "group",
            encode: {
              update: {
                x: { value: e.x },
                y: { value: e.y },
                opacity: gatedOpacity({ value: 1 }, visOf(e)),
              },
            },
            marks: marks(e.id),
          };
        const b = bindOf(e);
        if (e.type === "bar") {
          const labelColor = e.labelColor || pal.label;
          const gridColor = e.gridColor || pal.grid;
          return e.orientation === "vertical"
            ? verticalChart(e, pal, dsName.get(e.id)!, labelColor, gridColor, resolvedRows(p, e.dataset).length)
            : horizontalChart(e, pal, dsName.get(e.id)!, labelColor, gridColor);
        }
        if (e.type === "rectangle") return rectMark(e, b);
        if (e.type === "ellipse") return ellipseMark(e, b);
        if (e.type === "line") return lineMark(e, b);
        return textMark(e, b);
      });
  // Marks first: binding helpers register while marks build.
  const topMarks = marks(null);
  return {
    $schema: "https://vega.github.io/schema/vega/v6.json",
    description: `${p.name} — ${esExport ? "Elasticsearch source" : "inline sample data"}`,
    width: p.canvas.width,
    height: p.canvas.height,
    padding: 0,
    autosize: "none",
    background: p.canvas.background,
    data: [...datasets, ...helpers] as unknown as Spec["data"],
    marks: topMarks,
  };
}
