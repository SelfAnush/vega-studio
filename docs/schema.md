# Document schema and migration notes

Vega Studio projects are versioned JSON documents validated by Zod in
`src/model.ts`. The current version is **4** (v1.2.0 data sources and
bindings; the application version is separate — see [roadmap](roadmap.md)).

## Versions

| Version | Elements | Notes |
| --- | --- | --- |
| 1 | text, rectangle, bar; flat (no `parentId`) | Foundation original |
| 2 | + editor groups (`parentId`, nesting, locks inherit) | Groups compile to nested Vega groups |
| 3 | + ellipse, line; text typography; rectangle/ellipse stroke + optional fill; full bar configuration (orientation, sort, formats, axes, grid, legend, padding, tooltips) | v1.1.0 scope |
| 4 | + named `sources` (inline / Elasticsearch), per-element `dataset` binding, data picks/rules/visibility | v1.2.0 scope |

## Loading rules

- `openProject` accepts versions 1, 2, 3, and 4. Anything else (including raw
  Vega specifications) is rejected with an "Unsupported project version"
  message, and the current document is left untouched.
- Versions 1–3 upgrade through `migrateToV4`: the single inline source
  becomes `sources: [{ kind: "inline", name: "source", rows }]`, and every
  newer setting fills from Zod defaults — no geometry, data, or styling
  is rewritten.
- Invalid files (bad JSON, duplicate IDs, orphan parents, cycles, bad
  bindings, degenerate lines, invalid picks or mappings) throw an
  actionable error before replacing the document.

## Migration defaults (v1/v2 → v3)

Text: `fontFamily: "studio"`, `align: "left"`, `vertical: "top"`,
`lineHeight: 1.2`, `opacity: 1`.
Rectangle: `stroke: none`, `strokeWidth: 2`, `strokeDash: "solid"`.
Bar: `orientation: "horizontal"`, `sort: "input"`, `colorMode: "threshold"`,
`labelPosition: "outside"`, `valueFormat: "number"`, `decimals: 0`,
`tooltip: true`, `showValueAxis/showCategoryAxis/showGrid: true`,
titles empty, `labelFontSize: 12`, `labelColor/gridColor: ""` (automatic
contrast from the canvas background), `gridWidth: 1`, `tickCount: 5`,
`bandPadding: 0.38`, zero padding, `showLegend: true`.

These defaults reproduce the foundation visuals exactly: same gutters
(180 px categories, 40 px values), same 78 px bottom chrome, same band
padding, same threshold colors and legend. The only intentional delta is
axis tick labels moving from 11 px to the shared `labelFontSize` (12 px).

## Round trips

All settings persist across save/open: `tests/phase2a.test.ts` round-trips
the Logstash sample and every bundled example through `openProject`.
`newElement` always produces a valid v4 element, so palette creation,
duplication, and grouping never emit a document that fails validation.

## Actual behavior: nested groups

Editor groups **do** compile to nested Vega `group` marks with relative
`x/y` offsets (`src/compiler.ts` recurses through `children`), and this is
covered by `tests/groups.test.ts` ("round trips nested groups and renders
them as actual Vega groups"). The historical README line listing "nested
groups" as a limitation referred to arbitrary Vega group features (axes,
faceting, group-level scales), not editor-group nesting, which works in
preview and export. Lines also compose correctly: rule endpoints are
parent-local, so nested offsets apply automatically.
