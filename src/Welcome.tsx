import { FormField } from "./ui";
import { useState } from "react";
import {
  ArrowUpRight,
  FilePlus2,
  FolderOpen,
  BarChart3,
  ArrowRight,
  Layers,
} from "lucide-react";
import { blankProject, type Project } from "./model";
import { EXAMPLE_PROJECTS } from "./examples";
import { ColorPicker } from "./ColorPicker";

export function Welcome({
  open,
  example,
  openExample,
  create,
}: {
  open: () => void;
  example: () => void;
  openExample: (id: string) => void;
  create: (p: Project) => void;
}) {
  const [name, setName] = useState("Untitled project"),
    [width, setWidth] = useState("900"),
    [height, setHeight] = useState("560"),
    [background, setBackground] = useState("#ffffff"),
    [error, setError] = useState("");
  return (
    <main className="welcome">
      <div className="welcome-intro">
        <span className="eyebrow">YOUR IDEAS. YOUR CANVAS.</span>
        <h1>
          Make your data
          <br />
          <span>look like you imagined.</span>
        </h1>
        <p>
          A visual workspace for charts and dashboards. <br />
          Start fresh, pick up a project, or explore an example.
        </p>
      </div>
      <div className="welcome-grid">
        <form
          className="new-project-card"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              create(
                blankProject(name, Number(width), Number(height), background),
              );
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <div className="welcome-card-heading">
            <span className="welcome-icon">
              <FilePlus2 size={22} />
            </span>
            <div>
              <h2>New project</h2>
              <p>A blank canvas, ready for your ideas.</p>
            </div>
          </div>
          <FormField label="Project name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <div className="field-grid">
            <label className="field">
              <span>
                Width <small>px</small>
              </span>
              <input
                aria-label="New canvas width"
                type="number"
                min={400}
                max={4000}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Height <small>px</small>
              </span>
              <input
                aria-label="New canvas height"
                type="number"
                min={300}
                max={4000}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
          </div>
          <ColorPicker
            label="Canvas background"
            value={background}
            onChange={setBackground}
          />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary create-button" type="submit">
            Create project
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="welcome-secondary">
          <button className="open-project-card" onClick={open}>
            <FolderOpen size={25} />
            <div>
              <h2>Open project</h2>
              <p>Continue with a saved Vega Studio file.</p>
            </div>
            <ArrowUpRight size={19} />
          </button>
          <button className="example-card" onClick={example}>
            <div className="example-art" aria-hidden="true">
              <div className="mini-chart">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <span className="example-art-label">
                <BarChart3 size={15} />
                Logstash queue usage
              </span>
            </div>
            <div className="example-card-label">
              <div>
                <span className="eyebrow">EXPLORE THE POSSIBILITIES</span>
                <h2>Open example</h2>
                <p>An editable panel with data and thresholds.</p>
              </div>
              <ArrowUpRight size={19} />
            </div>
          </button>
          <div className="more-examples">
            <span className="eyebrow">MORE EXAMPLES</span>
            {EXAMPLE_PROJECTS.map((ex) => (
              <button
                key={ex.id}
                className="more-example"
                onClick={() => openExample(ex.id)}
              >
                <div>
                  <h2>{ex.title}</h2>
                  <p>{ex.blurb}</p>
                </div>
                <ArrowUpRight size={19} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="welcome-note">
        <Layers size={15} />
        <span>
          Build visually. Keep every layer editable. Export when you’re ready.
        </span>
      </div>
    </main>
  );
}
