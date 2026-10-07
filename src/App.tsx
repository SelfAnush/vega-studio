import { useCallback, useEffect, useRef, useState } from "react";
import { ElementPalette } from "./ElementPalette";
import {
  Activity,
  Code2,
  Database,
  Hand,
  Home,
  MousePointer2,
  Redo2,
  Save,
  Undo2,
  Upload,
  Sun,
  Moon,
  FilePlus2,
} from "lucide-react";
import { Canvas } from "./Canvas";
import { Properties } from "./Properties";
import { EditorDialog, download } from "./Dialogs";
import { useEditor } from "./store";
import {
  newElement,
  openProject,
  sample,
  type Element,
  type Project,
} from "./model";
import {
  copyLayers,
  duplicateLayers,
  pasteLayers,
  removeLayers,
  groupLayers,
  ungroup,
  moveLayers,
} from "./commands";
import { readClipboard, writeClipboard } from "./clipboard";
import { LayersPanel } from "./LayersPanel";
import { PanelDivider } from "./PanelDivider";
import { Welcome } from "./Welcome";
import { EXAMPLE_PROJECTS } from "./examples";
import { isLightColor } from "./color";

export default function App() {
  const s = useEditor(),
    { project } = s;
  const [mode, setMode] = useState<"data" | "export" | null>(null),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const report = useCallback((message: string) => setError(message), []);
  const dirty = JSON.stringify(project) !== s.saved;
  const act = (action: () => void) => {
    try {
      action();
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const canLeave = () =>
    !dirty || window.confirm("Discard unsaved changes and continue?");
  const open = (p: Project) => {
    if (canLeave()) {
      s.open(p);
      setError("");
    }
  };
  const home = () => {
    if (canLeave()) {
      s.open(project);
      s.setScreen("welcome");
      setError("");
    }
  };
  function add(type: Element["type"], preset?: Partial<Element>) {
    act(() => {
      const create = newElement as (t: Element["type"]) => Element;
      const e = { ...create(type), ...preset } as Element;
      if (e.type === "text")
        e.color = {
          kind: "fixed",
          value: isLightColor(project.canvas.background)
            ? "#202b40"
            : "#e6e9f0",
        };
      s.commit({ ...project, elements: [...project.elements, e] });
      s.select(e.id);
    });
  }
  function remove() {
    s.commit(removeLayers(project, s.selection));
    s.select(null);
  }
  function duplicate() {
    const result = duplicateLayers(project, s.selection);
    s.commit(result.project);
    s.selectMany(result.ids);
  }
  function copy() {
    act(() => {
      const payload = copyLayers(project, s.selection);
      s.resetPaste();
      void writeClipboard(payload).then((via) => {
        if (via === "session")
          report(
            "System clipboard unavailable — copied to a session clipboard. It lasts until reload.",
          );
      });
    });
  }
  async function paste() {
    const epoch = useEditor.getState().documentEpoch;
    try {
      const { payload, via } = await readClipboard();
      const current = useEditor.getState();
      if (current.documentEpoch !== epoch || current.screen !== "editor")
        return;
      if (!payload) {
        report(
          "Clipboard holds no Vega Studio layers. Copy one or more unlocked layers first.",
        );
        return;
      }
      const step = current.pasteStep + 1;
      const result = pasteLayers(current.project, payload, step);
      s.commit(result.project);
      s.selectMany(result.ids);
      s.notePaste();
      if (result.missingDatasets.length)
        report(
          `Pasted ${result.ids.length} layer${result.ids.length === 1 ? "" : "s"} (${via} clipboard). Dataset${result.missingDatasets.length === 1 ? "" : "s"} not in this project: ${result.missingDatasets.join(", ")} — those bindings show setup warnings instead of rebinding.`,
        );
      else setError("");
    } catch (err) {
      report((err as Error).message);
    }
  }
  /** Place a palette-dropped element centered on the drop point. */
  function place(element: Element) {
    act(() => {
      const e = { ...element };
      if (e.type === "text")
        e.color = {
          kind: "fixed",
          value: isLightColor(project.canvas.background)
            ? "#202b40"
            : "#e6e9f0",
        };
      const w =
        e.type === "line" ? Math.abs(e.x2) : e.type === "group" ? 0 : e.width;
      const h =
        e.type === "line" ? Math.abs(e.y2) : e.type === "group" ? 0 : e.height;
      e.x = Math.round(
        Math.min(Math.max(e.x, 0), Math.max(0, project.canvas.width - w)),
      );
      e.y = Math.round(
        Math.min(Math.max(e.y, 0), Math.max(0, project.canvas.height - h)),
      );
      s.commit({ ...project, elements: [...project.elements, e] });
      s.select(e.id);
    });
  }
  function save() {
    download("vega-studio.project.json", JSON.stringify(project, null, 2));
    s.markSaved();
  }
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
  }, [s.theme]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        s.screen !== "editor" ||
        mode ||
        document.querySelector('[data-color-open="true"]') ||
        (e.target instanceof HTMLElement &&
          e.target.closest(
            'input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]',
          ))
      )
        return;
      const mod = e.ctrlKey || e.metaKey,
        k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && k === "s") {
        e.preventDefault();
        save();
      } else if (mod && k === "d") {
        e.preventDefault();
        act(duplicate);
      } else if (mod && k === "c") {
        e.preventDefault();
        copy();
      } else if (mod && k === "v") {
        e.preventDefault();
        void paste();
      } else if (mod && k === "g") {
        e.preventDefault();
        act(() => {
          if (e.shiftKey && s.selected) {
            s.commit(ungroup(project, s.selected));
            s.select(null);
          } else {
            const r = groupLayers(project, s.selection);
            s.commit(r.project);
            s.select(r.id);
          }
        });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        act(remove);
      } else if (e.key === "Escape") s.select(null);
      else if (k === "v") s.setTool("select");
      else if (k === "h") s.setTool("pan");
      else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const n = e.shiftKey ? 10 : 1;
        s.commit(
          moveLayers(
            project,
            s.selection,
            e.key === "ArrowRight" ? n : e.key === "ArrowLeft" ? -n : 0,
            e.key === "ArrowDown" ? n : e.key === "ArrowUp" ? -n : 0,
          ),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <div className={`app ${s.screen === "welcome" ? "welcome-app" : ""}`}>
      <header className="topbar">
        <button className="brand" aria-label="Vega Studio home" onClick={home}>
          <span className="brand-icon">
            <Activity size={20} />
          </span>
          vega<span>studio</span>
        </button>
        {s.screen === "editor" && (
          <>
            <span className="top-divider" />
            <div className="project-title">
              {project.name}
              <span
                aria-label={dirty ? "Unsaved changes" : "Saved"}
                className={`save-state ${dirty ? "dirty" : ""}`}
                title={dirty ? "Unsaved changes" : "Saved"}
              >
                ●
              </span>
            </div>
          </>
        )}
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label={`Switch to ${s.theme === "dark" ? "light" : "dark"} mode`}
            onClick={() => s.setTheme(s.theme === "dark" ? "light" : "dark")}
          >
            {s.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {s.screen === "editor" && (
            <>
              <button
                className="icon-button"
                aria-label="Home"
                title="Home"
                onClick={home}
              >
                <Home size={15} />
              </button>
              <button onClick={home}>
                <FilePlus2 size={15} />
                New
              </button>
              <button onClick={() => file.current?.click()}>
                <Upload size={15} />
                Open
              </button>
              <button onClick={save}>
                <Save size={15} />
                Save
              </button>
              <button className="primary" onClick={() => setMode("export")}>
                <Code2 size={16} />
                Export Vega
              </button>
            </>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {s.screen === "welcome" ? (
        <Welcome
          open={() => file.current?.click()}
          example={() => open(structuredClone(sample))}
          openExample={(id) => {
            const ex = EXAMPLE_PROJECTS.find((x) => x.id === id);
            if (ex) open(ex.build());
          }}
          create={open}
        />
      ) : (
        <>
          <div className="toolbar" role="region" aria-label="Editor tools">
            <div className="flex items-center gap-2">
              <ElementPalette add={add} />
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                aria-label="Undo"
                disabled={!s.past.length}
                onClick={s.undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Redo"
                disabled={!s.future.length}
                onClick={s.redo}
              >
                <Redo2 size={17} />
              </button>
              <span className="toolbar-divider" />
              <button
                aria-label="Select tool"
                aria-pressed={s.tool === "select"}
                title="Select (V)"
                className={`icon-button ${s.tool === "select" ? "active" : ""}`}
                onClick={() => s.setTool("select")}
              >
                <MousePointer2 size={17} />
              </button>
              <button
                aria-label="Pan tool"
                aria-pressed={s.tool === "pan"}
                title="Pan (H)"
                className={`icon-button ${s.tool === "pan" ? "active" : ""}`}
                onClick={() => s.setTool("pan")}
              >
                <Hand size={17} />
              </button>
            </div>
            <button onClick={() => setMode("data")}>
              <Database size={15} />
              Sample data
              <span className="badge">
                {project.sources.length} source
                {project.sources.length === 1 ? "" : "s"}
              </span>
            </button>
          </div>
          <div className="editor-body">
            <LayersPanel act={act} />
            <Canvas onError={report} onPlace={place} />
            <PanelDivider />
            <Properties
              onError={report}
              duplicate={() => act(duplicate)}
              remove={() => act(remove)}
            />
          </div>
        </>
      )}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        aria-label="Open project file"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            open(openProject(await f.text()));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      <EditorDialog mode={mode} close={() => setMode(null)} />
    </div>
  );
}
