# Changelog

All notable user-facing changes to Vega Studio. `package.json` is the
application-version source of truth (currently `1.2.0`). Only implemented
changes appear here; planned work lives in `docs/roadmap.md`. The separate
identities are: application release (`package.json`), project document
schema (`src/model.ts`, currently `4`), Vega runtime (`6.2.0` pinned),
Kibana target (`9.2.3`).

## Unreleased — Properties panel

- Reviewed application-wide UI and added a searchable, registry-driven element
  picker, shared fields/sections/panel headers/icons, and accessible export tabs.
- Improved dialog navigation, action placement, source draft retention, and
  clipboard-error recovery. Refined Welcome and zoom-independent empty guidance.
- Documented extension patterns and the UI assessment in `docs/ui-patterns.md`.

- Replaced paired field grids with a single vertical stack throughout the
  inspector, including paint controls, data rules, dimensions, and layer actions.
- Reorganized every element inspector and canvas settings into consistent,
  keyboard-accessible sections, with a fixed selection header and layer actions.
- Split chart axes, grid, value labels, and colors into separate groups;
  separated visibility from data bindings and text content from typography.
- Added responsive field layouts across the 240–520px panel range, a 320px
  default width, and consistent spacing and controls in both themes. Existing
  saved panel widths are respected.
- Synchronized collapse-all with individual disclosures. Editing, history,
  grouping, bindings, color pickers, save/open, and export remain available.
- Fixed switching to a “between” data condition when no upper bound exists yet.

## [1.2.0] — Editor interaction & data-driven elements

Completed in the working tree; not tagged or published (no Git tags or
release dates are claimed in this workspace). This release ships the
previously unreleased v1.1.0 element/configuration scope below together
with the new v1.2.0 scope. Evidence: `docs/completion-1.2.0.md`,
`docs/releases/v1.2.0-plan.md`.

### Added (v1.1.0 scope, shipped)

- Enhanced text: system font families, alignment, vertical placement,
  line height, opacity, explicit multiline content.
- Enhanced rectangles: optional stroke (width, dash patterns), solid or no
  fill, opacity, corner radius.
- Ellipse/circle element with aspect lock, compiled to native Vega paths.
- Line element with editable endpoints, caps, dashes, exact numeric
  editing; zero width/height lines supported.
- Bar-chart configuration: horizontal/vertical orientation, padding,
  category spacing, per-axis visibility and titles, label size/color,
  grid, tick count, axis maximum, per-chart sorting, outside/inside value
  labels, number/percentage/bytes formats, tooltips, single/threshold
  colors, generated legend.
- Composition: categorized palette, sectioned inspector, multiselect
  align (6-way) and distribute, alignment guides, optional grid snap.
- Project document schema `3` with migration from versions 1–2; three new
  editable examples (shapes, bars, dashboard) with synthetic fixtures.

### Added (v1.2.0 scope)

- Full-window layout: editor and Welcome fit the viewport at 100% zoom
  (verified 1366×768 and 1920×1080); panels scroll internally; dialogs
  fit with internal scrolling.
- Live drag manipulation: the element's own rendering follows the
  pointer via transient previews (no per-move Vega rebuild); palette
  drag-to-create with placement ghost; Escape cancels.
- Copy/paste (Ctrl/Cmd+C/V) with versioned clipboard payload, group
  subtrees, fresh ids, cascade offsets, one-step undo, and explicit
  missing-dataset reporting.
- Threshold legends always show Healthy/Warning/Critical with
  settings-derived units and row packing inside element bounds.
- Theme-token selection styling; pointer-anchored Ctrl/Cmd+wheel zoom;
  Alt/Space temporary hand tool; custom grid (show/snap/spacing 1–200 px,
  separate guide toggle) stored as editor settings.
- Eight resize handles with aspect control, minimums, and proportional
  group scaling; endpoint handles retained for lines.
- Data-capable elements: shared binding model (fixed / field / reduction
  with match/latest/count/sum/average/min/max), conditional color rules,
  bounded numeric mappings, data-driven visibility — all compiled to Vega
  signals and transforms.
- Elasticsearch-ready sources: named datasets, Query DSL export with
  `%context%`/`%timefield%` integration and `format.property`
  extraction, response fixtures for local preview, dual inline/ES export
  choices with explicit blockers.
- Project document schema `4` with migration from versions 1–3; reactive
  example where every element reads one dataset.

## [1.0.0]

Foundation baseline, reconstructed from `docs/completion.md`. No release
date or Git tag is recorded in this workspace, so none is claimed here.

### Added

- React + TypeScript editor with Vega previews, editable text/rectangles/
  bar-chart groups, exact geometry, pointer move/resize, layers, alignment,
  history, viewport controls, validated sample data, project save/open,
  and inline Vega export against the pinned Vega 6.2.0 runtime.
