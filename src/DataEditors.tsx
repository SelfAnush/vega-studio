import { FormField } from "./ui";
import {
  availableFields,
  datasetNames,
  type DataPick,
  type ColorRules,
  type NumMap,
  type Visibility,
  type ValueFormat,
  VALUE_FORMATS,
  COMPARE_OPS,
  PICK_MODES,
  REDUCE_OPS,
} from "./model";
import { neutralPick } from "./model";
import type { Project } from "./model";
import { ColorPicker } from "./ColorPicker";

/** Plain-language names for the comparison operators, so the condition reads
 *  as a sentence: "When value is at least [90]". Keys are the stored operator
 *  values from COMPARE_OPS. */
const OP_LABELS: Record<string, string> = {
  "==": "is",
  "!=": "is not",
  ">": "is above",
  ">=": "is at least",
  "<": "is below",
  "<=": "is at most",
  between: "is between",
};

/** A valid-by-default pick for newly enabled bindings: first dataset,
 * reduce over the first numeric field (or a match fallback). Guarantees
 * the enabling commit passes validation whenever the data allows it. */
export function freshPick(project: Project): DataPick {
  const ds = datasetNames(project)[0] ?? "source";
  const nums = availableFields(project, "number", ds);
  const strs = availableFields(project, "string", ds);
  return {
    ...neutralPick(),
    dataset: ds,
    mode: "reduce",
    matchField: strs[0] ?? "",
    // A reduction other than "count" needs a field, and a blank project has no
    // numeric fields yet. Picking "sum" there made every attempt to enable a
    // binding or a rule throw during validation, so the control silently
    // reverted and the user could not get started. "count" needs no field.
    op: nums[0] ? "sum" : "count",
    reduceField: nums[0] ?? "",
    field: nums[0] ?? strs[0] ?? "value",
  };
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="field-stack">{children}</div>;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return <FormField label={text}>{children}</FormField>;
}

/** Free text that stays a string unless it parses as a finite number. */
export function parseScalarInput(text: string): string | number {
  const t = text.trim();
  if (t === "") return "";
  const n = Number(t);
  return Number.isFinite(n) ? n : text;
}

/** Dataset + record/reduction selection shared by every binding. */
export function PickEditor({
  label,
  value,
  project,
  onChange,
  showField = true,
}: {
  label: string;
  value: DataPick;
  project: Project;
  onChange: (pick: DataPick) => void;
  showField?: boolean;
}) {
  const set = (p: Partial<DataPick>) => onChange({ ...value, ...p });
  const names = datasetNames(project);
  return (
    <div className="pick-editor">
      <Label text={`${label} · dataset`}>
        <select
          aria-label={`${label} dataset`}
          value={value.dataset}
          onChange={(e) => set({ dataset: e.target.value })}
        >
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          {!names.includes(value.dataset) && (
            <option value={value.dataset}>{value.dataset} (missing)</option>
          )}
        </select>
      </Label>
      <Label text="This number comes from">
        <select
          aria-label={`${label} record selection`}
          value={value.mode}
          onChange={(e) => set({ mode: e.target.value as DataPick["mode"] })}
        >
          {PICK_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "match"
                ? "The row where a field matches"
                : m === "latest"
                  ? "The most recent row"
                  : "One number for the whole dataset"}
            </option>
          ))}
        </select>
      </Label>
      {value.mode === "match" && (
        <Row>
          <Label text="Match field">
            <input
              aria-label={`${label} match field`}
              key={value.matchField}
              defaultValue={value.matchField}
              onBlur={(e) => {
                if (e.target.value !== value.matchField)
                  set({ matchField: e.target.value });
              }}
            />
          </Label>
          <Label text="Match value">
            <input
              aria-label={`${label} match value`}
              key={String(value.matchValue)}
              defaultValue={String(value.matchValue)}
              onBlur={(e) => {
                if (e.target.value !== String(value.matchValue))
                  set({ matchValue: parseScalarInput(e.target.value) });
              }}
            />
          </Label>
        </Row>
      )}
      {value.mode === "latest" && (
        <Label text="Timestamp field">
          <input
            aria-label={`${label} timestamp field`}
            key={value.timestampField}
            defaultValue={value.timestampField}
            onBlur={(e) => {
              if (e.target.value !== value.timestampField)
                set({ timestampField: e.target.value });
            }}
          />
        </Label>
      )}
      {value.mode === "reduce" && (
        <Row>
          <Label text="Reduction">
            <select
              aria-label={`${label} reduction`}
              value={value.op}
              onChange={(e) => set({ op: e.target.value as DataPick["op"] })}
            >
              {REDUCE_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </Label>
          {value.op !== "count" && (
            <Label text="Reduce field">
              <select
                aria-label={`${label} reduce field`}
                value={value.reduceField}
                onChange={(e) => set({ reduceField: e.target.value })}
              >
                <option value="">Choose…</option>
                {availableFields(project, "number", value.dataset).map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Label>
          )}
        </Row>
      )}
      {showField && value.mode !== "reduce" && (
        <Label text="Value field">
          <input
            aria-label={`${label} value field`}
            key={value.field}
            defaultValue={value.field}
            onBlur={(e) => {
              if (e.target.value !== value.field)
                set({ field: e.target.value });
            }}
          />
        </Label>
      )}
      {showField && value.mode === "reduce" && (
        <p className="section-help">Reductions output the aggregate `value`.</p>
      )}
    </div>
  );
}

