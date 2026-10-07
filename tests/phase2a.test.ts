import { describe, expect, it } from "vitest";
import { View, parse } from "vega";
import { readFile } from "node:fs/promises";
import {
  compile,
  chartDataset,
  valueSignal,
  thresholdColor,
} from "../src/compiler";
import {
  sample,
  blankProject,
  newElement,
  openProject,
  validateProject,
  formatValueText,
  resolvedRows,
  FONT_STACKS,
  type Bar,
  type Project,
  type Element,
  type LineEl,
} from "../src/model";
import { ELEMENTS, PALETTE } from "../src/registry";
import {
  groupLayers,
  alignRoots,
  distribute,
  moveLayers,
} from "../src/commands";
import {
  bounds,
  worldEndpoints,
  selectionRoots,
} from "../src/hierarchy";
import { useEditor } from "../src/store";
import {
  barsExample,
  dashboardExample,
  EXAMPLE_PROJECTS,
} from "../src/examples";

async function svgOf(p: Project): Promise<string> {
  const view = new View(parse(compile(p)), { renderer: "none" });
  try {
    return await view.toSVG();
  } finally {
    view.finalize();
  }
}

describe("schema v3 migration", () => {
  it("migrates v1 flat projects to v3 with equivalent visuals", () => {
    const old = {
      ...sample,
      version: 1,
      elements: sample.elements.map(({ parentId, ...e }) => e),
    };
    const migrated = openProject(JSON.stringify(old));
    expect(migrated).toEqual(sample);
    expect(compile(migrated)).toEqual(compile(sample));
  });
  it("migrates v2 projects by filling Phase 2A defaults", () => {
    const v2 = {
      ...sample,
      version: 2,
      elements: sample.elements.map((e) => {
        if (e.type === "text") {
          const { fontFamily, align, vertical, lineHeight, opacity, ...rest } =
            e as Record<string, unknown>;
          return rest;
        }
        return e;
      }),
    };
    const migrated = openProject(JSON.stringify(v2));
    const title = migrated.elements[0];
    expect(title.type).toBe("text");
    if (title.type === "text") {
      expect(title.fontFamily).toBe("studio");
      expect(title.align).toBe("left");
      expect(title.vertical).toBe("top");
      expect(title.opacity).toBe(1);
    }
    expect(migrated).toEqual(sample);
  });
  it("round trips every new property through save/open", () => {
    for (const ex of EXAMPLE_PROJECTS) {
      const p = ex.build();
      expect(openProject(JSON.stringify(p))).toEqual(p);
    }
    expect(openProject(JSON.stringify(sample))).toEqual(sample);
  });
});

describe("basic element validation", () => {
  it("accepts horizontal, vertical, and diagonal lines but rejects points", () => {
    const p = blankProject();
    const h = { ...newElement("line"), id: "h", y2: 0 };
    const v = { ...newElement("line"), id: "v", x2: 0, y2: 120 };
    const d = { ...newElement("line"), id: "d", x2: -40, y2: 60 };
    expect(
      validateProject({ ...p, elements: [h, v, d] }).elements,
    ).toHaveLength(3);
    expect(() =>
      validateProject({
        ...p,
        elements: [{ ...newElement("line"), id: "dot", x2: 0, y2: 0 }],
      }),
    ).toThrow("endpoints must differ");
  });
  it("rejects undersized ellipses", () => {
    const p = blankProject();
    expect(() =>
      validateProject({
        ...p,
        elements: [{ ...newElement("ellipse"), id: "e", width: 10 }],
      }),
    ).toThrow();
  });
  it("supports solid-or-none paints without invalid colors", () => {
    const p = blankProject();
    const rect = {
      ...newElement("rectangle"),
      id: "r",
      fill: { kind: "none" as const },
      stroke: { kind: "fixed" as const, value: "#123456" },
    };
    expect(validateProject({ ...p, elements: [rect] })).toBeTruthy();
    expect(() =>
      validateProject({
        ...p,
        elements: [
          { ...newElement("rectangle"), id: "bad", fill: { kind: "fixed" as const, value: "red" } },
        ],
      }),
    ).toThrow();
  });
});

