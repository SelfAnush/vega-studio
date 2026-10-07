# Phase 2A completion report

> Implementation record for the planned **v1.1.0** release ("Phase 2A"
> was the former phase name for this element/configuration scope; see
> `docs/releases/v1.1.0-plan.md`). Original terminology below is
> preserved. Status: implemented and verified in the working tree,
> **unreleased** — `package.json` still declares `1.0.0` and no Git tag
> exists in this workspace.

Element library and visual configuration, built on the Phase 1
architecture (React + TypeScript + Vite, Zustand, Zod, Radix UI, Vega
6.2.0 pinned for Kibana 9.2.3). No dependencies added, none upgraded.

## Implemented elements and configurations

- **Text**: 5 system font families, size/weight, left/center/right,
  top/middle/bottom placement, line-height multiplier, color, opacity,
  explicit `\n` multiline. Overflow clips with an ellipsis at the element
  width (Vega `limit`); nothing wraps. Selection rectangle is the layout
  bounds.
- **Rectangle**: solid/none fill, optional stroke (width, solid/dashed/
  dotted), opacity, corner radius. "None" is an explicit Solid/None
  control, never an invalid color.
- **Ellipse**: independent width/height, aspect lock (circles), same paint
  model. Compiles to a native Vega `path` (two-arc ellipse), so arbitrary
  dimensions survive preview and export exactly.
- **Line**: start + relative end offset (zero/negative allowed; both zero
  rejected), color, width 0.5–50, dash, butt/round/square caps, opacity.
  Canvas endpoint handles plus exact start/end numeric editing. Compiles
  to a Vega `rule` with parent-local coordinates, so groups compose.
- **Bar charts** (extended, not duplicated): horizontal/vertical, chart
  padding, band padding, per-axis visibility + titles, label size,
  automatic/custom label and grid colors, grid toggle/width, tick count,
  axis maximum, input/category/value sorting inside per-chart
  `filter`+`collect` datasets (shared rows never mutated), outside/inside
  value labels, number/percent/bytes formats with decimals (42 → `42%`),
  tooltip toggle, single/threshold colors, generated legend toggle.
  Over-max values clamp visually; labels/tooltips keep true values.
- **Composition**: categorized palette, sectioned inspector (+ collapsible
  Advanced), shift-click multiselect, group/ungroup, 6-way canvas align,
  horizontal/vertical distribution (3+ layers), alignment guides, optional
  8 px grid snap. Selection roots prevent double transforms; locks and
  hidden-layer exclusion respected throughout. One gesture/action = one
  undo; Escape cancels cleanly; Vega view never rebuilds mid-gesture.
- **Registry** (`src/registry.ts`, React-free): type, display name,
  palette icon, compiled Vega construct, category, minimums,
  capabilities, inspector sections.

## Project compatibility

Schema **v3**. Versions 1–2 open via default-filling migration with
equivalent Phase 1 visuals (same gutters, band padding, thresholds;
only tick labels move 11 px → 12 px shared size). Invalid files never
replace the document. Correction: nested editor groups compile to nested
Vega groups (tested) — the old "nested groups" limitation meant
arbitrary Vega group features (see `docs/schema.md`).

## What was tested

- `npx tsc --noEmit` clean; `npm run build` succeeds (pre-existing Vega
  chunk-size advisory only).
- Vitest: 74/74 (44 pre-existing incl. 2 intentionally updated for v3:
  version gate, empty-group frame; 30 new in `tests/phase2a.test.ts`
  covering migration, round trips, ellipse/line validation, text/ellipse/
  line export, orientations, runtime-verified independent sorting,
  formats, legend sync, clamping, registry/palette, align/distribute/
  locks/undo, all four sample pairs).
- Coverage above the 80% gate on every metric (~97% lines).
- Playwright: 12/12 (9 pre-existing + 3 new workflows: style basics →
  group → save/open → export; vertical bars sorting/formats; align/
  distribute/undo/gesture-cancel). One real regression caught and fixed
  during development (duplicate Layout section for bars).
- Screenshots at 1600 × 1000 inspected (`basics`, `vertical-bars`,
  `arrange`, welcome light/dark, editor): no significant clipping,
  overlap, broken controls, or unreadable labels.
- Baseline before changes: TSC OK, build OK, 44/44 unit tests — no
  pre-existing failures.

## Remaining limitations

- No Kibana 9.2.3 instance available: exports are validated by local
  parse + SVG render only, not inside Kibana (dashboard sizing, CSP,
  deployment policy unverified).
- Inside value labels can overlap short bars; vertical charts clip long
  categories per band (widen the chart).
- Synthetic fixtures only; no Elasticsearch, backend, accounts,
  collaboration, AI, Vega import, responsive layout, or deployment.

## Suggested next increment

Line/area/scatter charts on the established registry + per-chart dataset
pattern, followed by KPI cards, progress bars, and gauges. No reusable
component system yet — the registry keeps adding types straightforward.
