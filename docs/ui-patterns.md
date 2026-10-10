# UI components and extension patterns

Use the shared components in `src/ui.tsx` to keep new features consistent with
the editor. Properties use a single vertical column; both themes support desktop
windows from 1024px wide.

## Adding an element

1. Implement its model, validation, compiler, hierarchy/command behavior, and tests.
2. Add its capability definition and section names to `src/registry.ts`.
3. Add it to a palette category and provide its description; define variants
   there when one type has different creation presets. Do not add picker JSX
   to App. Group creation remains a Layers operation.
4. Add its icon to the exhaustive map in `src/elementIcons.ts`. Picker, Layers,
   and Properties consume this same map.
5. Compose its inspector from `src/ui.tsx` controls and SettingsSection.
   Keep fields in one vertical column, preserve visible and accessible labels,
   and group dependent controls under the setting that enables them.

The palette contains only implemented elements. The proposed KPI, gauge,
image, and other future elements are not implemented or advertised as available.

## Shared design rules

- Use existing color, border, radius, spacing, and focus tokens. Both themes
  must work; avoid fixed theme colors for application controls.
- Keep document mutations in existing validated commands/store operations.
  Search, section disclosure, theme, panel size, and grid preferences are UI state.
- Keep Properties vertical at every supported width (240–520px). Preserve its
  12px dropdown-arrow inset. Keep Grid & snapping in Canvas properties.
- Use PanelHeader for side panels, SettingsSection for disclosures, FormField
  for labeled controls and Field for inspector values. The LiveEditing provider
  enables immediate text, numeric, and color updates in Properties. Each focused
  input or color-picker session is one undo step; invalid drafts never enter the
  project. LiveInput and LiveTextarea retain focus while the preview updates.
- Use TabBar for tab navigation; connect its panel ID and labelled-by ID to the
  corresponding tabpanel. Arrow keys, Home, and End select and focus tabs.
- Dialogs use a fixed heading, a bounded scrolling body, and a visible action
  area. Keep validation near the relevant form, retaining entered values on error.
- Source drafts belong to an open data dialog. Apply commits the selected
  source; closing the dialog still discards unapplied drafts.
- Preserve accessible names, disabled states, focus indication, Escape behavior,
  pointer dragging, and keyboard alternatives. Do not reintroduce removed hints.

## Verification

`tests/browser/ui.spec.ts` covers searchable insertion, empty search, keyboard
tabs, source draft navigation, clipboard recovery, and screenshots of Welcome,
empty/populated editor, picker, data, Elasticsearch, and export at 1024×768,
1366×768, and 1920×1080 in both themes.

`tests/browser/properties.spec.ts` covers all element inspectors, panel widths,
vertical fields, collapse controls, bindings, and locks. Existing browser suites
cover save/open, exports, dragging, resizing, grouping, history, color pickers,
invalid files/data, and unsaved-work protection. Screenshots are generated under
`test-results`; inspect them when changing layout.

For integration limits, see [compatibility](compatibility.md).
