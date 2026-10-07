# Data binding and conditional styles

Every element type supports data-driven properties compiled to Vega
signals and transforms — nothing is decoration-only, and React never
bakes static colors for export. Fixed values remain available everywhere.

## Datasets

Elements bind to shared **named datasets** (`Data sources` dialog), never
to a hardcoded query per element:

- `inline`: rows stored in the project file.
- `elasticsearch`: index pattern, Query DSL body, extraction path,
  optional dashboard-filter (`%context%`) and dashboard-time
  (`%timefield%`) integration, plus a response fixture for local preview.
  Studio never queries Elasticsearch; without a fixture the preview
  renders no tuples.

Dangling references (e.g. after cross-project paste) are kept verbatim
and surface as setup warnings — Studio never silently rebinds them.
Deleting a dataset bound by any layer is refused with the user list.

## Resolution (picks)

- `match`: first row in dataset order with `String(row[field])` equal to
  the value. No match → null.
- `latest`: greatest timestamp (numbers numerically, strings
  lexicographically so ISO-8601 works); null/missing ignored; ties take
  the first row in dataset order.
- `reduce`: `count`, `sum`, `average`, `min`, `max` over finite numbers,
  ignoring the rest. Empty input → null.

Missing or null data is never coerced to zero: scalars evaluate to null
and each binding falls back explicitly (fixed content/color, numeric
fallback, or a chosen show/hide).

## Element behavior

- Text: bound content (numbers formatted, other scalars raw, null falls
  back to fixed content), conditional colors, visibility.
- Rectangle / ellipse: direct hex-from-field fill, conditional fill
  rules, bounded opacity mapping, visibility.
- Line: hex-from-field stroke, bounded width and opacity mappings,
  visibility.
- Bar chart: named dataset plus category/value bindings; the threshold UI
  stays as the approachable preset with existing boundary semantics
  (`critical` at `value ≥ critical`, `warning` at `value ≥ warning`).
- Group: data-driven visibility; children keep referencing datasets by
  name (no scoped inheritance).

## Conditional rules

Each rule list has one shared source and pick; rules carry an operator
(`==`, `!=`, `>`, `>=`, `<`, `<=`, inclusive `between`), threshold
value(s), and result color. **First matching rule wins**; otherwise the
default applies, including for missing data. Ordering operators coerce
numerically; equality compares strings (categorical support). Numeric
mappings declare dataMin < dataMax plus output bounds and a fallback, so
arbitrary data cannot produce invalid opacity or stroke widths.

## Field-name semantics

Vega field references treat dots/brackets as paths, so Studio escapes
them in scale domains and reads every other field literally via
`datum["dotted.name"]`. The same literal-key rule applies to data
extracted through `format.property` on Elasticsearch export.
