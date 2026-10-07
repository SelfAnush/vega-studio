import {
  Field,
  Select,
  Check,
  PanelHeader,
  SettingsSection as InspectorSection,
} from "./ui";
import { ELEMENT_ICONS } from "./elementIcons";
import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  SlidersHorizontal,
  LayoutTemplate,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useEditor } from "./store";
import {
  availableFields,
  datasetNames,
  sourceByName,
  paint,
  none,
  FONT_FAMILIES,
  type Element,
  type FillProp,
  type Bar,
} from "./model";
import { chartSetup } from "./model";
import {
  PickEditor,
  ColorRulesEditor,
  NumMapEditor,
  VisibilityEditor,
  FormatEditor,
  freshPick,
} from "./DataEditors";
import { ancestors, isLocked, subtreeLocked } from "./hierarchy";
import { alignRoots, distribute, reparent, ungroup } from "./commands";

/** Solid-or-none paint control. The color button keeps the plain label
 * (e.g. "Fill") so existing workflows keep working; the style select is
 * what switches between solid and none. */
function Paint({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FillProp;
  onChange: (value: FillProp) => void;
}) {
  return (
    <div className="paint-controls">
      <Select
        label={`${label} style`}
        value={value.kind}
        options={[
          { value: "fixed", label: "Solid" },
          { value: "none", label: "None" },
        ]}
        onChange={(v) => onChange(v === "none" ? none() : paint("#5965dd"))}
      />
      {value.kind === "fixed" && (
        <Field
          label={label}
          type="color"
          value={value.value}
          onChange={(v) => onChange(paint(v))}
        />
      )}
    </div>
  );
}

/** Automatic-or-custom color: empty string means contrast from background. */
function AutoColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="paint-controls">
      <Select
        label={`${label} mode`}
        value={value === "" ? "auto" : "custom"}
        options={[
          { value: "auto", label: "Automatic" },
          { value: "custom", label: "Custom" },
        ]}
        onChange={(v) => onChange(v === "auto" ? "" : "#43516b")}
      />
      {value !== "" && (
        <Field label={label} type="color" value={value} onChange={onChange} />
      )}
    </div>
  );
}

const ALIGN_BUTTONS = [
  { label: "Align left", Icon: AlignLeft, side: 0 },
  { label: "Align center", Icon: AlignCenter, side: 1 },
  { label: "Align right", Icon: AlignRight, side: 2 },
  { label: "Align top", Icon: AlignStartVertical, side: 3 },
  { label: "Align middle", Icon: AlignCenterVertical, side: 4 },
  { label: "Align bottom", Icon: AlignEndVertical, side: 5 },
];

