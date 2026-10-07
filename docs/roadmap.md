# Roadmap

This is an implementation checklist, not a publication record. Application
version is **1.2.0**, project schema is **4**. No public release or Git tag has
been verified. `[x]` means implemented and locally verified; `[ ]` means planned,
partial, unverified, or blocked, as explicitly described below.

## Implemented and verified locally

- [x] Text, rectangle, ellipse, and line elements with styling and exact geometry.
- [x] Horizontal and vertical bar charts with field bindings, sorting, axes,
  grid, labels, formatting, tooltips, thresholds, and generated legends.
- [x] Nested groups, multiselection, alignment, distribution, layer reorder,
  inherited locks, and visibility.
- [x] Direct move/resize, line endpoints, proportional group resize, palette
  drag/drop, gesture cancellation, and one-step gesture undo.
- [x] Copy/paste and duplicate with fresh IDs and dataset mismatch reporting.
- [x] Pan, pointer-anchored zoom, Fit, temporary hand tool, grid, and snapping.
- [x] Shared named datasets, field/reduction bindings, conditional colors,
  numeric mappings, and visibility conditions.
- [x] Inline JSON editing and per-source draft retention while the dialog is open.
- [x] Elasticsearch Query DSL **configuration and export**, including context/time
  options, validation, response extraction, and local fixture preview.
- [x] Project save/open, schema 1-3 migration to 4, validation, unsaved-work
  protection, and undo/redo.
- [x] Inline Vega export, local parse/render feedback, copy, and download.
- [x] Searchable element library; shared fields, sections, headers, icons, and
  keyboard-accessible export tabs.
- [x] Light/dark themes and desktop layout checks at 1024x768, 1366x768,
  and 1920x1080; vertically stacked Properties at widths 240-520px.
- [x] Five synthetic project/export sample pairs.

Evidence: `tests/model.test.ts`, `tests/groups.test.ts`,
`tests/editor-state.test.ts`, `tests/phase2a.test.ts`, `tests/v120.test.ts`,
`tests/bugfixes.test.ts`, and all suites in `tests/browser/`.
See [release verification](release-readiness.md) for command results and limits.

## Partial implementations and known limitations

- [ ] **Kibana integration - partial:** Query DSL export exists; testing inside
  a real Kibana 9.2.3 dashboard, CSP, time/filter behavior, and host sizing remain
  unverified. Studio does not connect to Elasticsearch.
- [ ] **Responsive dashboards - not implemented:** exports have fixed pixel
  dimensions; editor authoring requires at least 1024px desktop width.
- [ ] **Browser coverage - partial:** automated Chromium checks exist; Firefox,
  Safari/WebKit, and touch workflows are not verified.
- [ ] **Persistence - partial:** file save/open exists; automatic project recovery
  and browser autosave do not. Closing Data discards unapplied local drafts.
- [ ] **Text layout - limited:** explicit newlines and truncation work; automatic
  wrapping does not. Dense charts and inside labels may overlap.
- [ ] **Bundle optimization:** production build passes with a size advisory;
  Vega makes up much of the approximately 1.3 MB minified JavaScript bundle.
- [ ] **Accessibility audit - partial:** labeled controls, focus states, keyboard
  editing/tabs are covered; no full screen-reader or WCAG conformance audit.

## Proposed next elements (not implemented)

These priorities are a plan, not a commitment to a release number.

- [ ] KPI / metric with label, unit, and optional change indicator.
- [ ] Progress bar with target value.
- [ ] Rule-driven status indicator.
- [ ] Uploaded image / logo element.
- [ ] Line and area charts.
- [ ] Donut chart and gauge.
- [ ] Table, scatter plot, and heatmap.
- [ ] Dataset-driven repeated cards or rows.

## Later proposals (not implemented)

- [ ] Reusable user-defined components and templates.
- [ ] Advanced data transformations and aggregation.
- [ ] Arbitrary Vega import.
- [ ] Live data access, collaboration, or hosted accounts (requires separate scope).

## Public release gates

- [x] Reproducible local install, strict type checking, coverage gate, production
  build, and core workflow test suites are available.
- [x] Setup/configuration examples, contribution guidance, security guidance,
  changelog, and implementation evidence are documented.
- [x] MIT license selected by the maintainer and included in `LICENSE`.
- [ ] Repository destination and private security-reporting contact established.
- [ ] GitHub CI passes on the actual repository (workflow prepared, not run there).
- [ ] Final staged-file review and any history secret scan after repository creation.
- [ ] Public repository, version tag, and release published after final review.

Historical plans and completion records remain in `docs/releases/` and
`docs/completion*.md`; their old test counts describe earlier snapshots.
This checklist and the release-readiness report describe the current tree.
