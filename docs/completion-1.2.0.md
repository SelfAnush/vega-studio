# v1.2.0 completion report — editor interaction & data-driven elements

Completed in the working tree; `package.json` declares `1.2.0`. No tag,
publication, or release date is claimed. Pinned runtime `vega@6.2.0` and
Kibana target `9.2.3` unchanged; no dependency added or upgraded
(version metadata only).

## Request checklist

| # | Request | Implementation | Verification evidence |
| --- | --- | --- | --- |
| 2 | Full-window layout at 100% zoom | Viewport-fitted shell; internal panel scrolling; fitting dialogs; tightened Welcome (balanced columns, no filler height) | `v120.spec.ts` layout test at 1366×768 and 1920×1080: Create visible, zero page overflow |
| 3 | Direct manipulation + drag-to-create | Transient HTML/SVG previews with original masking (no per-move Vega rebuild); palette drop with ghost, coordinates, outside-cancel; click-to-add kept | Drop/move/Escape browser test; committed art equals preview (shared `compile`) |
| 4 | Copy/paste | Ctrl/Cmd+C/V in canvas and Layers; versioned payload, subtrees, fresh ids, repaired parents, 16 px cascade, one-step undo; system clipboard with session fallback; locks refuse with reasons; dangling datasets reported, never rebound | Unit (payload, subtree, remap, cascade, locks) + browser (paste, group paste, single undo, lock refusal) |
| 5 | Threshold legends | All three states always in threshold mode; units from `valueFormat`/`decimals` (42 → `42%`, bytes supported); row-packed layout inside bounds; both orientations; minimum size | Unit (units, wrapping, single/hidden off) + browser (percent legend, export has no overlays) |
| 6 | Selection styling | Subtle `accent-bg` row + inset accent indicator via theme tokens; states distinguishable; focus-visible kept; overlays are HTML and never enter Vega output | Screenshots inspected dark + light; export-structure test |
| 7 | Pointer-centered zoom | Analytic pan adjustment around the cursor; limits kept; pan never reset; only Ctrl/Cmd+wheel captured | Browser anchor test (corner tracks pointer within rounding) |
| 8 | Temporary hand | Alt-hold (AltGr-safe, input-safe) and Space fallback; grab/grabbing cursors; blur/cancel cleanup; viewport-only, no history | Unit-adjacent behavior + manual workflow; documented in `docs/shortcuts.md` as Studio behavior |
| 9 | Custom grid/snapping | Show, snap, 1–200 px spacing, separate guide toggle as editor settings (never dirty, never exported); shared canvas-pixel system; guides beat grid | Browser (grid render, spacing, snap-to-24 move) + unit `resizeBox`/`snapValue` paths |
| 10 | Eight resize handles | Corners/edges with correct cursors, zoom-scaled hit size, position+size math, minimums, no flipping, Shift aspect, Escape cancel, one undo; groups scale descendants (fonts/strokes unscaled, documented); lines keep endpoints; text boxes keep fonts; charts relayout only | Unit (`resizeBox`, `resizeGroup` incl. nesting/locks) + browser (8 handles, corner drag, undo) |
| 11 | Data-capable elements | Shared picks (match/latest/count/sum/average/min/max), ordered color rules, bounded numeric maps, visibility gates per element type; bar thresholds kept as preset; missing data → explicit fallbacks, never zero | Unit (validation, signals, runtime render of reactive values) + browser (bound text shows `100`) |
| 12 | Elasticsearch-ready sources | Named datasets; Query DSL `url` (`index`, `body`, `%context%`, `%timefield%`, `format.property`) per official Elastic docs; fixtures with shared extraction; dual export with explicit blockers; Studio never connects | Unit (url structure, placeholder rules, blockers, extraction) + browser (blocked → configured → valid export) |

## What was tested

- `npx tsc --noEmit` clean; `npm run build` succeeds (pre-existing Vega
  chunk-size advisory only).
- Vitest: 106/106 across 5 files (74 pre-existing, 32 new in
  `tests/v120.test.ts`).
- Coverage above the 80% gate on every metric.
- Playwright: 17/17 (12 pre-existing + 5 new workflows covering layout,
  drop/drag, copy/paste, legend/zoom/grid/resize, bindings/ES export).
- Five sample pairs parse + render under pinned Vega; screenshots at
  1600×1000 plus 1366×768/1920×1080 inspected in dark and light themes.
- Two pre-existing specs updated for intended changes only (schema v4
  version assertion; `resize-se` handle id). No thresholds lowered.

## Remaining limitations

- No Kibana 9.2.3 instance available: ES export structure is asserted by
  unit tests and local parsing, not by a live dashboard (sizing, CSP,
  dashboard-filter behavior unverified).
- Visibility bindings compile to transparency (elements stay in the
  scenegraph); group record-context is by shared dataset name, not
  scoped inheritance.
- Zoomed canvas regions can sit beneath side panels — pan or Fit to
  reach them (observed during testing).
- Synthetic fixtures only; no live connections, credentials, backends,
  accounts, collaboration, AI, Vega import, responsive layout, or
  deployment.

## Suggested next increment

v1.3.0 additional charts (line/area/scatter) on the registry + per-chart
dataset pattern, reusing the binding model; then v1.4.0 dashboard
components. See `docs/roadmap.md`.
