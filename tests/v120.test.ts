import { describe, expect, it } from "vitest";
import { View, parse } from "vega";
import { readFile } from "node:fs/promises";
import {
  compile,
  bindingDataset,
  scalarExpr,
  condExpr,
  colorSignal,
  numSignal,
  visibilitySignal,
  legendItems,
  legendLayout,
  studioSources,
} from "../src/compiler";
import { freshPick } from "../src/DataEditors";
import {
  sample,
  blankProject,
  newElement,
  openProject,
  migrateToV4,
  validateProject,
  extractResponse,
  makeClipboard,
  parseClipboardText,
  chartSetup,
  exportIssues,
  esExportIssues,
  datasetUsers,
  neutralPick,
  availableFields,
  datasetNames,
  visibleAlways,
  type Bar,
  type Project,
  type DataPick,
} from "../src/model";
import {
  copyLayers,
  pasteLayers,
  resizeBox,
  resizeGroup,
  groupLayers,
} from "../src/commands";
import { bounds } from "../src/hierarchy";
import { reactiveExample } from "../src/examples";

async function svgOf(p: Project): Promise<string> {
  const view = new View(parse(compile(p)), { renderer: "none" });
  try {
    return await view.toSVG();
  } finally {
    view.finalize();
  }
}

const pick = (over: Partial<DataPick> = {}): DataPick => ({
  ...neutralPick(),
  ...over,
});

describe("schema v4 migration", () => {
  it("migrates v1/v2/v3 single-source projects to named sources", () => {
    const v3 = JSON.parse(JSON.stringify(sample));
    expect(v3.version).toBe(4);
    // Simulate a v3 document: single `source`, no `sources`.
    const legacyV3 = {
      ...v3,
      version: 3,
      source: { kind: "inline", rows: v3.sources[0].rows },
    };
    delete legacyV3.sources;
    const migrated = openProject(JSON.stringify(legacyV3));
    expect(migrated.version).toBe(4);
    expect(migrated.sources).toHaveLength(1);
    expect(migrated.sources[0]).toMatchObject({ kind: "inline", name: "source" });
    expect(migrated).toEqual(sample);
    const v1 = {
      ...legacyV3,
      version: 1,
      elements: (v3.elements as Record<string, unknown>[]).map((el) => {
        const { parentId: _parent, ...e } = el;
        return e;
      }),
    };
    expect(openProject(JSON.stringify(v1))).toEqual(sample);
  });
  it("migrateToV4 fills dataset and visibility defaults", () => {
    const out = migrateToV4({ version: 2, name: "x", canvas: { width: 900, height: 560, background: "#ffffff" }, source: { kind: "inline", rows: [] }, elements: [] }) as Project;
    expect(validateProject(out).sources[0].name).toBe("source");
  });
  it("rejects version 5 and keeps invalid opens from replacing state", () => {
    expect(() => openProject('{"version":5}')).toThrow("Unsupported");
  });
  it("round trips the reactive example", () => {
    const p = reactiveExample();
    expect(openProject(JSON.stringify(p))).toEqual(p);
  });
});

