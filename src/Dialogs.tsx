import { FormField, SettingsSection, TabBar } from "./ui";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, useId } from "react";
import { parse, View } from "vega";
import { X, Copy, Download, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { compile, studioSources } from "./compiler";
import {
  datasetUsers,
  esExportIssues,
  extractResponse,
  type NamedSource,
  type Project,
  type Row,
} from "./model";
import { useEditor } from "./store";

export function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Where preview tuples come from. Never a live connection. */
export function previewLabel(s: NamedSource): string {
  if (s.kind === "inline") return `${s.rows.length} inline rows`;
  if (s.fixture)
    return `response fixture (${s.fixture.rows.length} rows, not live)`;
  return "no fixture — empty preview, live on export";
}

function SourcesDialog({ close }: { close: () => void }) {
  const { project, commit } = useEditor();
  const [selected, setSelected] = useState(project.sources[0]?.name ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [esDraft, setEsDraft] = useState({
    name: "",
    index: "",
    query: "",
    extractPath: "hits.hits._source",
    dashboardFilter: true,
    dashboardTime: false,
    timestampField: "",
  });
  const [fixtureText, setFixtureText] = useState("");
  const rowsRef = useRef<HTMLTextAreaElement>(null);
  const drafts = useRef(
    new Map<string, { text?: string; es?: typeof esDraft; fixture?: string }>(),
  );
  const remember = (patch: {
    text?: string;
    es?: typeof esDraft;
    fixture?: string;
  }) => {
    drafts.current.set(selected, { ...drafts.current.get(selected), ...patch });
  };
  const source = project.sources.find((s) => s.name === selected);
  useEffect(() => {
    setError("");
    const cached = drafts.current.get(selected);
    if (source?.kind === "inline")
      setText(cached?.text ?? JSON.stringify(source.rows, null, 2));
    if (source?.kind === "elasticsearch") {
      setFixtureText(cached?.fixture ?? "");
      setEsDraft(
        cached?.es ?? {
          name: source.name,
          index: source.index,
          query: source.query,
          extractPath: source.extractPath,
          dashboardFilter: source.dashboardFilter,
          dashboardTime: source.dashboardTime,
          timestampField: source.timestampField,
        },
      );
    }
  }, [selected, project]);
  // Grow the rows editor to fit its content, so an empty dataset does not
  // present a tall empty box that reads as broken.
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 380)}px`;
  }, [text]);
  if (!source) return null;
  const dirty =
    source.kind === "inline" && text !== JSON.stringify(source.rows, null, 2);
  const applyRows = () => {
    try {
      const rows: unknown = JSON.parse(text);
      commit({
        ...project,
        sources: project.sources.map((s) =>
          s.name === source.name && s.kind === "inline"
            ? { ...s, rows: rows as Row[] }
            : s,
        ),
      });
      close();
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "Invalid JSON. Check commas, quotes, and brackets."
          : (err as Error).message,
      );
    }
  };
  const removeSource = (name: string) => {
    if (project.sources.length <= 1) {
      setError("A project needs at least one dataset.");
      return;
    }
    const users = datasetUsers(project, name);
    if (users.length) {
      setError(
        `Dataset “${name}” is still bound by: ${users.join(", ")}. Rebind those layers first — Studio will not silently rebind them.`,
      );
      return;
    }
    commit({
      ...project,
      sources: project.sources.filter((s) => s.name !== name),
    });
    drafts.current.delete(name);
    setSelected(project.sources.find((s) => s.name !== name)!.name);
    setError("");
  };
  const addSource = (kind: "inline" | "elasticsearch") => {
    let n = 1;
    let name = kind === "inline" ? "data" : "es";
    while (
      project.sources.some((s) => s.name === (n === 1 ? name : `${name}${n}`))
    )
      n++;
    name = n === 1 ? name : `${name}${n}`;
    try {
      commit({
        ...project,
        sources: [
          ...project.sources,
          kind === "inline"
            ? { kind, name, rows: [] }
            : {
                kind,
                name,
                index: "",
                query: "",
                extractPath: "hits.hits._source",
                dashboardFilter: true,
                dashboardTime: false,
                timestampField: "",
                fixture: null,
              },
        ],
      });
      setSelected(name);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const applyEs = () => {
    try {
      if (esDraft.query.trim()) JSON.parse(esDraft.query);
      commit({
        ...project,
        sources: project.sources.map((s) =>
          s.name === source.name && s.kind === "elasticsearch"
            ? {
                ...s,
                index: esDraft.index || (s as { index: string }).index,
                query: esDraft.query,
                extractPath: esDraft.extractPath,
                dashboardFilter: esDraft.dashboardFilter,
                dashboardTime: esDraft.dashboardTime,
                timestampField: esDraft.timestampField,
              }
            : s,
        ),
      });
      setError("");
    } catch {
      setError("Query must be valid JSON (a Query DSL object).");
    }
  };
  const applyFixture = () => {
    try {
      const response: unknown = JSON.parse(fixtureText);
      const path = source.kind === "elasticsearch" ? source.extractPath : "";
      const rows = extractResponse(path, response);
      commit({
        ...project,
        sources: project.sources.map((s) =>
          s.name === source.name && s.kind === "elasticsearch"
            ? { ...s, fixture: { rows } }
            : s,
        ),
      });
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="source-layout">
      <div className="source-rail">
        <p className="source-rail-title">Data sources</p>
        <div className="source-items">
          {project.sources.map((s) => (
            <button
              key={s.name}
              aria-pressed={s.name === selected}
              className={`source-item ${s.name === selected ? "active" : ""}`}
              onClick={() => setSelected(s.name)}
            >
              <span className="source-item-name">{s.name}</span>
              <span className="source-item-meta">
                {s.kind === "inline"
                  ? `${s.rows.length} ${s.rows.length === 1 ? "row" : "rows"}`
                  : "Elasticsearch"}
              </span>
            </button>
          ))}
        </div>
        <div className="source-rail-add">
          <button
            aria-label="Add inline dataset"
            title="Add inline dataset"
            onClick={() => addSource("inline")}
          >
            <Plus size={14} />
            Sample rows
          </button>
          <button
            aria-label="Add Elasticsearch dataset"
            title="Add Elasticsearch dataset"
            onClick={() => addSource("elasticsearch")}
          >
            <Plus size={14} />
            Elasticsearch
          </button>
        </div>
      </div>

      <div className="source-editor">
        <header className="source-head">
          <h3 className="source-head-name">{source.name}</h3>
          <span className="badge">
            {source.kind === "inline" ? "Sample rows" : "Elasticsearch"}
          </span>
        </header>
        <p className="source-head-hint">
          {source.kind === "inline"
            ? "A JSON array of row objects. Every field in it can be bound to an element."
            : "Saved as a Query DSL body for the Kibana export. Studio never connects to a cluster."}
        </p>
        {source.kind === "inline" ? (
          <textarea
            aria-label="Sample data JSON"
            spellCheck={false}
            ref={rowsRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              remember({ text: e.target.value });
            }}
          />
        ) : (
          <EsEditor
            source={source}
            draft={esDraft}
            setDraft={(next) => {
              setEsDraft(next);
              remember({ es: next });
            }}
            fixtureText={fixtureText}
            setFixtureText={(next) => {
              setFixtureText(next);
              remember({ fixture: next });
            }}
            applyFixture={applyFixture}
            project={project}
          />
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <span className="flex gap-2">
            <button
              aria-label={`Delete dataset ${source.name}`}
              className="icon-button"
              disabled={project.sources.length <= 1}
              onClick={() => removeSource(source.name)}
            >
              <Trash2 size={15} />
            </button>
            <span className="muted">
              {source.kind === "inline"
                ? dirty
                  ? "Unsaved changes — press Apply to use them."
                  : source.rows.length === 0
                    ? "No rows yet. Add some JSON below."
                    : `${source.rows.length} ${source.rows.length === 1 ? "row" : "rows"} in use.`
                : "Local preview only — Studio never queries Elasticsearch."}
            </span>
          </span>
          {source.kind === "inline" ? (
            <button className="primary" onClick={applyRows} disabled={!dirty}>
              Apply data
            </button>
          ) : (
            <button className="primary" onClick={applyEs}>
              Apply source
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EsEditor({
  source,
  draft,
  setDraft,
  fixtureText,
  setFixtureText,
  applyFixture,
  project,
}: {
  source: Extract<NamedSource, { kind: "elasticsearch" }>;
  draft: {
    name: string;
    index: string;
    query: string;
    extractPath: string;
    dashboardFilter: boolean;
    dashboardTime: boolean;
    timestampField: string;
  };
  setDraft: (d: {
    name: string;
    index: string;
    query: string;
    extractPath: string;
    dashboardFilter: boolean;
    dashboardTime: boolean;
    timestampField: string;
  }) => void;
  fixtureText: string;
  setFixtureText: (t: string) => void;
  applyFixture: () => void;
  project: Project;
}) {
  const set = (p: Partial<typeof draft>) => setDraft({ ...draft, ...p });
  void project;
  return (
    <div className="dialog-scroll">
      <SettingsSection title="Query & response" variant="form">
        <FormField label="Index pattern">
          <input
            aria-label="Index pattern"
            value={draft.index}
            placeholder="logs-*"
            onChange={(e) => set({ index: e.target.value })}
          />
        </FormField>
        <FormField label="Query DSL body (JSON object)">
          <textarea
            aria-label="Query DSL body"
            className="small"
            spellCheck={false}
            value={draft.query}
            placeholder='{"size": 0, "aggs": {...}}'
            onChange={(e) => set({ query: e.target.value })}
          />
        </FormField>
        <FormField label="Response extraction path">
          <input
            aria-label="Response extraction path"
            value={draft.extractPath}
            onChange={(e) => set({ extractPath: e.target.value })}
          />
        </FormField>
      </SettingsSection>
      <SettingsSection title="Dashboard context" variant="form">
        <label className="check-field">
          <span>Dashboard filters (%context%)</span>
          <input
            type="checkbox"
            checked={draft.dashboardFilter}
            onChange={(e) => set({ dashboardFilter: e.target.checked })}
          />
        </label>
        <label className="check-field">
          <span>Dashboard time (%timefield%)</span>
          <input
            type="checkbox"
            checked={draft.dashboardTime}
            onChange={(e) => set({ dashboardTime: e.target.checked })}
          />
        </label>
        {draft.dashboardTime && (
          <FormField label="Timestamp field">
            <input
              aria-label="Timestamp field"
              value={draft.timestampField}
              placeholder="@timestamp"
              onChange={(e) => set({ timestampField: e.target.value })}
            />
          </FormField>
        )}
        <p className="section-help">
          Dashboard filter/time integration replaces the query section (per
          Elastic docs), so a body “query” cannot be combined with either.
        </p>
      </SettingsSection>
      <SettingsSection title="Local preview" variant="form">
        <p className="section-help">
          Paste a representative Elasticsearch response. Rows are extracted with
          the same path the export declares, and preview clearly stays local —
          never a live connection.
        </p>
        <textarea
          aria-label="Response fixture JSON"
          className="small"
          spellCheck={false}
          value={fixtureText}
          placeholder='{"hits": {"hits": [{"_source": {...}}]}}'
          onChange={(e) => setFixtureText(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={applyFixture}>Extract fixture rows</button>
          {source.fixture && (
            <span className="muted">
              {source.fixture.rows.length} fixture rows stored
            </span>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

function ExportDialog() {
  const { project } = useEditor();
  const panelId = useId();
  const [tab, setTab] = useState<"inline" | "es">("inline");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    let active = true;
    let view: View | undefined;
    setError("");
    setCopyError("");
    setStatus("");
    setText("");
    try {
      const es = tab === "es";
      const spec = compile(project, studioSources, false, es);
      setText(JSON.stringify(spec, null, 2));
      view = new View(parse(spec), { renderer: "none" });
      view
        .toSVG()
        .then(
          () =>
            active &&
            setStatus(
              es
                ? "Valid Vega 6.2.0 · Elasticsearch export parsed locally (not run against Kibana)"
                : "Valid Vega 6.2.0 · parsed and rendered locally",
            ),
        )
        .catch((err) => {
          if (active) setError(String(err));
        })
        .finally(() => view?.finalize());
    } catch (err) {
      setError(String(err));
      view?.finalize();
    }
    return () => {
      active = false;
      view?.finalize();
    };
  }, [tab, project]);
  const esBlockers = esExportIssues(project);
  return (
    <>
      <div className="export-instructions">
        <span className="badge">KIBANA 9.2.3</span>
        <p>
          In Kibana, create a <strong>Vega</strong> visualization. Replace the
          specification with this JSON, click Update, then save it to your
          dashboard.
        </p>
      </div>
      <TabBar
        label="Export source"
        value={tab}
        onChange={setTab}
        panelId={panelId}
        items={[
          { value: "inline", label: "Inline sample data" },
          { value: "es", label: "Elasticsearch Query DSL" },
        ]}
      />
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${panelId}-${tab}`}
        className="export-panel"
      >
        {tab === "es" && (
          <div className="export-instructions">
            <p>
              Each Elasticsearch dataset exports as a Kibana <code>url</code>{" "}
              object (index, body, %context%/%timefield%, format.property).
              Studio never connects: preview below renders stored fixtures only.
              Untested inside a real Kibana instance.
            </p>
          </div>
        )}
        {tab === "es" && esBlockers.length > 0 && (
          <p role="alert" className="error">
            Elasticsearch export is blocked:
            {"\n" + esBlockers.join("\n")}
            {"\n"}Editing and inline export keep working.
          </p>
        )}
        <div className="preview-note muted">
          Preview uses:{" "}
          {project.sources
            .map((s) => `${s.name} (${previewLabel(s)})`)
            .join(" · ")}
        </div>
        <textarea
          aria-label="Generated Vega JSON"
          spellCheck={false}
          readOnly
          value={text}
          onChange={() => {}}
        />
        {error && tab === "inline" && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {error && tab === "es" && esBlockers.length === 0 && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="validation">
            <CheckCircle2 size={15} />
            {status}
          </p>
        )}
        {copyError && (
          <p role="alert" className="error">
            {copyError}
          </p>
        )}
        <div className="dialog-footer">
          <span className="muted">
            Local Vega validation; not tested inside Kibana.
          </span>
          <div className="flex gap-2">
            <button
              disabled={!text || !!error}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setStatus("Copied Vega JSON to clipboard.");
                  setCopyError("");
                } catch {
                  setCopyError(
                    "Clipboard unavailable. Select the JSON or download it instead.",
                  );
                }
              }}
            >
              <Copy size={14} />
              Copy JSON
            </button>
            <button
              className="primary"
              disabled={!text || !!error}
              onClick={() => download("vega-studio.vega.json", text)}
            >
              <Download size={14} />
              Download JSON
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function EditorDialog({
  mode,
  close,
}: {
  mode: "data" | "export" | null;
  close: () => void;
}) {
  return (
    <Dialog.Root
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${mode === "data" ? "data-dialog" : "export-dialog"}`}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>
                {mode === "data" ? "Sample data" : "Export to Kibana"}
              </Dialog.Title>
              <Dialog.Description>
                {mode === "data"
                  ? "Rows you type here live only in this project. Nothing is sent anywhere."
                  : "Inline sample data or Elasticsearch Query DSL · fixed-size panel · no live connection"}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close dialog" className="icon-button">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="dialog-body">
            {mode === "data" && <SourcesDialog close={close} />}
            {mode === "export" && <ExportDialog />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
