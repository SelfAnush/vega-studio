import { describe, expect, it } from "vitest";
import { blankProject, newElement, validateProject } from "../src/model";
import { useEditor } from "../src/store";
import { resizeBox, resizeGroup, groupLayers } from "../src/commands";
import { bounds } from "../src/hierarchy";

describe("editor regressions", () => {
  it("cancelling a live edit restores full undo and redo history", () => {
    const s = useEditor.getState(), rectangle = newElement("rectangle");
    s.open({ ...blankProject(), elements: [rectangle] });
    for (let i = 0; i < 102; i++) s.edit(rectangle.id, { name: `Layer ${i}` });
    s.undo();
    const before = useEditor.getState();
    const group = Symbol("color picker");
    s.edit(rectangle.id, { opacity: 0.3 }, group);
    s.edit(rectangle.id, { opacity: 0.6 }, group);
    s.edit(rectangle.id, { opacity: 1 }, group);
    expect(useEditor.getState().project).toEqual(before.project);
    expect(useEditor.getState().past).toEqual(before.past);
    expect(useEditor.getState().future).toEqual(before.future);
    s.redo();
    expect(useEditor.getState().project.elements[0].name).toBe("Layer 101");
    const full = useEditor.getState();
    s.edit(rectangle.id, { opacity: 0.2 }, group);
    s.edit(rectangle.id, { opacity: 1 }, group);
    expect(useEditor.getState().past).toEqual(full.past);
  });
  it("groups live edits without merging across other edits, undo, or save", () => {
    const s = useEditor.getState(), rectangle = newElement("rectangle");
    s.open({ ...blankProject(), elements: [rectangle] });
    const group = Symbol("opacity edit");
    s.edit(rectangle.id, { opacity: 0.5 }, group);
    s.edit(rectangle.id, { opacity: 0.25 }, group);
    expect(useEditor.getState().past).toHaveLength(1);
    s.edit(rectangle.id, { name: "Renamed" });
    s.edit(rectangle.id, { opacity: 0.1 }, group);
    expect(useEditor.getState().past).toHaveLength(3);
    s.undo();
    expect(useEditor.getState().project.elements[0]).toMatchObject({ name: "Renamed", opacity: 0.25 });
    s.edit(rectangle.id, { opacity: 0.2 }, group);
    expect(useEditor.getState().past).toHaveLength(3);
    expect(useEditor.getState().future).toHaveLength(0);
    s.markSaved();
    s.edit(rectangle.id, { opacity: 0.3 }, group);
    expect(useEditor.getState().past).toHaveLength(4);
    s.undo();
    expect(useEditor.getState().project.elements[0]).toMatchObject({ opacity: 0.2 });
  });
  it("clamps group shrinking before a child violates document size limits", () => {
    const rectangle = newElement("rectangle");
    const grouped = groupLayers({ ...blankProject(), elements: [rectangle] }, [rectangle.id]);
    const group = grouped.project.elements.find((e) => e.id === grouped.id)!;
    const box = bounds(grouped.project, group);
    const resized = resizeGroup(grouped.project, group.id, box, { ...box, width: 8, height: 8 });
    expect(() => validateProject(resized)).not.toThrow();
  });
  it("prunes deleted selections through commit, undo and redo", () => {
    const s = useEditor.getState();
    s.open(blankProject());
    const a = newElement("rectangle"), b = newElement("rectangle");
    s.commit({ ...useEditor.getState().project, elements: [a] });
    s.commit({ ...useEditor.getState().project, elements: [a, b] });
    s.selectMany([a.id, b.id]);
    s.undo();
    expect(useEditor.getState().selection).toEqual([a.id]);
    expect(useEditor.getState().selected).toBe(a.id);
    s.redo();
    s.commit({ ...useEditor.getState().project, elements: [b] });
    expect(useEditor.getState().selection).toEqual([]);
    s.undo();
    s.select(a.id);
    s.redo();
    expect(useEditor.getState().selected).toBeNull();
  });

  it("preserves the aspect ratio when either minimum dimension is reached", () => {
    const wide = resizeBox({ x: 0, y: 0, width: 200, height: 40 }, "nw", 190, 0, 20, 20, true);
    expect(wide).toEqual({ x: 100, y: 20, width: 100, height: 20 });
    const tall = resizeBox({ x: 0, y: 0, width: 40, height: 200 }, "se", 0, -190, 20, 20, true);
    expect(tall.width / tall.height).toBe(0.2);
    expect(tall.width).toBe(20);
  });
});