describe("binding validation", () => {
  const base = (): Project => validateProject(structuredClone(reactiveExample()));
  it("freshPick always produces a pick that passes validation", () => {
    // A blank project has no numeric fields. freshPick used to return
    // op:"sum" with an empty reduceField, which validation rejects, so
    // enabling any binding or colour rule threw and the control reverted
    // silently. "count" needs no field and must always be chosen instead.
    const blank = blankProject();
    expect(availableFields(blank, "number", "source")).toEqual([]);
    const p = freshPick(blank);
    expect(p.op).toBe("count");
    expect(p.reduceField).toBe("");
    expect(() =>
      validateProject({
        ...blank,
        elements: [
          {
            ...newElement("rectangle"),
            id: "r1",
            name: "R1",
            x: 0,
            y: 0,
            width: 40,
            height: 30,
            fillRules: { pick: p, rules: [], default: "#6789A0" },
          },
        ],
      }),
    ).not.toThrow();

    // With a numeric field present it should still prefer sum on that field.
    const withNums = validateProject(
      structuredClone(reactiveExample()),
    ) as Project;
    const numeric = availableFields(withNums, "number", datasetNames(withNums)[0]);
    if (numeric.length) {
      const fp = freshPick(withNums);
      expect(fp.op).toBe("sum");
      expect(fp.reduceField).toBe(numeric[0]);
    }
  });
  it("requires mode-specific pick fields", () => {
    const p = base();
    const t = p.elements.find((e) => e.id === "bigvalue")!;
    expect(() =>
      validateProject({
        ...p,
        elements: p.elements.map((e) =>
          e.id === "bigvalue"
            ? { ...t, contentFrom: { pick: pick({ mode: "match", matchField: "" }), format: "number", decimals: 0 } }
            : e,
        ),
      }),
    ).toThrow("match field");
    expect(() =>
      validateProject({
        ...p,
        elements: p.elements.map((e) =>
          e.id === "bigvalue"
            ? { ...t, contentFrom: { pick: pick({ mode: "latest", timestampField: "" }), format: "number", decimals: 0 } }
            : e,
        ),
      }),
    ).toThrow("timestamp field");
    expect(() =>
      validateProject({
        ...p,
        elements: p.elements.map((e) =>
          e.id === "bigvalue"
            ? { ...t, contentFrom: { pick: pick({ mode: "reduce", op: "sum", reduceField: "" }), format: "number", decimals: 0 } }
            : e,
        ),
      }),
    ).toThrow("needs a field");
  });
  it("bounds numeric mappings and rule values", () => {
    const p = base();
    const line = p.elements.find((e) => e.id === "rule")!;
    expect(() =>
      validateProject({
        ...p,
        elements: p.elements.map((e) =>
          e.id === "rule"
            ? { ...line, widthMap: { pick: pick({ mode: "reduce", op: "max", reduceField: "load" }), dataMin: 100, dataMax: 100, outMin: 1, outMax: 8, fallback: 2 } }
            : e,
        ),
      }),
    ).toThrow("dataMin < dataMax");
    expect(() =>
      validateProject({
        ...p,
        elements: p.elements.map((e) =>
          e.id === "rule"
            ? { ...line, widthMap: { pick: pick({ mode: "reduce", op: "max", reduceField: "load" }), dataMin: 0, dataMax: 100, outMin: 1, outMax: 99, fallback: 2 } }
            : e,
        ),
      }),
    ).toThrow("within 0.5–50");
    const txt = p.elements.find((e) => e.id === "bigvalue")!;
    expect(() =>
      validateProject({
        ...p,
        elements: p.elements.map((e) =>
          e.id === "bigvalue"
            ? { ...txt, colorRules: { pick: pick({ mode: "reduce", op: "max", reduceField: "load" }), rules: [{ operator: "between", value: 1, color: { kind: "fixed", value: "#000000" } }], default: "#000000" } }
            : e,
        ),
      }),
    ).toThrow("upper bound");
  });
});

describe("extractResponse", () => {
  const response = {
    hits: {
      hits: [
        { _source: { service: "a", load: 10 } },
        { _source: { service: "b", load: 20 } },
      ],
    },
    aggregations: { cats: { buckets: [{ key: "x", doc_count: 3 }] } },
  };
  it("extracts hits.hits._source rows", () => {
    expect(extractResponse("hits.hits._source", response)).toEqual([
      { service: "a", load: 10 },
      { service: "b", load: 20 },
    ]);
  });
  it("extracts aggregation buckets and numeric indexes", () => {
    expect(extractResponse("aggregations.cats.buckets", response)).toEqual([
      { key: "x", doc_count: 3 },
    ]);
    expect(extractResponse("hits.hits.0._source", response)).toEqual([
      { service: "a", load: 10 },
    ]);
  });
  it("rejects empty paths and paths with no objects", () => {
    expect(() => extractResponse("", response)).toThrow("must not be empty");
    expect(() => extractResponse("hits.total", response)).toThrow("no objects");
  });
});