/** Ordered conditional colors with a default. First match wins. */
export function ColorRulesEditor({
  label,
  value,
  project,
  onChange,
  onRemove,
}: {
  label: string;
  value: ColorRules;
  project: Project;
  onChange: (rules: ColorRules) => void;
  onRemove: () => void;
}) {
  const set = (p: Partial<ColorRules>) => onChange({ ...value, ...p });
  return (
    <div className="data-editor">
      <PickEditor
        label={label}
        value={value.pick}
        project={project}
        showField={false}
        onChange={(pick) => set({ pick })}
      />
      {value.rules.map((r, i) => (
        <div key={i} className="rule-card">
          <div className="rule-card-head">
            <span className="rule-card-title">Condition {i + 1}</span>
            <ColorPicker
              label={`${label} rule ${i + 1} color`}
              value={r.color.value}
              onChange={(hex) =>
                set({
                  rules: value.rules.map((x, j) =>
                    j === i
                      ? { ...x, color: { kind: "fixed", value: hex } }
                      : x,
                  ),
                })
              }
            />
            <button
              aria-label={`Remove ${label} rule ${i + 1}`}
              className="icon-button"
              onClick={() =>
                set({ rules: value.rules.filter((_, j) => j !== i) })
              }
            >
              ×
            </button>
          </div>
          <div className="rule-card-body">
            <Label text="When value is">
              <select
                aria-label={`${label} rule ${i + 1} operator`}
                value={r.operator}
                onChange={(e) => {
                  const rules = value.rules.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          operator: e.target.value as typeof x.operator,
                          ...(e.target.value === "between" &&
                          typeof x.value2 !== "number"
                            ? {
                                value2:
                                  typeof x.value === "number" ? x.value : 0,
                              }
                            : {}),
                        }
                      : x,
                  );
                  set({ rules });
                }}
              >
                {COMPARE_OPS.map((op) => (
                  <option key={op} value={op}>
                    {OP_LABELS[op] ?? op}
                  </option>
                ))}
              </select>
            </Label>
            <Label text={r.operator === "between" ? "From" : "Value"}>
              <input
                aria-label={`${label} rule ${i + 1} value`}
                key={String(r.value)}
                defaultValue={String(r.value)}
                onBlur={(e) => {
                  if (e.target.value !== String(r.value)) {
                    const rules = value.rules.map((x, j) =>
                      j === i
                        ? { ...x, value: parseScalarInput(e.target.value) }
                        : x,
                    );
                    set({ rules });
                  }
                }}
              />
            </Label>
            {r.operator === "between" && (
              <Label text="To">
                <input
                  aria-label={`${label} rule ${i + 1} upper bound`}
                  key={String(r.value2 ?? "")}
                  defaultValue={String(r.value2 ?? "")}
                  onBlur={(e) => {
                    const rules = value.rules.map((x, j) =>
                      j === i
                        ? { ...x, value2: parseScalarInput(e.target.value) }
                        : x,
                    );
                    set({ rules });
                  }}
                />
              </Label>
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          disabled={value.rules.length >= 8}
          onClick={() =>
            set({
              rules: [
                ...value.rules,
                {
                  operator: ">=",
                  value: 0,
                  color: { kind: "fixed", value: "#e8b65c" },
                },
              ],
            })
          }
        >
          Add condition
        </button>
        <button onClick={onRemove}>Use one color instead</button>
      </div>
      <p className="section-help">
        Conditions are checked top to bottom and the first match wins.
        Everything else uses the default below. If the dataset has no matching
        value, the default is used - never blank.
      </p>
    </div>
  );
}

/** Bounded data → style mapping with an explicit fallback. */
export function NumMapEditor({
  label,
  value,
  project,
  lo,
  hi,
  onChange,
  onRemove,
}: {
  label: string;
  value: NumMap;
  project: Project;
  lo: number;
  hi: number;
  onChange: (map: NumMap) => void;
  onRemove: () => void;
}) {
  const set = (p: Partial<NumMap>) => onChange({ ...value, ...p });
  const num = (text: string, v: number, key: keyof NumMap, step = 1) => (
    <label className="field" key={`${text}-${v}`}>
      <span>{text}</span>
      <input
        aria-label={`${label} ${text}`}
        type="number"
        defaultValue={v}
        step={step}
        onBlur={(e) => {
          if (Number(e.target.value) !== v)
            set({ [key]: Number(e.target.value) } as Partial<NumMap>);
        }}
      />
    </label>
  );
  return (
    <div className="data-editor">
      <PickEditor
        label={label}
        value={value.pick}
        project={project}
        showField={false}
        onChange={(pick) => set({ pick })}
      />
      <div className="field-stack">
        {num("Data min", value.dataMin, "dataMin")}
        {num("Data max", value.dataMax, "dataMax")}
        {num("Output min", value.outMin, "outMin", 0.05)}
        {num("Output max", value.outMax, "outMax", 0.05)}
      </div>
      {num("Missing-data fallback", value.fallback, "fallback", 0.05)}
      <button onClick={onRemove}>Use fixed value</button>
      <p className="section-help">
        Output stays within {lo}–{hi}; data outside the range clamps.
      </p>
    </div>
  );
}

/** Data-driven visibility gate. */
export function VisibilityEditor({
  value,
  project,
  onChange,
}: {
  value: Visibility;
  project: Project;
  onChange: (v: Visibility) => void;
}) {
  const set = (p: Partial<Visibility>) => onChange({ ...value, ...p });
  return (
    <div className="data-editor">
      <Label text="Visibility">
        <select
          aria-label="Visibility"
          value={value.mode}
          onChange={(e) => {
            const mode = e.target.value as Visibility["mode"];
            set(
              mode === "rule" ? { mode, pick: freshPick(project) } : { mode },
            );
          }}
        >
          <option value="always">Always visible</option>
          <option value="rule">From data rule</option>
        </select>
      </Label>
      {value.mode === "rule" && (
        <>
          <PickEditor
            label="Visibility"
            value={value.pick}
            project={project}
            showField={false}
            onChange={(pick) => set({ pick })}
          />
          <Row>
            <Label text="Operator">
              <select
                aria-label="Visibility operator"
                value={value.operator}
                onChange={(e) =>
                  set({
                    operator: e.target.value as Visibility["operator"],
                    ...(e.target.value === "between" &&
                    typeof value.value2 !== "number"
                      ? {
                          value2:
                            typeof value.value === "number" ? value.value : 0,
                        }
                      : {}),
                  })
                }
              >
                {COMPARE_OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Value">
              <input
                aria-label="Visibility value"
                key={String(value.value)}
                defaultValue={String(value.value)}
                onBlur={(e) => {
                  if (e.target.value !== String(value.value))
                    set({ value: parseScalarInput(e.target.value) });
                }}
              />
            </Label>
          </Row>
          {value.operator === "between" && (
            <Label text="Upper bound">
              <input
                aria-label="Visibility upper bound"
                key={String(value.value2 ?? "")}
                defaultValue={String(value.value2 ?? "")}
                onBlur={(e) =>
                  set({ value2: parseScalarInput(e.target.value) })
                }
              />
            </Label>
          )}
          <Row>
            <Label text="When matched">
              <select
                aria-label="When matched"
                value={value.whenTrue}
                onChange={(e) =>
                  set({ whenTrue: e.target.value as Visibility["whenTrue"] })
                }
              >
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </Label>
            <Label text="When data missing">
              <select
                aria-label="When data missing"
                value={value.onMissing}
                onChange={(e) =>
                  set({ onMissing: e.target.value as Visibility["onMissing"] })
                }
              >
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </Label>
          </Row>
          <p className="section-help">
            Hiding compiles to full transparency on the element's own marks —
            never to a healthy-looking default.
          </p>
        </>
      )}
    </div>
  );
}

export function FormatEditor({
  label,
  format,
  decimals,
  onChange,
}: {
  label: string;
  format: ValueFormat;
  decimals: number;
  onChange: (format: ValueFormat, decimals: number) => void;
}) {
  return (
    <Row>
      <Label text={`${label} format`}>
        <select
          aria-label={`${label} format`}
          value={format}
          onChange={(e) => onChange(e.target.value as ValueFormat, decimals)}
        >
          {VALUE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f === "number"
                ? "Number"
                : f === "percent"
                  ? "Percentage"
                  : "Bytes"}
            </option>
          ))}
        </select>
      </Label>
      <Label text="Decimal places">
        <input
          aria-label={`${label} decimal places`}
          type="number"
          min={0}
          max={5}
          key={decimals}
          defaultValue={decimals}
          onBlur={(e) => {
            if (Number(e.target.value) !== decimals)
              onChange(format, Number(e.target.value));
          }}
        />
      </Label>
    </Row>
  );
}
