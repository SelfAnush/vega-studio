# UI review and extension patterns

The editor supports desktop windows from 1024px wide. Review covered Welcome,
the application header and toolbar, element picker, Layers, canvas, Properties,
color pickers, data sources, and export in dark and light themes.

## Findings and changes

| Area | Finding | Implemented response |
| --- | --- | --- |
| Element picker | Hard-coded items and duplicated drag handlers make new elements costly; a growing menu is hard to scan. | Registry-derived groups and variants, search, descriptions, bounded scrolling, keyboard insertion, and shared drag handlers. |
| Navigation | Home and New competed visually; tool buttons did not expose their selected state. | Compact Home action, explicit pressed states and shortcut titles for tools, named toolbar region. |
| Layers and Properties | Independent icon mappings and header markup could drift as types grow. | Shared exhaustive element icon map and PanelHeader. Existing reorder, nesting, locks, selection, and vertical Properties controls remain. |
| Forms | Repeated field and disclosure markup encouraged inconsistent spacing and behavior. | Shared FormField, Field, Select, Check, and SettingsSection, used across Properties, data editors, dialogs, and Welcome. |
| Data sources | Long configuration forms competed with navigation and actions; changing sources discarded unfinished inputs. | Grouped query, dashboard context, and local preview; bounded source rail; visible dialog header and sticky actions; per-source drafts retained while the dialog is open. |
| Export | Tabs had no arrow-key behavior; a clipboard failure disabled download. | Shared keyboard TabBar with linked tabpanel; copy feedback separated from export validity. |
| Welcome | Dense example previews clipped at shorter heights, and hidden line breaks joined words. | Corrected preview sizing and whitespace; consistent field wrapper and clearer example separation. |
| Canvas | Empty-state guidance scaled down with the artboard. | Workspace-level empty state that remains readable at every zoom. |

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
  for controlled inputs, and Field for blur-committed inspector values.
- Use TabBar for tab navigation; connect its panel ID and labelled-by ID to the
  corresponding tabpanel. Arrow keys, Home, and End select and focus tabs.
- Dialogs use a fixed heading, a bounded scrolling body, and a visible action
  area. Keep validation near the relevant form, retaining entered values on error.
- Source drafts are local to an open data dialog. Apply commits the selected
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

No live Elasticsearch or Kibana validation is claimed. The desktop minimum
remains 1024px; mobile authoring is not introduced by this review.