describe("clipboard copy and paste", () => {
  it("round trips through the session fallback without navigator", async () => {
    const { writeClipboard, readClipboard } = await import(
      "../src/clipboard"
    );
    const p = reactiveExample();
    const payload = makeClipboard([p.elements[0]]);
    // No system clipboard in the unit environment: session path only.
    expect(await writeClipboard(payload)).toBe("session");
    const read = await readClipboard();
    expect(read.via).toBe("session");
    expect(read.payload?.elements).toHaveLength(1);
  });
  it("parses versioned payloads and rejects the rest", () => {
    const p = reactiveExample();
    const payload = makeClipboard([p.elements[0]]);
    expect(parseClipboardText(JSON.stringify(payload)).elements).toHaveLength(1);
    expect(() => parseClipboardText("hello")).toThrow("no Vega Studio layers");
    expect(() => parseClipboardText('{"app":"other"}')).toThrow(
      "no Vega Studio layers",
    );
  });
  it("copies subtrees and refuses locked selections", () => {
    const p = reactiveExample();
    const clip = copyLayers(p, ["alerts"]);
    expect(clip.elements.map((e) => e.id).sort()).toEqual(
      ["alert-text", "alerts"].sort(),
    );
    expect(() => copyLayers(p, [])).toThrow("Select one");
    const locked = validateProject({
      ...p,
      elements: p.elements.map((e) =>
        e.id === "banner" ? { ...e, locked: true } : e,
      ),
    });
    expect(() => copyLayers(locked, ["banner"])).toThrow("Unlock");
  });
  it("pastes with fresh ids, repaired parents, cascade, and dataset report", () => {
    const p = reactiveExample();
    const clip = copyLayers(p, ["alerts", "banner"]);
    const r1 = pasteLayers(p, clip, 1);
    expect(r1.ids).toHaveLength(2);
    expect(new Set(r1.project.elements.map((e) => e.id)).size).toBe(
      r1.project.elements.length,
    );
    // Roots paste in project order (banner before alerts); children keep
    // local coordinates while roots cascade.
    const g1 = r1.project.elements.find(
      (e) => e.id === r1.ids[1],
    )!;
    expect(g1.type).toBe("group");
    const kid = r1.project.elements.find((e) => e.parentId === r1.ids[1])!;
    expect(kid).toBeTruthy();
    expect(g1.x).toBe(40 + 16);
    expect(kid.x).toBe(0);
    const b1 = r1.project.elements.find((e) => e.id === r1.ids[0])!;
    expect(b1.x).toBe(360 + 16);
    expect(r1.missingDatasets).toEqual([]);
    const r2 = pasteLayers(r1.project, clip, 2);
    const g2 = r2.project.elements.find((e) => e.id === r2.ids[1])!;
    expect(g2.x).toBe(40 + 32);
    // Cross-project paste keeps unknown dataset references visibly.
    const other = blankProject();
    const r3 = pasteLayers(other, clip, 1);
    expect(r3.missingDatasets).toEqual(["metrics"]);
    expect(() => validateProject(r3.project)).not.toThrow();
    const barClip = copyLayers(p, ["loads"]);
    const r4 = pasteLayers(other, barClip, 1);
    const pastedBar = r4.project.elements.find(
      (e) => e.type === "bar",
    ) as Bar;
    expect(chartSetup(r4.project, pastedBar)).toContain("missing");
    expect(exportIssues(r4.project, false).join("\n")).toContain("missing");
  });
  it("lists dataset users for safe deletion", () => {
    const p = reactiveExample();
    expect(datasetUsers(p, "metrics").length).toBeGreaterThan(3);
    expect(datasetUsers(p, "nope")).toEqual([]);
  });
});

