# Vega Studio

[Open Vega Studio](https://vegastudio-app.vercel.app/)

A browser-based visual designer for Vega dashboards and Kibana panels. The element library covers styled text, rectangles, ellipses, lines, and horizontal/vertical bar charts with multiselect composition. The entire panel renders through Vega 6.2.0.

Current application version: **1.2.0**. See the [changelog](CHANGELOG.md) and [roadmap](docs/roadmap.md).

## Development setup

Use Node.js 22.12+ (verified with 22.22.2) and npm:

```sh
git clone https://github.com/SelfAnush/vega-studio.git
cd vega-studio
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No accounts, backend, external services, or live Elasticsearch access are required. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
npm run build
npm test
npm run test:coverage
npx playwright install chromium
npm run test:e2e
npm run test:production
npm run samples
npm run notices
```

Run `npm run preview` to check the production build. The production output is in `dist/`. Browser tests save initial and edited screenshots under `test-results/`. `npm run samples` regenerates the deliverable project/Vega pairs in `samples/` using the same compiler as the editor.

`npm run test:production` runs core editing/save/open/export workflows against
the built assets (run the build first). Builds include the project license and
third-party notices. Regenerate notices after changing dependencies. The GitHub
Actions workflow runs validation on Linux and provides a downloadable production build.

## Editing

- Palette (Basic: Text, Rectangle, Ellipse, Line; Charts: horizontal/vertical Bar chart). Select through the canvas or Layers. Properties are organized into Layout, Typography/Appearance, Endpoints, Data, Axes and labels, Thresholds, and Advanced sections. Inputs commit on blur or Enter.
- Text supports system font families, size/weight, left/center/right alignment, top/middle/bottom placement, line height, opacity, and explicit multiline content. Long lines clip with an ellipsis at the element width; text never wraps. See `docs/elements.md`.
- Rectangles and ellipses support solid or no fill, optional stroke (width, solid/dashed/dotted), opacity, corner radius (rectangles), and aspect lock (ellipses compile to native Vega paths, not approximations).
- Lines use editable start/endpoints (zero width/height allowed for horizontal/vertical lines), endpoint handles, caps, dashes, and exact numeric editing. Endpoints are stored relative to the line origin so grouping preserves them.
- Bar charts support horizontal/vertical orientation, padding, category spacing, per-axis visibility and titles, label size/color, grid, tick count, axis maximum, input/category/value sorting (per-chart, never mutating shared data), value labels outside/inside, number/percentage/bytes formats, tooltips, single/threshold colors, and a settings-generated legend. Stored 42 displays as 42%.
- Drag to move — the element's own rendering follows the pointer via a transient preview; the Vega view rebuilds once on release. Eight handles resize rectangles, ellipses, text boxes, charts (relayout only), and groups (proportional child scaling). Endpoint handles reshape lines. Alignment guides follow the pointer (guides beat grid to avoid jitter); canvas grid, spacing, and snapping live in Canvas properties under Grid & snapping (select Canvas in Layers); the footer also offers a snapping toggle. Each gesture is one undo entry. Escape or pointer cancellation discards it. Drop palette items directly onto the canvas; dropping outside cancels.
- Charts have a minimum size of 360 × 220. Dimensions do not change source data.
- Layer order is back-to-front in the project and top-to-bottom in the layer list. Up/down buttons change stacking. Locked layers cannot be moved, styled, deleted, duplicated, copied, hidden, or reordered; unlock explicitly to edit. Reordering cannot cross a locked layer. Hidden elements are never snapping targets.
- Shift-click multiselects. Selection roots drive group/ungroup, align (left/center/right/top/middle/bottom to canvas), and distribute (equal gaps, 3+ layers) — each one undo step, world-position preserving across mixed parent groups.
- Use the Hand tool (or hold Alt / Space for a temporary hand) to pan; use zoom buttons, pointer-anchored Ctrl/Cmd+wheel, and Fit to change the editor viewport. Viewport changes do not affect exported dimensions.
- Every element binds to shared named datasets: fixed values, field reads, reductions, conditional colors, bounded mappings, visibility gates — see `docs/bindings.md`.
- Ctrl/Cmd+Z: undo; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: redo; Ctrl/Cmd+C/V: copy/paste; Ctrl/Cmd+D: duplicate; Ctrl/Cmd+G / Shift+G: group/ungroup; Delete/Backspace: delete; arrows: nudge (Shift = 10 pixels); V/H: select/pan. Shortcuts do not intercept input, select, textarea, or dialog editing. Ctrl/Cmd+S saves the project. Full list: `docs/shortcuts.md`.

## Data and files

Sample data is an inline JSON array (Logstash queues, endpoints, service loads). Chart category bindings require nonempty unique strings; value bindings require finite non-negative numbers. Available fields must have a consistent type across every row. Values above the axis maximum are visually clamped while the numeric label retains the original value. Warning applies at `value >= warning`; critical applies at `value >= critical` (threshold mode). Thresholds require `0 <= warning < critical <= axis maximum`.

Save downloads the complete version 4 project. Open accepts versions 1–4 (older projects migrate with equivalent visuals; see `docs/schema.md`) and validates schema, IDs, data, and chart bindings before replacing the document. An invalid file leaves the current project intact; replacing unsaved work prompts first. The saved indicator refers to the last downloaded/opened project, not browser persistence. Reloading starts the welcome screen; unsaved changes trigger the browser's leave warning. Undo history is limited to 100 edits and is not stored in project files.

Export offers read-only Vega JSON, copy, download, and in-browser validation and rendering feedback, with two choices: **inline sample data** or an **Elasticsearch Query DSL source** (index, body, dashboard-filter/time integration, response extraction, fixture preview — Studio never connects). In Kibana, create a Vega visualization, replace its specification, click Update, and save to a dashboard. This output is **fixed-size**, not automatically responsive to the dashboard container. See [compatibility evidence](docs/compatibility.md).

## Architecture

| Concern | Source |
| --- | --- |
| Serializable versioned document, Zod validation, sample | `src/model.ts` |
| Typed element registry (display, limits, capabilities, palette) | `src/registry.ts` |
| Bundled example projects and synthetic fixtures | `src/examples.ts` |
| Pure document-to-Vega conversion and source adapter | `src/compiler.ts` |
| Commands, snapshot history, selection and viewport state | `src/store.ts` |
| Vega view rendering and lifecycle | `src/VegaRenderer.tsx` |
| HTML selection/gesture overlays and viewport | `src/Canvas.tsx` |
| Exact property editing | `src/Properties.tsx` |
| Project actions, layers, shortcuts | `src/App.tsx` |
| Radix dialogs, sample data, validated export | `src/Dialogs.tsx` |

Model and compiler do not import React. Stable IDs identify layers; array order specifies stacking. Fixed color properties use `{ kind: 'fixed', value }`; field bindings use `{ kind: 'field', field }`. Preview and export both call `compile`. The `DataSourceAdapter` interface isolates inline-data compilation for future source types. Draft pointer state is separate from the document: pointer moves never rebuild a Vega view. Committed changes rebuild the view; cleanup finalizes the previous view and its listeners. React runs in Strict Mode.

Further documentation: [changelog](CHANGELOG.md), [roadmap](docs/roadmap.md), [release notes](docs/releases/v1.2.0.md), [shortcuts](docs/shortcuts.md), [data binding](docs/bindings.md), [schema and migration](docs/schema.md), [element matrix](docs/elements.md), [sample data](docs/sample-data.md), [compatibility](docs/compatibility.md).

## Verification and scope

Vitest covers project round trips, invalid versions/data, field discovery, compiler output, threshold boundaries, SVG rendering, field-name escaping, locked edits, and history. Playwright covers a real edit → save/open → export workflow, drag/resize and undo, lock behavior, and invalid files/data. Live Kibana integration remains unverified; see the compatibility guide for supported export behavior.

Desktop layout requires at least 1024 CSS pixels; 1440 or wider is recommended. Long category labels are clipped to their allotted width. Canvas dimensions are 400–4000 × 300–4000, up to 100 layers and 1000 sample rows. Very dense charts may require larger groups to keep labels legible. The Vega runtime accounts for most of the production bundle size. No arbitrary Vega import, live data fetching, or auto-layout is included (Elasticsearch export is configuration-only; Studio never connects). Editor groups nest and export as nested Vega groups; arbitrary Vega group features (faceting, group-level scales) are out of scope.

Future elements and integrations are listed with Markdown checkboxes in the [roadmap](docs/roadmap.md). Planned and partial features remain unchecked; no future release date or version is promised.

## Resources

- [Configuration examples and static hosting](docs/configuration.md)
- [Contribution guide](CONTRIBUTING.md)
- [Security and reporting](SECURITY.md)
- [UI extension patterns](docs/ui-patterns.md)

## License

Vega Studio is licensed under the [MIT License](LICENSE).
Third-party packages retain their own licenses; see
[third-party notices](THIRD_PARTY_NOTICES.md). Synthetic sample provenance is
documented in [sample data](docs/sample-data.md).
