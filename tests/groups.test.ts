import { describe, it, expect } from "vitest";
import { View, parse } from "vega";
import {
  blankProject,
  newElement,
  openProject,
  sample,
  validateProject,
} from "../src/model";
import {
  groupLayers,
  ungroup,
  reparent,
  moveLayers,
  duplicateLayers,
  removeLayers,
  reorder,
} from "../src/commands";
import {
  worldPosition,
  isLocked,
  isVisible,
  children,
  ordered,
} from "../src/hierarchy";
import { compile } from "../src/compiler";
const fixture = () => ({
  ...blankProject(),
  elements: [
    { ...newElement("rectangle"), id: "a", x: 20, y: 30 },
    { ...newElement("text"), id: "b", x: 120, y: 130 },
  ],
});
describe("groups and migration", () => {
  it("migrates old flat projects without changing their design", () => {
    const old = {
      ...sample,
      version: 1,
      elements: sample.elements.map(({ parentId, ...e }) => e),
    };
    expect(openProject(JSON.stringify(old))).toEqual(sample);
  });
  it("groups, moves, and ungroups using local coordinates without data loss", () => {
    const p = fixture(),
      g = groupLayers(p, ["a", "b"]);
    const moved = moveLayers(g.project, [g.id], 50, 60);
    expect(
      worldPosition(
        moved,
        moved.elements.find((e) => e.id === "a")!,
      ),
    ).toEqual({ x: 70, y: 90 });
    const out = ungroup(moved, g.id);
    expect(out.elements.map((e) => e.id)).toEqual(["a", "b"]);
    expect(out.elements[0].x).toBe(70);
    expect(out.sources).toEqual(p.sources);
  });
  it("reparents while preserving world positions, rejecting cycles", () => {
    const g = groupLayers(fixture(), ["a"]);
    const p = reparent(g.project, ["b"], g.id);
    expect(
      worldPosition(
        p,
        p.elements.find((e) => e.id === "b")!,
      ),
    ).toEqual({ x: 120, y: 130 });
    const nested = groupLayers(p, ["a", "b"]);
    expect(() => reparent(nested.project, [g.id], nested.id)).toThrow(
      "descendants",
    );
    expect(reparent(p, ["b"], null).elements.find((e) => e.id === "b")!.x).toBe(
      120,
    );
  });
  it("inherits lock and visibility and prevents destructive locked operations", () => {
    const g = groupLayers(fixture(), ["a", "b"]);
    const p = {
      ...g.project,
      elements: g.project.elements.map((e) =>
        e.id === g.id ? { ...e, locked: true, visible: false } : e,
      ),
    };
    expect(isLocked(p, "a")).toBe(true);
    expect(isVisible(p, "b")).toBe(false);
    expect(moveLayers(p, [g.id], 30, 20)).toEqual(p);
    expect(() => removeLayers(p, [g.id])).toThrow("Unlock");
    expect(() => duplicateLayers(p, [g.id])).toThrow("Unlock");
    expect(() => ungroup(p, g.id)).toThrow("Unlock");
  });
  it("duplicates subtrees with fresh IDs and preserves sibling stacking", () => {
    const g = groupLayers(fixture(), ["a", "b"]);
    const copy = duplicateLayers(g.project, [g.id]);
    expect(copy.project.elements).toHaveLength(6);
    expect(new Set(copy.project.elements.map((e) => e.id)).size).toBe(6);
    expect(children(copy.project, copy.ids[0])).toHaveLength(2);
    const swapped = reorder(copy.project, copy.ids[0], -1);
    expect(children(swapped, null)[0].id).toBe(copy.ids[0]);
    expect(removeLayers(copy.project, copy.ids)).toEqual(g.project);
  });
  it("rejects orphan parents and cycles during file validation", () => {
    const p = fixture();
    p.elements[0].parentId = "missing";
    expect(() => validateProject(p)).toThrow("existing group");
    const g = newElement("group");
    g.parentId = g.id;
    expect(() => validateProject({ ...blankProject(), elements: [g] })).toThrow(
      "cycles",
    );
  });
  it("round trips nested groups and renders them as actual Vega groups", async () => {
    const g = groupLayers(fixture(), ["a", "b"]);
    const project = validateProject({
      ...g.project,
      elements: ordered(g.project),
    });
    expect(openProject(JSON.stringify(project))).toEqual(project);
    const spec = compile(project);
    expect(spec.marks?.[0].type).toBe("group");
    const view = new View(parse(spec), { renderer: "none" });
    try {
      expect(await view.toSVG()).toContain("Your text h");
    } finally {
      view.finalize();
    }
  });
  it("saves incomplete charts but blocks exports until explicitly configured", () => {
    const chart = newElement("bar");
    const p = { ...blankProject(), elements: [chart] };
    expect(openProject(JSON.stringify(p))).toEqual(p);
    expect(() => compile(p)).toThrow("Add data");
    expect(compile(p, undefined, true).marks).toEqual([]);
  });
});