describe("resize math", () => {
  it("resizes from every handle without flipping", () => {
    const box = { x: 100, y: 100, width: 200, height: 100 };
    expect(resizeBox(box, "se", 50, 20, 20, 20, false)).toEqual({
      x: 100, y: 100, width: 250, height: 120,
    });
    expect(resizeBox(box, "nw", 50, 20, 20, 20, false)).toEqual({
      x: 150, y: 120, width: 150, height: 80,
    });
    expect(resizeBox(box, "nw", 500, 500, 20, 20, false)).toEqual({
      x: 280, y: 180, width: 20, height: 20,
    });
    expect(resizeBox(box, "e", 30, 999, 20, 20, false)).toEqual({
      x: 100, y: 100, width: 230, height: 100,
    });
    expect(resizeBox(box, "n", 0, -40, 20, 20, false)).toEqual({
      x: 100, y: 60, width: 200, height: 140,
    });
  });
  it("preserves aspect on corners when asked", () => {
    const box = { x: 0, y: 0, width: 200, height: 100 };
    const out = resizeBox(box, "se", 100, 0, 20, 20, true);
    expect(out.width).toBe(300);
    expect(out.height).toBe(150);
  });
  it("scales group descendants proportionally, preserving hierarchy", () => {
    const p = validateProject({
      ...blankProject(),
      elements: [
        { ...newElement("rectangle"), id: "a", x: 10, y: 10, width: 20, height: 20 },
        { ...newElement("text"), id: "b", x: 40, y: 40, width: 40, height: 20 },
      ],
    });
    const g = groupLayers(p, ["a", "b"]);
    const gid = g.project.elements.find((e) => e.type === "group")!.id;
    const oldBox = bounds(g.project, g.project.elements.find((e) => e.id === gid)!);
    expect(oldBox).toEqual({ x: 10, y: 10, width: 70, height: 50 });
    const scaled = resizeGroup(g.project, gid, oldBox, {
      x: oldBox.x,
      y: oldBox.y,
      width: oldBox.width * 2,
      height: oldBox.height * 2,
    });
    const a = scaled.elements.find((e) => e.id === "a")!;
    const b = scaled.elements.find((e) => e.id === "b")!;
    expect(a.parentId).toBe(gid);
    expect(b.parentId).toBe(gid);
    expect("width" in a ? a.width : 0).toBe(40);
    expect(b.x).toBe(60);
    expect("width" in b ? b.width : 0).toBe(80);
    // Font sizes do not scale with group bounds.
    expect(b.type === "text" ? b.fontSize : 0).toBe(24);
    expect(() => validateProject(scaled)).not.toThrow();
  });
});

describe("threshold legends", () => {
  const chart = (over: Partial<Bar> = {}): Bar =>
    ({
      ...newElement("bar"),
      category: { kind: "field", field: "c" },
      value: { kind: "field", field: "v" },
      ...over,
    }) as Bar;
  it("derives all three states with units from settings", () => {
    expect(legendItems(chart({ warning: 75, critical: 90 }))).toEqual([
      { label: "Healthy < 75", color: expect.any(String) },
      { label: "Warning 75–<90", color: expect.any(String) },
      { label: "Critical ≥ 90", color: expect.any(String) },
    ]);
    const pct = legendItems(
      chart({ warning: 75, critical: 90, valueFormat: "percent", decimals: 0 }),
    );
    expect(pct[0].label).toBe("Healthy < 75%");
    expect(pct[2].label).toBe("Critical ≥ 90%");
    const bytes = legendItems(
      chart({ warning: 2048, critical: 3145728, valueFormat: "bytes", decimals: 1 }),
    );
    expect(bytes[0].label).toBe("Healthy < 2.0 KB");
    expect(bytes[2].label).toBe("Critical ≥ 3.0 MB");
  });
  it("wraps rows to fit narrow charts in both orientations", async () => {
    for (const orientation of ["horizontal", "vertical"] as const) {
      const p = validateProject({
        ...blankProject(),
        sources: [
          {
            kind: "inline",
            name: "source",
            rows: [
              { c: "a", v: 10 },
              { c: "b", v: 80 },
              { c: "c", v: 95 },
            ],
          },
        ],
        elements: [
          {
            ...chart({ orientation, width: 360, height: 220 }),
            id: "m",
            category: { kind: "field", field: "c" },
            value: { kind: "field", field: "v" },
          },
        ],
      });
      const { rows, height } = legendLayout(p.elements[0] as Bar);
      expect(rows.flat()).toHaveLength(3);
      const svg = await svgOf(p);
      for (const label of ["Healthy", "Warning", "Critical"]) expect(svg).toContain(label);
      // Legend block fits the element bounds.
      const legendTop = 220 - 0 - 8 - height;
      expect(legendTop).toBeGreaterThan(0);
      expect(legendTop + height).toBeLessThanOrEqual(220);
    }
  });
  it("emits no legend in single mode or when hidden", () => {
    expect(
      legendLayout(chart({ colorMode: "single" })).rows,
    ).toEqual([]);
    expect(
      legendLayout(chart({ showLegend: false })).rows,
    ).toEqual([]);
  });
});