describe("text, ellipse, and line compilation", () => {
  it("exports alignment, placement, fonts, and multiline content", async () => {
    const p = {
      ...blankProject(),
      elements: [
        {
          ...newElement("text"),
          id: "t",
          x: 40, y: 40, width: 400, height: 120,
          content: "First line\nSecond line",
          fontFamily: "georgia",
          align: "center",
          vertical: "middle",
          lineHeight: 1.5,
          fontSize: 20,
          opacity: 0.8,
        },
      ],
    };
    const spec = compile(validateProject(p));
    const mark = spec.marks![0] as unknown as Record<string, never>;
    const update = (
      mark.encode as { update: Record<string, { value: unknown }> }
    ).update;
    expect(update["x"]).toEqual({ value: 240 });
    expect(update["y"]).toEqual({ value: 100 });
    expect(update["align"]).toEqual({ value: "center" });
    expect(update["baseline"]).toEqual({ value: "middle" });
    expect(update["font"]).toEqual({ value: FONT_STACKS.georgia });
    expect(update["lineBreak"]).toEqual({ value: "\n" });
    expect(update["lineHeight"]).toEqual({ value: 30 });
    expect(update["limit"]).toEqual({ value: 400 });
    expect(update["opacity"]).toEqual({ value: 0.8 });
    const svg = await svgOf(validateProject(p));
    expect(svg).toContain("First line");
    expect(svg).toContain("Second line");
  });
  it("keeps the selection rectangle on the layout bounds", () => {
    const p = validateProject({
      ...blankProject(),
      elements: [
        { ...newElement("text"), id: "t", x: 40, y: 40, width: 400, height: 120 },
      ],
    });
    expect(bounds(p, p.elements[0])).toEqual({
      x: 40, y: 40, width: 400, height: 120,
    });
  });
  it("renders ellipses as native Vega paths with exact dimensions", async () => {
    const p = validateProject({
      ...blankProject(),
      elements: [
        { ...newElement("ellipse"), id: "e", x: 40, y: 40, width: 200, height: 100 },
      ],
    });
    const spec = compile(p);
    const mark = spec.marks![0] as { type: string };
    expect(mark.type).toBe("path");
    const svg = await svgOf(p);
    expect(svg).toContain("<path");
  });
  it("renders lines as Vega rules with caps and dashes", async () => {
    const p = validateProject({
      ...blankProject(),
      elements: [
        {
          ...newElement("line"), id: "l", x: 10, y: 20, x2: 100, y2: 0,
          cap: "round", strokeDash: "dashed",
        },
      ],
    });
    const spec = compile(p);
    const update = (
      (spec.marks![0] as { encode: { update: Record<string, { value: unknown }> } })
        .encode.update
    );
    expect(update["x2"]).toEqual({ value: 110 });
    expect(update["strokeCap"]).toEqual({ value: "round" });
    expect(update["strokeDash"]).toEqual({ value: [6, 4] });
    await expect(svgOf(p)).resolves.toContain("<line");
  });
  it("keeps line endpoints in world space through grouping", () => {
    const p = validateProject({
      ...blankProject(),
      elements: [{ ...newElement("line"), id: "l", x: 100, y: 100, x2: 50, y2: 0 }],
    });
    const g = groupLayers(p, ["l"]);
    const moved = moveLayers(g.project, [g.id], 20, 30);
    const line = moved.elements.find((e) => e.id === "l")! as LineEl;
    expect(worldEndpoints(moved, line)).toEqual({
      x1: 120, y1: 130, x2: 170, y2: 130,
    });
    // Offsets are untouched: only the origin moved.
    expect(line.x2).toBe(50);
    expect(line.y2).toBe(0);
  });
});

