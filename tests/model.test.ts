import { beforeEach, describe, expect, it } from "vitest";
import { View, parse } from "vega";
import { readFile } from "node:fs/promises";
import { compile, legendItems, thresholdColor, thresholdLegend } from "../src/compiler";
import {
  sample,
  newElement,
  openProject,
  validateProject,
  availableFields,
  resolvedRows,
  type Bar,
  type Project,
} from "../src/model";
import { useEditor } from "../src/store";

/** Inline rows of the default dataset (v4 named sources). */
const rowsOf = (p: Project) => resolvedRows(p, "source");

describe("versioned projects and data boundaries", () => {
  it("round trips every editable property", () => {
    expect(openProject(JSON.stringify(sample))).toEqual(sample);
  });
  it("rejects malformed and unsupported files", () => {
    expect(() => openProject("{")).toThrow("Invalid JSON");
    expect(() => openProject('{"version":5}')).toThrow("Unsupported");
    expect(() => openProject("{}")).toThrow("Unsupported");
    expect(() => openProject('{"version":3}')).toThrow("name");
    expect(() => openProject('{"version":1}')).toThrow("name");
  });
  it.each(["missing", "duplicate", "number", "negative", "threshold", "ids"])(
    "rejects %s without changing the editor",
    (kind) => {
      const p = structuredClone(sample);
      const chart = p.elements[2] as Bar;
      if (kind === "missing") delete rowsOf(p)[0].label;
      if (kind === "duplicate") rowsOf(p)[1].label = rowsOf(p)[0].label;
      if (kind === "number") rowsOf(p)[0].usage_pct = "bad";
      if (kind === "negative") rowsOf(p)[0].usage_pct = -1;
      if (kind === "threshold") chart.warning = chart.critical;
      if (kind === "ids") p.elements[1].id = p.elements[0].id;
      const original = useEditor.getState().project;
      expect(() => useEditor.getState().commit(p)).toThrow();
      expect(useEditor.getState().project).toEqual(original);
    },
  );
  it("offers only fields consistently typed in all rows", () => {
    const p = structuredClone(sample);
    rowsOf(p)[0].extra = 1;
    expect(availableFields(p, "number")).toEqual(["usage_pct"]);
    expect(availableFields(p, "string")).toContain("label");
  });
});
describe("compiler and selected runtime", () => {
  it("ships equivalent project and Vega artifacts", async () => {
    const project = openProject(
      await readFile("samples/logstash.project.json", "utf8"),
    );
    const spec = JSON.parse(
      await readFile("samples/logstash.vega.json", "utf8"),
    );
    expect(project).toEqual(sample);
    expect(spec).toEqual(compile(project));
    const view = new View(parse(spec, undefined, { ast: true }), {
      renderer: "none",
    });
    try {
      expect(await view.toSVG()).toContain("Logstash queue usage");
    } finally {
      view.finalize();
    }
  });
  it("supports literal category field names containing path punctuation", async () => {
    const p = structuredClone(sample);
    for (const row of rowsOf(p)) {
      row["host.pipeline[0]"] = row.label;
    }
    (p.elements[2] as Bar).category.field = "host.pipeline[0]";
    const view = new View(parse(compile(p)), { renderer: "none" });
    try {
      const svg = await view.toSVG();
      expect(svg).toContain("edge-01 / ingest");
      expect(svg).toContain("worker-01 / arch");
      expect(svg).not.toContain("NaN");
    } finally {
      view.finalize();
    }
  });
  it("uses exact threshold boundaries and matching legend", () => {
    const e = sample.elements[2] as Bar;
    expect(thresholdColor(e, 64)).toBe(e.color.value);
    expect(thresholdColor(e, 65)).toBe(e.warningColor.value);
    expect(thresholdColor(e, 85)).toBe(e.criticalColor.value);
    expect(thresholdLegend(e)).toEqual([
      "Healthy < 65",
      "Warning 65–<85",
      "Critical ≥ 85",
    ]);
  });
  it("gives healthy an independent colour while old charts keep the bar colour", () => {
    const base = sample.elements[2] as Bar;
    // Unset (every project saved before the field existed): unchanged.
    expect(base.healthyColor).toBeUndefined();
    expect(thresholdColor(base, 10)).toBe(base.color.value);
    expect(legendItems(base)[0].color).toBe(base.color.value);

    const e: Bar = { ...base, healthyColor: { kind: "fixed", value: "#22c55e" } };
    expect(thresholdColor(e, 10)).toBe("#22c55e");
    // The other two bands and the boundaries are untouched.
    expect(thresholdColor(e, 65)).toBe(e.warningColor.value);
    expect(thresholdColor(e, 85)).toBe(e.criticalColor.value);
    expect(legendItems(e)[0]).toEqual({ label: "Healthy < 65", color: "#22c55e" });
    expect(thresholdLegend(e)).toEqual([
      "Healthy < 65",
      "Warning 65–<85",
      "Critical ≥ 85",
    ]);

    // Survives a save/open round trip and still parses and renders.
    const round = validateProject(JSON.parse(JSON.stringify({ ...sample, elements: [e] })));
    const back = round.elements[0] as Bar;
    expect(thresholdColor(back, 10)).toBe("#22c55e");
    const view = new View(parse(compile(round)), { renderer: "none" });
    try {
      view.runAsync();
    } finally {
      view.finalize();
    }

    // The compiled Vega signal is a second, independent fill path from
    // thresholdColor: it is what actually paints the bars, and it must agree
    // with the legend or the two silently diverge. The rect is nested inside
    // the chart group mark, so walk the whole tree.
    const fillSignals = (p: Project): string[] => {
      const out: string[] = [];
      const walk = (n: unknown) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (!n || typeof n !== "object") return;
        for (const [k, v] of Object.entries(n)) {
          if (k === "signal" && typeof v === "string" && v.includes("?")) out.push(v);
          else walk(v);
        }
      };
      walk(compile(p));
      return out;
    };
    const joined = (p: Project) => fillSignals(p).join("\n");
    expect(joined(round)).toContain("#22c55e");
    expect(joined(round)).toContain(e.warningColor.value);
    expect(joined(round)).toContain(e.criticalColor.value);
    // Unset still resolves to the bar colour, and never to "undefined".
    expect(joined(sample)).toContain(e.color.value);
    expect(joined(sample)).not.toContain("undefined");
  });
  it("exports an inline spec that parses and renders SVG", async () => {
    const spec = compile(sample),
      view = new View(parse(spec), { renderer: "none" });
    try {
      await view.runAsync();
      const svg = await view.toSVG();
      expect(svg).toContain("Logstash queue usage");
      expect(svg).toContain("edge-01 / ingest");
      expect(svg).toContain("Warning 65");
      expect(svg).toContain("#ee7686");
      expect(spec.autosize).toBe("none");
      expect(JSON.stringify(spec)).not.toContain('"url"');
    } finally {
      view.finalize();
    }
  });
  it("renders rectangles, styles, hidden layers and disabled labels", async () => {
    const p = structuredClone(sample);
    p.elements.push({ ...newElement("rectangle"), id: "shape" });
    p.elements[0].visible = false;
    (p.elements[2] as Bar).labels = false;
    const view = new View(parse(compile(p)), { renderer: "none" });
    try {
      const svg = await view.toSVG();
      expect(svg).not.toContain("Logstash queue usage");
      expect(svg).toContain("#5965dd");
    } finally {
      view.finalize();
    }
  });
  it("escapes arbitrary field names rather than injecting expressions", async () => {
    const p = structuredClone(sample);
    const key = 'value "] \\ odd';
    for (const row of rowsOf(p)) row[key] = row.usage_pct;
    (p.elements[2] as Bar).value.field = key;
    const view = new View(parse(compile(p)), { renderer: "none" });
    try {
      await expect(view.runAsync()).resolves.toBe(view);
    } finally {
      view.finalize();
    }
  });
  it("updates actual chart colors and legend when thresholds change", async () => {
    const p = structuredClone(sample);
    (p.elements[2] as Bar).warning = 30;
    (p.elements[2] as Bar).critical = 50;
    const view = new View(parse(compile(p)), { renderer: "none" });
    try {
      const svg = await view.toSVG();
      expect(svg).toContain("Healthy &lt; 30");
      expect(svg).toContain("Critical ≥ 50");
    } finally {
      view.finalize();
    }
  });
});
describe("commands and history", () => {
  beforeEach(() => useEditor.getState().open(structuredClone(sample)));
  it("resizes layout without mutating data, and undoes/redoes", () => {
    const s = useEditor.getState();
    s.edit("queues", { width: 600, height: 300 });
    expect(useEditor.getState().project.sources).toEqual(sample.sources);
    expect(useEditor.getState().past).toHaveLength(1);
    s.undo();
    expect(useEditor.getState().project).toEqual(sample);
    s.redo();
    expect((useEditor.getState().project.elements[2] as Bar).width).toBe(600);
  });
  it("guards locked layers except explicit unlock", () => {
    const s = useEditor.getState();
    s.edit("queues", { locked: true });
    s.edit("queues", { x: 0 });
    expect(useEditor.getState().project.elements[2].x).toBe(40);
    s.edit("queues", { locked: false });
    s.edit("queues", { x: 12 });
    expect(useEditor.getState().project.elements[2].x).toBe(12);
  });
  it("ignores missing IDs and no-op commits; clears redo after edit", () => {
    const s = useEditor.getState();
    s.edit("missing", { x: 1 });
    s.commit(sample);
    expect(useEditor.getState().past).toHaveLength(0);
    s.edit("queues", { x: 20 });
    s.undo();
    s.edit("queues", { x: 30 });
    expect(useEditor.getState().future).toHaveLength(0);
    s.markSaved();
    expect(useEditor.getState().saved).toBe(
      JSON.stringify(useEditor.getState().project),
    );
  });
  it("keeps UI state outside the project", () => {
    const s = useEditor.getState();
    s.select("title");
    s.setTool("pan");
    s.viewport(5, { x: 20, y: 30 });
    expect(useEditor.getState().zoom).toBe(2);
    expect(useEditor.getState().project).toEqual(sample);
    s.undo();
    s.redo();
    expect(useEditor.getState().project).toEqual(sample);
  });
});
