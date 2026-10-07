# Kibana 9.2.3 compatibility

The export target is Kibana **9.2.3**, using Vega **6.2.0**. Runtime references:

1. [Root package manifest](https://github.com/elastic/kibana/blob/v9.2.3/package.json) pins `vega` to **6.2.0** and `vega-lite` to 6.4.1. Vega Studio uses Vega directly; Vega-Lite is not a dependency.
2. [Tagged yarn.lock](https://github.com/elastic/kibana/blob/v9.2.3/yarn.lock) contains `vega@6.2.0` with resolved `version "6.2.0"`.
3. [Tagged Vega view implementation](https://github.com/elastic/kibana/blob/v9.2.3/src/platform/plugins/private/vis_types/vega/public/vega_view/vega_view.js) imports `View` and `parse` from `vega` and constructs a view from `parse(spec, undefined, { ast: true })`.

The application pins `vega: "6.2.0"`, emits the Vega v6 schema URL, uses standard Vega marks/scales and inline values, and explicitly sets `autosize: "none"` with numeric dimensions. Preview, generated artifacts, and export all use the same compiler. Inline export emits no network sources or Kibana macros. The Elasticsearch export option emits the configured Query DSL and optional dashboard placeholders described below; Studio itself never sends Elasticsearch requests.

The automated tests parse specifications and produce SVG with the pinned runtime; browser tests render the actual SVG preview. These checks cover Vega rendering. **Live Kibana integration remains unverified.** Host-specific behavior, dashboard sizing/clipping, CSP, and deployment policy remain to be verified in a real instance. Fixed panel dimensions may require resizing the dashboard container.

## Vega output

The compiler emits these Vega constructs:

- `text`: `lineBreak: "\n"`, `lineHeight` (px), `align`, `baseline`
  (top/middle/bottom), `limit` (ellipsis truncation), `opacity`, `font`
  stacks of system fonts. No wrapping is exposed because Vega text does
  not wrap.
- `rect`: `fill`/`stroke` (`transparent` for "none"), `strokeWidth`,
  `strokeDash` (`[6,4]` dashed, `[2,3]` dotted), `opacity`, `cornerRadius`.
- `path`: two-arc SVG ellipse paths with the same paint model.
- `rule`: `x/y/x2/y2`, `strokeCap` (butt/round/square), `strokeDash`,
  `strokeOpacity`. Used for lines and grid.
- `symbol`: threshold legend dots (unchanged semantics).
- Dataflow per bar chart: `filter` (tuple-stream fork) + optional
  `collect` sort; `format` number signals plus string-built `%`/bytes
  labels (never d3 `%` scaling); `tooltip` signals. No `url` sources, no
  network, `autosize: "none"` retained.

Nested editor groups compile to nested Vega `group` marks (relative
offsets); see [schema](schema.md) for coordinate and nesting behavior.

## Elasticsearch export

Export choices per panel: inline sample data or an
Elasticsearch Query DSL source. Each Elasticsearch dataset compiles to a
Kibana `url` object with these settings:

- `index`: the configured index pattern.
- `body`: the configured Query DSL object.
- `%context%: true` when dashboard-filter integration is on.
- `%timefield%` set to the timestamp field when dashboard-time
  integration is on.
- `format: { property }` set to the response extraction path, sharing
  semantics with Studio's fixture extraction.

Incompatible combinations are validated at export, following the docs:
a body `query` cannot combine with `%context%` or `%timefield%`, and
dashboard-time integration requires a timestamp field. Fixed panel
dimensions keep working because Kibana explicitly supports
`autosize: none` with pixel sizes.

Studio never connects to Elasticsearch: the browser preview renders stored
fixtures (or nothing), the export dialog labels preview provenance per
dataset, and incomplete live-export configuration blocks only the
Elasticsearch choice with reasons. **Live Kibana integration remains unverified** — export structure is asserted by unit tests, not
by a live dashboard.

Exact dependency versions are in `package.json`; transitive resolutions are
recorded in `package-lock.json`.
