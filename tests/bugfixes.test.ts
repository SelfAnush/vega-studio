import { describe, expect, it } from "vitest";
import { blankProject, newElement, validateProject } from "../src/model";
import { useEditor } from "../src/store";
import { resizeBox, resizeGroup, groupLayers } from "../src/commands";
import { bounds } from "../src/hierarchy";

describe("editor regressions", () => {
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