describe("compiled bindings", () => {
  it("builds helper datasets for match, latest, and reduction", () => {
    const m = bindingDataset("h1", "metrics", pick({ mode: "match", matchField: "service", matchValue: "events", field: "load" }));
    expect(m.transform[1]).toMatchObject({ type: "filter" });
    const l = bindingDataset("h2", "metrics", pick({ mode: "latest", timestampField: "updated" }));
    expect(l.transform[1]).toMatchObject({ type: "aggregate" });
    const r = bindingDataset("h3", "metrics", pick({ mode: "reduce", op: "average", reduceField: "load" }));
    expect(r.transform[1]).toMatchObject({ type: "aggregate" });
    expect(scalarExpr("h3", pick({ mode: "reduce", op: "sum", reduceField: "load" }))).toContain(
      "data('h3')[0].value",
    );
  });
  it("chains first-match-wins color rules with defaults, never zero", () => {
    const sig = colorSignal(
      "h",
      pick({ mode: "reduce", op: "max", reduceField: "load" }),
      [
        { operator: ">=", value: 90, color: { kind: "fixed", value: "#ee7686" } },
        { operator: "between", value: 70, value2: 80, color: { kind: "fixed", value: "#e8b65c" } },
      ],
      "#67b9a0",
    );
    expect(sig.signal).toContain("#ee7686");
    expect(sig.signal).toContain("#e8b65c");
    expect(sig.signal).toContain("#67b9a0");
    expect(sig.signal).not.toContain("?0:");
    const n = numSignal(
      { pick: pick({ mode: "reduce", op: "max", reduceField: "load" }), dataMin: 0, dataMax: 100, outMin: 0, outMax: 1, fallback: 1 },
      "h",
    );
    expect(n.signal).toContain("clamp");
    expect(n.signal).toContain(":1)");
    expect(condExpr("s", "==", "crit")).toBe('(s+""=="crit")');
  });
  it("gates visibility explicitly on missing data", () => {
    expect(visibilitySignal(visibleAlways(), "h")).toBe("1");
    const v = visibilitySignal(
      { ...visibleAlways(), mode: "rule", pick: pick({ mode: "reduce", op: "max", reduceField: "load" }), operator: ">=", value: 70, whenTrue: "show", onMissing: "hide" },
      "h",
    );
    expect(v).toContain("?1:0");
  });
  it("renders the reactive example with live values", async () => {
    const svg = await svgOf(reactiveExample());
    expect(svg).toContain("95%");
    expect(svg).toContain("78%");
    expect(svg).toContain("above warning");
  });
});

