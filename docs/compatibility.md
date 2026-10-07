# Kibana 9.2.3 compatibility

Verified against Elastic's **v9.2.3 tag**, retrieved 2026-09-21:

1. [Root package manifest](https://github.com/elastic/kibana/blob/v9.2.3/package.json) pins `vega` to **6.2.0** and `vega-lite` to 6.4.1. Vega Studio uses Vega directly; Vega-Lite is not a dependency.
2. [Tagged yarn.lock](https://github.com/elastic/kibana/blob/v9.2.3/yarn.lock) contains `vega@6.2.0` with resolved `version "6.2.0"`.
3. [Tagged Vega view implementation](https://github.com/elastic/kibana/blob/v9.2.3/src/platform/plugins/private/vis_types/vega/public/vega_view/vega_view.js) imports `View` and `parse` from `vega` and constructs a view from `parse(spec, undefined, { ast: true })`.

The application pins `vega: "6.2.0"`, emits the Vega v6 schema URL, uses standard Vega marks/scales and inline values, and explicitly sets `autosize: "none"` with numeric dimensions. Preview, generated artifacts, and export all use the same compiler. Inline export emits no network sources or Kibana macros. The Elasticsearch export option emits the configured Query DSL and optional dashboard placeholders described below; Studio itself never sends Elasticsearch requests.

The automated tests parse specifications and produce SVG with the pinned runtime; browser tests render the actual SVG preview. This establishes local Vega compatibility. **No Kibana 9.2.3 instance was available or tested.** Host-specific behavior, dashboard sizing/clipping, CSP, and deployment policy remain to be verified in a real instance. Fixed panel dimensions may require resizing the dashboard container.

## v1.1.0 additions, implemented and verified 2026-09-22 (unreleased)

Newly emitted Vega constructs, all standard Vega 6.2.0 (verified in the
installed `vega-scenegraph` sources and rendered by the pinned runtime in
tests):

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
offsets); see `docs/schema.md` for the corrected behavior note. The
historical "nested groups" limitation referred to arbitrary Vega group
features, not editor nesting.

## v1.2.0 Elasticsearch export (unreleased as a tag)

Export choices per panel: inline sample data (as before) or an
Elasticsearch Query DSL source. Each Elasticsearch dataset compiles to a
Kibana `url` object per the official Elastic Vega documentation
(retrieved 2026-09-22 for the 9.x docs):

- `index`: the configured index pattern.
- `body`: the configured Query DSL object.
- `%context%: true` when dashboard-filter integration is on.
- `%timefield%` set to the timestamp field when dashboard-time
  integration is on.
- `format: { property }` set to the response extraction path, sharing
  semantics with Studio's local fixture extraction.

Incompatible combinations are validated at export, following the docs:
a body `query` cannot combine with `%context%` or `%timefield%`, and
dashboard-time integration requires a timestamp field. Fixed panel
dimensions keep working because Kibana explicitly supports
`autosize: none` with pixel sizes.

Studio never connects to Elasticsearch: local preview renders stored
fixtures (or nothing), the export dialog labels preview provenance per
dataset, and incomplete live-export configuration blocks only the
Elasticsearch choice with reasons. **No Kibana 9.2.3 instance was
available or tested** — export structure is asserted by unit tests, not
by a live dashboard.

## Package-selection references

Official documentation checked before selecting pinned packages:

- [React with Vite](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite prerequisites](https://vite.dev/guide/) — Node 20.19+ or 22.12+; this workspace uses 22.22.2.
- [Tailwind Vite plugin](https://tailwindcss.com/docs/installation/using-vite)
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
- [Zustand](https://github.com/pmndrs/zustand)
- [Zod](https://zod.dev/)
- [Vitest](https://vitest.dev/guide/)
- [Playwright](https://playwright.dev/docs/intro)
- [Vega View lifecycle](https://vega.github.io/vega/docs/api/view/)

Exact installed versions are in `package.json`; transitive resolutions are recorded in `package-lock.json`.