describe("bar chart configuration", () => {
  it("compiles both orientations with transposed scales", async () => {
    const h = barsExample().elements[1] as Bar;
    const v = barsExample().elements[2] as Bar;
    const hSpec = compile(
      validateProject({ ...barsExample(), elements: [barsExample().elements[0], h] }),
    );
    const vSpec = compile(
      validateProject({ ...barsExample(), elements: [barsExample().elements[0], v] }),
    );
    const hGroup = hSpec.marks![1] as { scales: { name: string; type: string }[] };
    const vGroup = vSpec.marks![1] as { scales: { name: string; type: string }[] };
    expect(hGroup.scales.find((s) => s.name === "x")!.type).toBe("linear");
    expect(hGroup.scales.find((s) => s.name === "y")!.type).toBe("band");
    expect(vGroup.scales.find((s) => s.name === "x")!.type).toBe("band");
    expect(vGroup.scales.find((s) => s.name === "y")!.type).toBe("linear");
    await expect(svgOf(barsExample())).resolves.toContain("GET /status");
  });
  it("sorts each chart independently without mutating shared rows", async () => {
    const p = barsExample();
    const before = structuredClone(resolvedRows(p, "source"));
    const ds = (p.elements[1] as Bar).sort === "value-desc"
      ? chartDataset(p.elements[1] as Bar)
      : null;
    expect(ds!.transform).toEqual([
      { type: "filter", expr: "true" },
      { type: "collect", sort: { field: "requests", order: "descending" } },
    ]);
    const view = new View(parse(compile(p)), { renderer: "none" });
    try {
      await view.runAsync();
      const requests = view.data("data_requests") as { endpoint: string }[];
      const errors = view.data("data_errors") as { endpoint: string }[];
      expect(requests[0].endpoint).toBe("GET /status");
      expect(errors[0].endpoint).toBe("GET /assets");
      expect(resolvedRows(p, "source")).toEqual(before);
    } finally {
      view.finalize();
    }
  });
  it("formats numbers, percentages, and bytes without Vega percent scaling", () => {
    expect(formatValueText("number", 0, 42)).toBe("42");
    expect(formatValueText("number", 2, 42.567)).toBe("42.57");
    expect(formatValueText("percent", 0, 42)).toBe("42%");
    expect(formatValueText("percent", 1, 42.5)).toBe("42.5%");
    expect(formatValueText("bytes", 1, 512)).toBe("512 B");
    expect(formatValueText("bytes", 1, 2048)).toBe("2.0 KB");
    expect(formatValueText("bytes", 1, 5 * 1048576)).toBe("5.0 MB");
    const signal = valueSignal(
      { valueFormat: "percent", decimals: 0 } as Bar,
      "datum.v",
    );
    expect(signal).toBe("format(datum.v, '.0f')+'%'");
    expect(signal).not.toContain("'.0%'");
  });
  it("shows stored percentage values verbatim in labels", async () => {
    const svg = await svgOf(dashboardExample());
    expect(svg).toContain("42.5%");
  });
  it("keeps threshold colors and legend in sync; single mode hides the legend", async () => {
    const p = structuredClone(barsExample());
    const t = p.elements[2] as Bar;
    expect(t.colorMode).toBe("threshold");
    expect(thresholdColor(t, 10)).toBe(t.color.value);
    expect(thresholdColor(t, 20)).toBe(t.warningColor.value);
    expect(thresholdColor(t, 40)).toBe(t.criticalColor.value);
    const withLegend = await svgOf(p);
    expect(withLegend).toContain("Critical");
    (p.elements[2] as Bar).showLegend = false;
    const withoutLegend = await svgOf(validateProject(p));
    expect(withoutLegend).not.toContain("Critical");
    (p.elements[1] as Bar).colorMode = "single";
    const single = compile(validateProject(p));
    expect(JSON.stringify(single)).not.toContain("Warning");
  });
  it("clamps visuals above axisMax while labels keep the true value", async () => {
    const p = structuredClone(sample);
    (resolvedRows(p, "source")[0] as Record<string, string | number | null>).usage_pct = 999;
    const chart = p.elements[2] as Bar;
    const svg = await svgOf(validateProject(p));
    expect(svg).toContain("999");
    const spec = compile(validateProject(p));
    const group = spec.marks![2] as { scales: { clamp?: boolean }[] };
    expect(group.scales[0].clamp).toBe(true);
    expect(chart.axisMax).toBe(100);
  });
  it("extends rather than duplicates the chart: one bar implementation", () => {
    const bars = sample.elements.filter((e) => e.type === "bar");
    expect(bars).toHaveLength(1);
    expect(
      compile(sample).data!.map((d) => (d as { name: string }).name),
    ).toEqual(["source", "data_queues"]);
  });
});