describe("elasticsearch export", () => {
  const esProject = (): Project =>
    validateProject({
      ...blankProject(),
      sources: [
        { kind: "inline", name: "source", rows: [{ c: "a", v: 1 }] },
        {
          kind: "elasticsearch",
          name: "logs",
          index: "logs-*",
          query: '{"size":0}',
          extractPath: "hits.hits._source",
          dashboardFilter: false,
          dashboardTime: false,
          timestampField: "",
          fixture: null,
        },
      ],
      elements: [],
    });
  it("compiles url datasets with placeholders and format.property", () => {
    const spec = compile(esProject(), studioSources, true, true);
    const ds = (spec.data as { name: string; url?: object; format?: object }[]).find(
      (d) => d.name === "logs",
    )!;
    expect(ds.url).toMatchObject({ index: "logs-*" });
    expect(ds.format).toEqual({ property: "hits.hits._source" });
    const inline = (spec.data as { name: string; values?: unknown }[]).find(
      (d) => d.name === "source",
    )!;
    expect(inline.values).toHaveLength(1);
  });
  it("emits %context% and %timefield% only when enabled", () => {
    const p = esProject();
    const withBoth = validateProject({
      ...p,
      sources: p.sources.map((s) =>
        s.kind === "elasticsearch"
          ? { ...s, dashboardFilter: true, dashboardTime: true, timestampField: "@timestamp", query: '{"size":0}' }
          : s,
      ),
    });
    const spec = compile(withBoth, studioSources, true, true);
    const ds = (spec.data as { url?: Record<string, unknown> }[]).find((d) => d.url)!;
    expect(ds.url!["%context%"]).toBe(true);
    expect(ds.url!["%timefield%"]).toBe("@timestamp");
    const plain = compile(esProject(), studioSources, true, true);
    const ds2 = (plain.data as { url?: Record<string, unknown> }[]).find((d) => d.url)!;
    expect(ds2.url!["%context%"]).toBeUndefined();
  });
  it("blocks incomplete live-export config while inline export works", () => {
    expect(esExportIssues(esProject())).toEqual([]);
    const badQuery = validateProject({
      ...esProject(),
      sources: esProject().sources.map((s) =>
        s.kind === "elasticsearch"
          ? { ...s, query: '{"size":0,"query":{"match_all":{}}}', dashboardFilter: true }
          : s,
      ),
    });
    expect(esExportIssues(badQuery).join("\n")).toContain("replaces the query section");
    const noIndex = validateProject({
      ...esProject(),
      sources: esProject().sources.map((s) =>
        s.kind === "elasticsearch" ? { ...s, index: "" } : s,
      ),
    });
    expect(esExportIssues(noIndex).join("\n")).toContain("index pattern");
    const noTime = validateProject({
      ...esProject(),
      sources: esProject().sources.map((s) =>
        s.kind === "elasticsearch"
          ? { ...s, dashboardTime: true, timestampField: "" }
          : s,
      ),
    });
    expect(esExportIssues(noTime).join("\n")).toContain("timestamp field");
    // Inline export is unaffected by ES incompleteness.
    expect(() => compile(noIndex)).not.toThrow();
    expect(exportIssues(noIndex, false)).toEqual([]);
  });
  it("previews fixtures locally and reports the source", async () => {
    const p = validateProject({
      ...esProject(),
      sources: esProject().sources.map((s) =>
        s.kind === "elasticsearch"
          ? { ...s, fixture: { rows: [{ service: "a", load: 5 }] } }
          : s,
      ),
    });
    const spec = compile(p);
    const ds = (spec.data as { name: string; values?: object[] }[]).find(
      (d) => d.name === "logs",
    )!;
    expect(ds.values).toHaveLength(1);
    expect("url" in ds).toBe(false);
  });
});

describe("generated samples", () => {
  it.each(["logstash", "shapes", "bars", "dashboard", "reactive"])(
    "ships equivalent %s project and Vega artifacts",
    async (name) => {
      const project = openProject(
        await readFile(`samples/${name}.project.json`, "utf8"),
      );
      const spec = JSON.parse(
        await readFile(`samples/${name}.vega.json`, "utf8"),
      );
      expect(spec).toEqual(compile(project));
      const view = new View(parse(spec, undefined, { ast: true }), {
        renderer: "none",
      });
      try {
        await expect(view.toSVG()).resolves.toContain("<svg");
      } finally {
        view.finalize();
      }
    },
  );
});
