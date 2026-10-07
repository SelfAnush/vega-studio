# Element capability and configuration matrix

Every property below affects the exported Vega specification. There are no
preview-only controls. Vega constructs used (all standard Vega 6.2.0):
`text`, `rect`, `path` (ellipses), `rule` (lines, grid), `symbol` (legend),
`group` (charts, editor groups), `linear`/`band` scales, `collect`
per-chart sorting, `format` value signals, `tooltip` signals.

## Capability matrix

| Capability | Text | Rectangle | Ellipse | Line | Bar chart | Group |
| --- | --- | --- | --- | --- | --- | --- |
| Fill solid / none | — | both | both | — (stroke only) | single-color base | — |
| Stroke color / width / dash | — | yes | yes | yes (+ cap) | — | — |
| Opacity | yes | yes | yes | yes | — | — |
| Corner radius | — | yes | — (true ellipse) | — | 4 px fixed (bars/tracks) | — |
| Aspect lock (circle) | — | — | yes | — | — | — |
| Field bindings | bound content/colors | bound fill/opacity | bound fill/opacity | bound stroke/width/opacity | dataset + category + value | — |
| Corner resize | 8 handles (layout box; font unchanged) | 8 handles | 8 handles (aspect lock optional) | endpoint handles | 8 handles (relayout; data unchanged) | 8 handles (scales descendants proportionally) |
| Minimum size | 20 × 20 | 20 × 20 | 20 × 20 | endpoints must differ | 360 × 220 | 40 × 40 frame when empty |
| Tooltip | — | — | — | — | toggleable | — |
| Data visibility | rule-gated | rule-gated | rule-gated | rule-gated | via groups | rule-gated |

Every element type additionally supports the shared binding model
documented in `docs/bindings.md`: fixed values, field reads (match /
latest), reductions (count / sum / average / min / max), ordered
conditional rules, bounded numeric mappings, and data-driven visibility
— all compiled to Vega signals and transforms.

## Configuration reference

**Text** (`text` mark): font family (Studio Sans, Arial, Georgia, Courier
New, Verdana — system stacks, no downloads), size 8–160, regular/bold,
left/center/right alignment (anchors at the matching bounds edge), top /
middle / bottom placement within the bounds, line-height multiplier
0.8–3 (× font size, px in Vega), color, opacity. Content is literal text;
`\n` splits lines via Vega `lineBreak`. **Overflow: no wrapping** — each
line truncates with an ellipsis at the element width (`limit`). The
selection rectangle is always the layout bounds.

**Rectangle** (`rect` mark): solid fill or none (`transparent` in Vega —
never an invalid color), optional stroke with width and solid/dashed
(`[6,4]`)/dotted (`[2,3]`) patterns, opacity, corner radius.

**Ellipse** (`path` mark): two-arc SVG ellipse path, so arbitrary
width/height survive preview and export exactly. Same paint/stroke model
as rectangles plus an aspect lock that keeps resizing square.

**Line** (`rule` mark): start point (`x/y`) plus end-point offset
(`x2/y2`, may be zero or negative — never both zero). Horizontal lines
use `y2: 0`, vertical lines `x2: 0`. Color, width 0.5–50, dash, cap
(butt/round/square → canvas `lineCap` and SVG `stroke-linecap`), opacity.
Canvas shows start/end handles; Properties edits exact start/end
coordinates. Zero-size bounds get a 6 px pointer slop on canvas only —
exported coordinates are exact.

**Bar chart** (nested `group`): orientation horizontal/vertical
(transposed scales, same settings); chart padding (px inset on the plot);
category spacing via band padding; value labels outside (gutter/above) or
inside (bar end); axes show/hide each, optional titles, shared label size,
automatic-or-custom label color; grid toggle/color/width; tick count;
numeric maximum; category + value bindings with input/category/value
sorting; formats number/percent/bytes with decimals; tooltip toggle;
single/threshold color modes with warning/critical colors and a
generated-from-settings legend toggle.

**Percentage semantics**: the stored value is already a percentage — 42
displays as `42%`. Vega's d3 `%` formatter (×100) is never used.

**Above-maximum behavior**: the numeric scale clamps, so over-max bars end
at the axis edge, while labels and tooltips render the true stored value.

**Sorting**: each chart reads its own `data_<id>` dataset (a `filter` fork
plus an optional `collect` sort) sourced from the shared inline rows.
Shared data is never mutated and charts never share an ordering. Category
uniqueness is still enforced; no aggregation is introduced.

## Unsupported combinations

- Single-color mode ignores thresholds and hides the legend.
- A hidden threshold legend still leaves threshold bar colors in place.
- Inside value labels use the axis label color and may overlap short bars;
  prefer outside labels for dense charts.
- Vertical charts clip long category labels at a computed per-band limit;
  widen the chart for dense categories.