export function Properties({
  onError,
  duplicate,
  remove,
}: {
  onError: (s: string) => void;
  duplicate: () => void;
  remove: () => void;
}) {
  const { project, selected, selection, edit, commit, select } = useEditor();
  const e = project.elements.find((e) => e.id === selected);
  const locked = e ? isLocked(project, e.id) : false;
  const panelRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    const panel = panelRef.current!;
    const syncSections = () =>
      setExpanded(!!panel.querySelector("details[open]"));
    panel.addEventListener("toggle", syncSections, true);
    syncSections();
    return () => panel.removeEventListener("toggle", syncSections, true);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const SelectionIcon = e ? ELEMENT_ICONS[e.type] : LayoutTemplate;
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [e?.id]);
  const panelWidth = useEditor((s) => s.propertiesWidth);
  const view = useEditor();
  const attempt = (action: () => void) => {
    try {
      action();
      onError("");
    } catch (err) {
      onError((err as Error).message);
    }
  };
  const change = (p: Partial<Element>) => {
    if (e)
      try {
        edit(e.id, p);
        onError("");
      } catch (err) {
        onError((err as Error).message);
      }
  };
  const num = (
    label: string,
    value: number,
    key: string,
    min = 0,
    max = 4000,
    step = 1,
  ) => (
    <Field
      key={`${e?.id}-${key}-${value}`}
      label={label}
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(v) => change({ [key]: Number(v) })}
    />
  );
  const arrange = (ids: string[]) => (
    <div className="alignment">
      {ALIGN_BUTTONS.map(({ label, Icon, side }) => (
        <button
          key={label}
          aria-label={label}
          title={`${label} to canvas`}
          onClick={() => attempt(() => commit(alignRoots(project, ids, side)))}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
  return (
    <aside
      className="properties"
      aria-label="Properties"
      ref={panelRef}
      style={{ width: panelWidth }}
    >
      <PanelHeader title="Properties" icon={SlidersHorizontal}>
        <button
          className="icon-button"
          aria-label={
            expanded ? "Collapse all sections" : "Expand all sections"
          }
          title={expanded ? "Collapse all sections" : "Expand all sections"}
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            panelRef.current?.querySelectorAll("details").forEach((d) => {
              d.open = next;
            });
          }}
        >
          {expanded ? (
            <ChevronsDownUp size={15} />
          ) : (
            <ChevronsUpDown size={15} />
          )}
        </button>
      </PanelHeader>
      <div className="property-intro">
        <span className="selection-symbol">
          <SelectionIcon size={20} aria-hidden="true" />
        </span>
        <div className="selection-description">
          <h2 title={e?.name ?? "Canvas"}>
            {selection.length > 1
              ? `${selection.length} layers selected`
              : (e?.name ?? "Canvas")}
          </h2>
          <p>
            {e
              ? `${e.type === "bar" ? "Bar chart" : e.type.charAt(0).toUpperCase() + e.type.slice(1)}${selection.length > 1 ? " · Editing active layer" : " · Layer properties"}`
              : "Size and background"}
          </p>
        </div>
        {locked && <LockKeyhole size={15} aria-label="Locked" />}
      </div>
      {locked && (
        <p className="inspector-lock-note">
          <LockKeyhole size={14} />
          Unlock this layer in Layers to edit it.
        </p>
      )}
      <div className="inspector-scroll" ref={scrollRef}>
        {e ? (
          <>
            <fieldset
              disabled={locked}
              className="inspector-fields"
              key={e.type}
            >
              <InspectorSection title="Layer">
                <div className="field-stack layer-identity">
                  <Field
                    key={e.id + e.name}
                    label="Layer name"
                    value={e.name}
                    onChange={(name) => change({ name })}
                  />
                  <label className="field">
                    <span>Move to</span>
                    <select
                      aria-label="Move to group"
                      value={e.parentId ?? ""}
                      onChange={(event) =>
                        attempt(() =>
                          commit(
                            reparent(
                              project,
                              selection,
                              event.target.value || null,
                            ),
                          ),
                        )
                      }
                    >
                      <option value="">Canvas (outside groups)</option>
                      {project.elements
                        .filter(
                          (g) =>
                            g.type === "group" &&
                            g.id !== e.id &&
                            !ancestors(project, g.id).some((a) =>
                              selection.includes(a.id),
                            ) &&
                            !selection.includes(g.id),
                        )
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {e.type === "group" && (
                  <button
                    onClick={() =>
                      attempt(() => {
                        commit(ungroup(project, e.id));
                        select(null);
                      })
                    }
                  >
                    Ungroup layers
                  </button>
                )}
              </InspectorSection>
              {selection.length > 1 && (
                <InspectorSection title="Arrange">
                  <p className="section-help">
                    Align to the canvas or distribute with equal gaps. One
                    action, one undo step.
                  </p>
                  {arrange(selection)}
                  <div className="distribute-actions">
                    <button
                      onClick={() =>
                        attempt(() =>
                          commit(distribute(project, selection, "x")),
                        )
                      }
                    >
                      Distribute horizontally
                    </button>
                    <button
                      onClick={() =>
                        attempt(() =>
                          commit(distribute(project, selection, "y")),
                        )
                      }
                    >
                      Distribute vertically
                    </button>
                  </div>
                </InspectorSection>
              )}
              {e.type !== "line" && e.type !== "bar" && (
                <InspectorSection title="Layout">
                  <div className="field-stack">
                    {num("X", e.x, "x", -4000)}
                    {num("Y", e.y, "y", -4000)}
                    {e.type !== "group" &&
                      "width" in e &&
                      num("Width", e.width, "width", 20)}
                    {e.type !== "group" &&
                      "height" in e &&
                      num("Height", e.height, "height", 20)}
                  </div>
                  {e.type === "group" && (
                    <p className="section-help">
                      Group origin, relative to its parent. Children move
                      together; their sizes stay fixed.
                      {subtreeLocked(project, e.id)
                        ? " Unlock all children to move this group."
                        : ""}
                    </p>
                  )}
                  {arrange([e.id])}
                </InspectorSection>
              )}
              {e.type === "text" && (
                <>
                  <InspectorSection title="Content">
                    <label className="field">
                      <span>Content</span>
                      <textarea
                        aria-label="Content"
                        key={e.id + e.content}
                        defaultValue={e.content}
                        rows={3}
                        onBlur={(e2) => {
                          if (e2.target.value !== e.content)
                            change({ content: e2.target.value });
                        }}
                      />
                    </label>
                    <p className="section-help">
                      Line breaks create new lines. Long lines clip with an
                      ellipsis at the element width — text never wraps.
                    </p>
                  </InspectorSection>
                  <InspectorSection title="Typography">
                    <div className="field-stack">
                      {num("Font size", e.fontSize, "fontSize", 8, 160)}
                      <label className="field">
                        <span>Weight</span>
                        <select
                          aria-label="Weight"
                          value={e.weight}
                          onChange={(event) =>
                            change({
                              weight: event.target.value as "normal" | "bold",
                            })
                          }
                        >
                          <option value="normal">Regular</option>
                          <option value="bold">Bold</option>
                        </select>
                      </label>
                    </div>
                    <Select
                      label="Font family"
                      value={e.fontFamily}
                      options={FONT_FAMILIES.map((f) => ({
                        value: f,
                        label:
                          f === "studio"
                            ? "Studio Sans"
                            : f === "arial"
                              ? "Arial"
                              : f === "georgia"
                                ? "Georgia"
                                : f === "mono"
                                  ? "Courier New"
                                  : "Verdana",
                      }))}
                      onChange={(v) =>
                        change({
                          fontFamily: v as (typeof FONT_FAMILIES)[number],
                        })
                      }
                    />
                    <div className="field-stack">
                      <Select
                        label="Text alignment"
                        value={e.align}
                        options={[
                          { value: "left", label: "Left" },
                          { value: "center", label: "Center" },
                          { value: "right", label: "Right" },
                        ]}
                        onChange={(v) =>
                          change({ align: v as "left" | "center" | "right" })
                        }
                      />
                      <Select
                        label="Vertical placement"
                        value={e.vertical}
                        options={[
                          { value: "top", label: "Top" },
                          { value: "middle", label: "Middle" },
                          { value: "bottom", label: "Bottom" },
                        ]}
                        onChange={(v) =>
                          change({ vertical: v as "top" | "middle" | "bottom" })
                        }
                      />
                    </div>
                    {num(
                      "Line height",
                      e.lineHeight,
                      "lineHeight",
                      0.8,
                      3,
                      0.1,
                    )}
                  </InspectorSection>
                  <InspectorSection title="Appearance">
                    <Field
                      label="Text color"
                      type="color"
                      value={e.color.value}
                      onChange={(v) => change({ color: paint(v) })}
                    />
                    {num("Opacity", e.opacity, "opacity", 0, 1, 0.05)}
                  </InspectorSection>
                  <InspectorSection title="Data & rules">
                    <div className="binding-group">
                      <Check
                        label="Bind content to data"
                        checked={!!e.contentFrom}
                        onChange={(on) =>
                          change(
                            on
                              ? {
                                  contentFrom: {
                                    pick: { ...freshPick(project), field: "" },
                                    format: "number",
                                    decimals: 0,
                                  },
                                }
                              : { contentFrom: undefined },
                          )
                        }
                      />
                      {e.contentFrom && (
                        <>
                          <PickEditor
                            label="Content"
                            value={e.contentFrom.pick}
                            project={project}
                            onChange={(pick) =>
                              change({
                                contentFrom: { ...e.contentFrom!, pick },
                              })
                            }
                          />
                          <FormatEditor
                            label="Content"
                            format={e.contentFrom.format}
                            decimals={e.contentFrom.decimals}
                            onChange={(format, decimals) =>
                              change({
                                contentFrom: {
                                  ...e.contentFrom!,
                                  format,
                                  decimals,
                                },
                              })
                            }
                          />
                          <p className="section-help">
                            Missing data falls back to the fixed content above.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="binding-group">
                      <Check
                        label="Conditional colors"
                        checked={!!e.colorRules}
                        onChange={(on) =>
                          change(
                            on
                              ? {
                                  colorRules: {
                                    pick: freshPick(project),
                                    rules: [],
                                    default: e.color.value,
                                  },
                                }
                              : { colorRules: undefined },
                          )
                        }
                      />
                      {e.colorRules && (
                        <>
                          <ColorRulesEditor
                            label="Text color"
                            value={e.colorRules}
                            project={project}
                            onChange={(colorRules) => change({ colorRules })}
                            onRemove={() => change({ colorRules: undefined })}
                          />
                          <Field
                            label="Default color"
                            type="color"
                            value={e.colorRules.default}
                            onChange={(v) =>
                              change({
                                colorRules: { ...e.colorRules!, default: v },
                              })
                            }
                          />
                        </>
                      )}
                    </div>
                  </InspectorSection>
                </>
              )}
              {(e.type === "rectangle" || e.type === "ellipse") && (
                <>
                  <InspectorSection title="Appearance">
                    <Paint
                      label="Fill"
                      value={e.fill}
                      onChange={(fill) => change({ fill })}
                    />
                    <Paint
                      label="Stroke"
                      value={e.stroke}
                      onChange={(stroke) => change({ stroke })}
                    />
                    {e.stroke.kind === "fixed" && (
                      <div className="field-stack">
                        {num(
                          "Stroke width",
                          e.strokeWidth,
                          "strokeWidth",
                          1,
                          20,
                        )}
                        <Select
                          label="Dash pattern"
                          value={e.strokeDash}
                          options={[
                            { value: "solid", label: "Solid" },
                            { value: "dashed", label: "Dashed" },
                            { value: "dotted", label: "Dotted" },
                          ]}
                          onChange={(v) =>
                            change({
                              strokeDash: v as "solid" | "dashed" | "dotted",
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="field-stack">
                      {num("Opacity", e.opacity, "opacity", 0, 1, 0.05)}
                      {e.type === "rectangle" &&
                        num("Corner radius", e.radius, "radius", 0, 200)}
                    </div>
                    {e.type === "ellipse" && (
                      <Check
                        label="Lock aspect ratio (circle)"
                        checked={e.lockAspect}
                        onChange={(lockAspect) => change({ lockAspect })}
                      />
                    )}
                  </InspectorSection>
                  <InspectorSection title="Data & rules">
                    <div className="binding-group">
                      <Select
                        label="Fill mode"
                        value={
                          e.fillRules ? "rules" : e.fillFrom ? "field" : "fixed"
                        }
                        options={[
                          { value: "fixed", label: "Fixed fill" },
                          { value: "field", label: "Color from data field" },
                          { value: "rules", label: "Conditional rules" },
                        ]}
                        onChange={(v) =>
                          change(
                            v === "rules"
                              ? {
                                  fillFrom: undefined,
                                  fillRules: {
                                    pick: freshPick(project),
                                    rules: [],
                                    default:
                                      e.fill.kind === "fixed"
                                        ? e.fill.value
                                        : "#5965dd",
                                  },
                                }
                              : v === "field"
                                ? {
                                    fillRules: undefined,
                                    fillFrom: freshPick(project),
                                  }
                                : { fillRules: undefined, fillFrom: undefined },
                          )
                        }
                      />
                      {e.fillFrom && !e.fillRules && (
                        <>
                          <PickEditor
                            label="Fill color"
                            value={e.fillFrom}
                            project={project}
                            showField={false}
                            onChange={(fillFrom) => change({ fillFrom })}
                          />
                          <p className="section-help">
                            The field must hold hex colors; anything else falls
                            back to the fixed fill.
                          </p>
                        </>
                      )}
                      {e.fillRules && (
                        <>
                          <ColorRulesEditor
                            label="Fill"
                            value={e.fillRules}
                            project={project}
                            onChange={(fillRules) => change({ fillRules })}
                            onRemove={() => change({ fillRules: undefined })}
                          />
                          <Field
                            label="Default fill"
                            type="color"
                            value={e.fillRules.default}
                            onChange={(v) =>
                              change({
                                fillRules: { ...e.fillRules!, default: v },
                              })
                            }
                          />
                        </>
                      )}
                    </div>
                    <div className="binding-group">
                      <Check
                        label="Map opacity from data"
                        checked={!!e.opacityMap}
                        onChange={(on) =>
                          change(
                            on
                              ? {
                                  opacityMap: {
                                    pick: freshPick(project),
                                    dataMin: 0,
                                    dataMax: 100,
                                    outMin: 0,
                                    outMax: 1,
                                    fallback: 1,
                                  },
                                }
                              : { opacityMap: undefined },
                          )
                        }
                      />
                      {e.opacityMap && (
                        <NumMapEditor
                          label="Opacity"
                          value={e.opacityMap}
                          project={project}
                          lo={0}
                          hi={1}
                          onChange={(opacityMap) => change({ opacityMap })}
                          onRemove={() => change({ opacityMap: undefined })}
                        />
                      )}
                    </div>
                  </InspectorSection>
                </>
              )}
              {e.type === "line" && (
                <>
                  <InspectorSection title="Endpoints">
                    <p className="section-help">
                      Start is the line origin; end offsets may be zero or
                      negative. Drag the endpoint handles on canvas.
                    </p>
                    <div className="field-stack">
                      {num("Start X", e.x, "x", -4000)}
                      {num("Start Y", e.y, "y", -4000)}
                      <Field
                        key={`${e.id}-x2-${e.x + e.x2}`}
                        label="End X"
                        type="number"
                        value={e.x + e.x2}
                        onChange={(v) => change({ x2: Number(v) - e.x })}
                      />
                      <Field
                        key={`${e.id}-y2-${e.y + e.y2}`}
                        label="End Y"
                        type="number"
                        value={e.y + e.y2}
                        onChange={(v) => change({ y2: Number(v) - e.y })}
                      />
                    </div>
                  </InspectorSection>
                  <InspectorSection title="Appearance">
                    <Field
                      label="Line color"
                      type="color"
                      value={e.color.value}
                      onChange={(v) => change({ color: paint(v) })}
                    />
                    <div className="field-stack">
                      {num(
                        "Stroke width",
                        e.strokeWidth,
                        "strokeWidth",
                        0.5,
                        50,
                        0.5,
                      )}
                      <Select
                        label="Dash pattern"
                        value={e.strokeDash}
                        options={[
                          { value: "solid", label: "Solid" },
                          { value: "dashed", label: "Dashed" },
                          { value: "dotted", label: "Dotted" },
                        ]}
                        onChange={(v) =>
                          change({
                            strokeDash: v as "solid" | "dashed" | "dotted",
                          })
                        }
                      />
                    </div>
                    <Select
                      label="Cap style"
                      value={e.cap}
                      options={[
                        { value: "butt", label: "Butt" },
                        { value: "round", label: "Round" },
                        { value: "square", label: "Square" },
                      ]}
                      onChange={(v) =>
                        change({ cap: v as "butt" | "round" | "square" })
                      }
                    />
                    {num("Opacity", e.opacity, "opacity", 0, 1, 0.05)}
                  </InspectorSection>
                  <InspectorSection title="Data & rules">
                    <div className="binding-group">
                      <Check
                        label="Stroke color from data"
                        checked={!!e.strokeFrom}
                        onChange={(on) =>
                          change(
                            on
                              ? { strokeFrom: freshPick(project) }
                              : { strokeFrom: undefined },
                          )
                        }
                      />
                      {e.strokeFrom && (
                        <>
                          <PickEditor
                            label="Stroke color"
                            value={e.strokeFrom}
                            project={project}
                            showField={false}
                            onChange={(strokeFrom) => change({ strokeFrom })}
                          />
                          <p className="section-help">
                            The field must hold hex colors; anything else falls
                            back to the fixed color.
                          </p>
                        </>
                      )}
                    </div>
                    <div className="binding-group">
                      <Check
                        label="Map stroke width from data"
                        checked={!!e.widthMap}
                        onChange={(on) =>
                          change(
                            on
                              ? {
                                  widthMap: {
                                    pick: freshPick(project),
                                    dataMin: 0,
                                    dataMax: 100,
                                    outMin: 1,
                                    outMax: 8,
                                    fallback: e.strokeWidth,
                                  },
                                }
                              : { widthMap: undefined },
                          )
                        }
                      />
                      {e.widthMap && (
                        <NumMapEditor
                          label="Stroke width"
                          value={e.widthMap}
                          project={project}
                          lo={0.5}
                          hi={50}
                          onChange={(widthMap) => change({ widthMap })}
                          onRemove={() => change({ widthMap: undefined })}
                        />
                      )}
                    </div>
                    <div className="binding-group">
                      <Check
                        label="Map opacity from data"
                        checked={!!e.opacityMap}
                        onChange={(on) =>
                          change(
                            on
                              ? {
                                  opacityMap: {
                                    pick: freshPick(project),
                                    dataMin: 0,
                                    dataMax: 100,
                                    outMin: 0,
                                    outMax: 1,
                                    fallback: 1,
                                  },
                                }
                              : { opacityMap: undefined },
                          )
                        }
                      />
                      {e.opacityMap && (
                        <NumMapEditor
                          label="Opacity"
                          value={e.opacityMap}
                          project={project}
                          lo={0}
                          hi={1}
                          onChange={(opacityMap) => change({ opacityMap })}
                          onRemove={() => change({ opacityMap: undefined })}
                        />
                      )}
                    </div>
                  </InspectorSection>
                </>
              )}
              {e.type === "bar" && (
                <>
                  <InspectorSection title="Layout">
                    <div className="field-stack">
                      {num("X", e.x, "x", -4000)}
                      {num("Y", e.y, "y", -4000)}
                      {num("Width", e.width, "width", 360)}
                      {num("Height", e.height, "height", 220)}
                    </div>
                    <Select
                      label="Orientation"
                      value={e.orientation}
                      options={[
                        { value: "horizontal", label: "Horizontal" },
                        { value: "vertical", label: "Vertical" },
                      ]}
                      onChange={(v) =>
                        change({
                          orientation: v as "horizontal" | "vertical",
                        })
                      }
                    />
                    {arrange([e.id])}
                  </InspectorSection>
                  <InspectorSection title="Data & rules">
                    <p className="section-help">
                      {chartSetup(project, e) ??
                        "Fields connected to your data."}
                    </p>
                    <Select
                      label="Dataset"
                      value={e.dataset}
                      options={datasetNames(project).map((d) => ({
                        value: d,
                        label: d,
                      }))}
                      onChange={(dataset) => change({ dataset })}
                    />
                    {!sourceByName(project, e.dataset) && (
                      <p className="notice">
                        Dataset “{e.dataset}” is missing here. Pasted references
                        are kept, never silently rebound.
                      </p>
                    )}
                    {(["category", "value"] as const).map((key, i) => (
                      <label className="field" key={key}>
                        <span>
                          {i === 0 ? "Category field" : "Numeric value field"}{" "}
                          <small aria-hidden="true">ƒ</small>
                        </span>
                        <select
                          aria-label={
                            i === 0 ? "Category field" : "Numeric value field"
                          }
                          value={e[key].field}
                          onChange={(event) =>
                            change({
                              [key]: {
                                kind: "field",
                                field: event.target.value,
                              },
                            })
                          }
                        >
                          <option value="">Choose a field…</option>
                          {availableFields(
                            project,
                            i === 0 ? "string" : "number",
                            e.dataset,
                          ).map((field) => (
                            <option key={field}>{field}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <Select
                      label="Sort order"
                      value={e.sort}
                      options={[
                        { value: "input", label: "Input order" },
                        { value: "category-asc", label: "Category A–Z" },
                        { value: "category-desc", label: "Category Z–A" },
                        { value: "value-asc", label: "Value ascending" },
                        { value: "value-desc", label: "Value descending" },
                      ]}
                      onChange={(v) =>
                        change({
                          sort: v as Bar["sort"],
                        })
                      }
                    />
                    <p className="section-help">
                      Sorting happens inside this chart only; shared data and
                      other charts keep their order.
                    </p>
                  </InspectorSection>
                  <InspectorSection title="Axes">
                    <div className="field-stack">
                      <Check
                        label="Show value axis"
                        checked={e.showValueAxis}
                        onChange={(showValueAxis) => change({ showValueAxis })}
                      />
                      <Check
                        label="Show category axis"
                        checked={e.showCategoryAxis}
                        onChange={(showCategoryAxis) =>
                          change({ showCategoryAxis })
                        }
                      />
                    </div>
                    <div className="field-stack">
                      <Field
                        key={`${e.id}-value-title-${e.valueTitle}`}
                        label="Value axis title"
                        value={e.valueTitle}
                        onChange={(valueTitle) => change({ valueTitle })}
                      />
                      <Field
                        key={`${e.id}-category-title-${e.categoryTitle}`}
                        label="Category axis title"
                        value={e.categoryTitle}
                        onChange={(categoryTitle) => change({ categoryTitle })}
                      />
                    </div>
                    <div className="field-stack">
                      {num(
                        "Label size",
                        e.labelFontSize,
                        "labelFontSize",
                        8,
                        24,
                      )}
                      {num("Tick count", e.tickCount, "tickCount", 2, 10)}
                    </div>
                    <AutoColor
                      label="Label color"
                      value={e.labelColor}
                      onChange={(labelColor) => change({ labelColor })}
                    />
                    {num("Axis maximum", e.axisMax, "axisMax", 1, 1000000)}
                    <p className="section-help">
                      Values above the maximum clamp visually; labels and
                      tooltips keep the original value.
                    </p>
                  </InspectorSection>
                  <InspectorSection title="Chart grid">
                    <div className="field-stack">
                      <Check
                        label="Show grid"
                        checked={e.showGrid}
                        onChange={(showGrid) => change({ showGrid })}
                      />
                      {num("Grid width", e.gridWidth, "gridWidth", 0.5, 4, 0.5)}
                    </div>
                    <AutoColor
                      label="Grid color"
                      value={e.gridColor}
                      onChange={(gridColor) => change({ gridColor })}
                    />
                  </InspectorSection>
                  <InspectorSection title="Bars & value labels">
                    <div className="field-stack">
                      {num(
                        "Category spacing",
                        e.bandPadding,
                        "bandPadding",
                        0,
                        0.9,
                        0.05,
                      )}
                      <Check
                        label="Show value labels"
                        checked={e.labels}
                        onChange={(labels) => change({ labels })}
                      />
                    </div>
                    {e.labels && (
                      <div className="field-stack">
                        <Select
                          label="Value label position"
                          value={e.labelPosition}
                          options={[
                            { value: "outside", label: "Outside" },
                            { value: "inside", label: "Inside" },
                          ]}
                          onChange={(v) =>
                            change({
                              labelPosition: v as "outside" | "inside",
                            })
                          }
                        />
                        <Select
                          label="Value format"
                          value={e.valueFormat}
                          options={[
                            { value: "number", label: "Number" },
                            { value: "percent", label: "Percentage" },
                            { value: "bytes", label: "Bytes" },
                          ]}
                          onChange={(v) =>
                            change({
                              valueFormat: v as Bar["valueFormat"],
                            })
                          }
                        />
                      </div>
                    )}
                    {e.labels && (
                      <>
                        {num("Decimal places", e.decimals, "decimals", 0, 5)}
                        {e.valueFormat === "percent" && (
                          <p className="section-help">
                            Percentage shows the stored value with a % sign: 42
                            displays as 42%.
                          </p>
                        )}
                      </>
                    )}
                  </InspectorSection>
                  <InspectorSection title="Colors & thresholds">
                    <Select
                      label="Color mode"
                      value={e.colorMode}
                      options={[
                        { value: "threshold", label: "Threshold colors" },
                        { value: "single", label: "Single color" },
                      ]}
                      onChange={(v) =>
                        change({ colorMode: v as "single" | "threshold" })
                      }
                    />
                    <Field
                      label="Bar color"
                      type="color"
                      value={e.color.value}
                      onChange={(v) => change({ color: paint(v) })}
                    />
                    {e.colorMode === "threshold" && (
                      <>
                        <p className="section-help">
                          Bands escalate upward. Healthy is the base state —
                          every value below the warning level — so it has no
                          threshold of its own.
                        </p>
                        <div className="field-stack">
                          <div className="field">
                            <span>Healthy below</span>
                            <div className="static-field">&lt; {e.warning}</div>
                          </div>
                          <Field
                            label="Healthy color"
                            type="color"
                            value={e.healthyColor?.value ?? e.color.value}
                            onChange={(v) => change({ healthyColor: paint(v) })}
                          />
                          {num(
                            "Warning at",
                            e.warning,
                            "warning",
                            0,
                            e.critical,
                          )}
                          <Field
                            label="Warning color"
                            type="color"
                            value={e.warningColor.value}
                            onChange={(v) => change({ warningColor: paint(v) })}
                          />
                          {num(
                            "Critical at",
                            e.critical,
                            "critical",
                            e.warning,
                            e.axisMax,
                          )}
                          <Field
                            label="Critical color"
                            type="color"
                            value={e.criticalColor.value}
                            onChange={(v) =>
                              change({ criticalColor: paint(v) })
                            }
                          />
                        </div>
                        <Check
                          label="Show legend"
                          checked={e.showLegend}
                          onChange={(showLegend) => change({ showLegend })}
                        />
                      </>
                    )}
                  </InspectorSection>
                  <InspectorSection title="Advanced" initialOpen={false}>
                    <div className="field-stack">
                      {(["top", "right", "bottom", "left"] as const).map(
                        (side) => (
                          <Field
                            key={`${e.id}-pad-${side}-${e.padding[side]}`}
                            label={`Padding ${side}`}
                            type="number"
                            value={e.padding[side]}
                            min={0}
                            max={80}
                            onChange={(v) =>
                              change({
                                padding: { ...e.padding, [side]: Number(v) },
                              })
                            }
                          />
                        ),
                      )}
                    </div>
                    <Check
                      label="Show tooltips"
                      checked={e.tooltip}
                      onChange={(tooltip) => change({ tooltip })}
                    />
                  </InspectorSection>
                </>
              )}
              {e.type !== "bar" && (
                <InspectorSection title="Visibility">
                  <VisibilityEditor
                    value={e.visibility}
                    project={project}
                    onChange={(visibility) => change({ visibility })}
                  />
                </InspectorSection>
              )}
            </fieldset>
          </>
        ) : null}
        {!e && (
          <>
            <InspectorSection title="Canvas">
              <div className="field-stack">
                {(["width", "height"] as const).map((key) => (
                  <Field
                    key={key + project.canvas[key]}
                    label={`Canvas ${key}`}
                    type="number"
                    value={project.canvas[key]}
                    min={key === "width" ? 400 : 300}
                    max={4000}
                    onChange={(v) => {
                      try {
                        commit({
                          ...project,
                          canvas: { ...project.canvas, [key]: Number(v) },
                        });
                        onError("");
                      } catch (err) {
                        onError((err as Error).message);
                      }
                    }}
                  />
                ))}
              </div>
              <Field
                label="Background"
                type="color"
                value={project.canvas.background}
                onChange={(background) =>
                  commit({
                    ...project,
                    canvas: { ...project.canvas, background },
                  })
                }
              />
            </InspectorSection>
            <InspectorSection title="Grid & snapping">
              <Check
                label="Show grid"
                checked={view.gridVisible}
                onChange={view.toggleGridVisible}
              />
              <Check
                label="Snap to grid"
                checked={view.snap}
                onChange={view.toggleSnap}
              />
              <Field
                label="Grid spacing"
                type="number"
                value={view.gridSpacing}
                min={1}
                max={200}
                onChange={(value) => view.setGridSpacing(Number(value))}
              />
              <p className="section-help">
                Spacing in canvas pixels, from 1 to 200.
              </p>
              <Check
                label="Alignment guides"
                checked={view.guidesSnap}
                onChange={view.toggleGuidesSnap}
              />
              <p className="section-help">
                Guides take priority when snapping. These view settings are not
                included in your export.
              </p>
            </InspectorSection>
          </>
        )}
      </div>
      {e ? (
        <div className="inspector-actions">
          <button disabled={locked} onClick={duplicate}>
            <Copy size={15} />
            Duplicate{selection.length > 1 ? ` (${selection.length})` : ""}
          </button>
          <button
            disabled={locked}
            className="inspector-delete"
            aria-label="Delete layer"
            onClick={remove}
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      ) : (
        <div className="inspector-hint">
          Select a layer on the canvas to edit its properties.
        </div>
      )}
    </aside>
  );
}