describe("registry and palette", () => {
  it("describes every element type with capabilities and sections", () => {
    const kinds = ["group", "text", "rectangle", "ellipse", "line", "bar"] as const;
    for (const kind of kinds) {
      const def = ELEMENTS[kind];
      expect(def.displayName).toBeTruthy();
      expect(def.sections.length).toBeGreaterThan(0);
    }
    expect(ELEMENTS.bar.capabilities.bindings).toBe(true);
    expect(ELEMENTS.line.capabilities.endpoints).toBe(true);
    expect(ELEMENTS.ellipse.capabilities.aspectLock).toBe(true);
    expect(ELEMENTS.text.capabilities.resize).toBe(true);
    expect(PALETTE.flatMap((c) => c.items)).toEqual([
      "text", "rectangle", "ellipse", "line", "bar",
    ]);
  });
  it("creates a valid working element for every palette entry", () => {
    const create = newElement as (t: Element["type"]) => Element;
    for (const item of PALETTE.flatMap((c) => c.items)) {
      const p = validateProject({
        ...blankProject(),
        elements: [create(item)],
      });
      expect(p.elements).toHaveLength(1);
      expect(compile(p, undefined, true)).toBeTruthy();
    }
  });
});

describe("composition, distribution, and history", () => {
  const fixture = (): Project => ({
    ...blankProject(),
    elements: [
      { ...newElement("rectangle"), id: "a", x: 0, y: 0, width: 100, height: 100 },
      { ...newElement("rectangle"), id: "b", x: 150, y: 0, width: 100, height: 100 },
      { ...newElement("rectangle"), id: "c", x: 400, y: 0, width: 100, height: 100 },
    ],
  });
  it("aligns selection roots by world bounds, including nested groups", () => {
    const g = groupLayers(fixture(), ["a"]);
    const p = alignRoots(g.project, ["b", g.id], 2);
    expect(bounds(p, p.elements.find((e) => e.id === "b")!).x).toBe(800);
    expect(bounds(p, p.elements.find((e) => e.id === g.id)!).x).toBe(800);
  });
  it("distributes three layers with equal gaps in one commit", () => {
    const s = useEditor.getState();
    s.open(fixture());
    const before = useEditor.getState().past.length;
    s.commit(distribute(fixture(), ["a", "b", "c"], "x"));
    const p = useEditor.getState().project;
    const xs = ["a", "b", "c"].map(
      (id) => bounds(p, p.elements.find((e) => e.id === id)!).x,
    );
    expect(xs[1] - xs[0]).toBe(xs[2] - xs[1]);
    expect(useEditor.getState().past.length).toBe(before + 1);
    s.undo();
    expect(useEditor.getState().project).toEqual(fixture());
  });
  it("never double-transforms a group selected with its child", () => {
    const g = groupLayers(fixture(), ["a", "b"]);
    const roots = selectionRoots(g.project, [g.id, "a"]);
    expect(roots.map((e) => e.id)).toEqual([g.id]);
  });
  it("respects locks across align and distribute", () => {
    const p = fixture();
    const locked = {
      ...p,
      elements: p.elements.map((e) =>
        e.id === "c" ? { ...e, locked: true } : e,
      ),
    };
    expect(() => alignRoots(locked, ["c"], 0)).toThrow("Unlock");
    expect(() => distribute(locked, ["a", "b", "c"], "x")).toThrow(
      "three or more unlocked",
    );
  });
  it("snaps coordinates to the grid", async () => {
    const { snapValue } = await import("../src/commands");
    expect(snapValue(13)).toBe(16);
    expect(snapValue(11)).toBe(8);
  });
});

describe("generated samples", () => {
  it.each(["logstash", "shapes", "bars", "dashboard"])(
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
  it("keeps the Logstash sample on the inline fixed-size contract", async () => {
    const svg = await svgOf(sample);
    expect(svg).toContain("Logstash queue usage");
    expect(compile(sample).autosize).toBe("none");
    expect(JSON.stringify(compile(sample))).not.toContain('"url"');
  });
});
