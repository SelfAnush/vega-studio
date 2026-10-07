# Sample-data provenance

All examples ship as editable `samples/*.project.json` files compiled
through the normal `compile()` path into `samples/*.vega.json` by
`npm run samples` (`scripts/samples.ts`). No example requires network
access at application runtime.

## Logstash queue usage (kept from the foundation baseline)

Hand-written synthetic snapshot (`host`, `pipeline`, `usage_pct`, combined
`label`). Unchanged semantics; migrated to schema v4 with equivalent
visuals.

## New v1.1.0 fixtures — synthetic

The new rows are **hand-written synthetic data**, shaped like web-log and
service-health records. They are not exports from Kibana sample datasets,
and nothing here claims otherwise.

- `endpointRows` (`src/examples.ts`): 5 endpoints with `requests` and
  `errors` counts. Drives the bars example: one horizontal chart
  (requests, value-descending, single color) and one vertical chart
  (errors, category-ascending, threshold colors) sharing the same source
  to demonstrate independent sorting and styling.
- `serviceRows`: 5 services with `load` percentages and `label`s. Drives
  the dashboard example with percentage formatting (`42.5` → `42.5%`).

Reference for the real datasets these resemble (not bundled, not
fetched — Elastic/Kibana licensing applies to the originals):

- Elastic Kibana sample data sets (flights, eCommerce, web logs):
  <https://github.com/elastic/kibana/tree/main/src/platform/plugins/shared/home/server/services/sample_data>
  (retrieved 2026-09-22 for reference only). Kibana is SSPL/Elastic
  License 2.0; no Kibana data or code is redistributed here.

## Normalization

None beyond construction: rows are stored inline as written. Category
fields must stay unique non-empty strings; value fields finite
non-negative numbers (see `validateProject`). Sorting, formatting, and
thresholds are presentation-only and never rewrite source rows.

## Examples

| File | Demonstrates |
| --- | --- |
| `samples/logstash.*` | Foundation panel, thresholds, percent-free labels |
| `samples/shapes.*` | Text (multiline, alignment), stroked rectangle, outlined circle, dashed connector line |
| `samples/bars.*` | Horizontal + vertical bars, same data, independent sort/style |
| `samples/dashboard.*` | Fixed-size panel: shapes, text, divider, status dot, percent-formatted threshold chart |
| `samples/reactive.*` | Text, rectangle, ellipse, line, group visibility, and chart styling reacting to one dataset (v1.2.0) |
