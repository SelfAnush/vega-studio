import { test, expect } from "@playwright/test";

test("drag renders actual artwork without covering the grid or underlying layers", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.evaluate(async () => {
    const modelPath = "/src/model.ts", storePath = "/src/store.ts";
    const { newElement } = await import(modelPath);
    const { useEditor } = await import(storePath);
    const s = useEditor.getState();
    const back = { ...newElement("rectangle"), x: 150, y: 150, width: 240, height: 160,
      fill: { kind: "fixed", value: "#dd5544" } };
    const front = { ...newElement("rectangle"), x: 170, y: 170, width: 140, height: 70,
      fill: { kind: "fixed", value: "#5566dd" }, opacity: 0.7 };
    s.commit({ ...s.project, elements: [back, front] });
    s.select(front.id);
    s.toggleGridVisible();
    s.toggleGuidesSnap();
    Object.assign(window, { dragProbe: useEditor });
  });
  const artwork = page.locator('[data-testid="vega-render"] [fill="#5566dd"]');
  const backArt = page.locator('[data-testid="vega-render"] [fill="#dd5544"]');
  const original = await artwork.boundingBox();
  const backOriginal = await backArt.boundingBox();
  const before = await page.evaluate(() => JSON.stringify((window as any).dragProbe.getState().project));
  await page.mouse.move(original!.x + 30, original!.y + 30);
  await page.mouse.down();
  await page.mouse.move(original!.x + 230, original!.y + 130, { steps: 8 });
  await expect.poll(async () => (await artwork.boundingBox())?.x).toBeGreaterThan(original!.x + 100);
  expect(await backArt.boundingBox()).toEqual(backOriginal);
  await expect(page.locator(".drag-mask")).toHaveCount(0);
  await expect(page.locator(".canvas-grid")).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify((window as any).dragProbe.getState().project))).toBe(before);
  await page.screenshot({ path: testInfo.outputPath("live-drag-grid.png") });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(async () => (await artwork.boundingBox())?.x).toBe(original!.x);
  expect(await page.evaluate(() => JSON.stringify((window as any).dragProbe.getState().project))).toBe(before);
  expect(errors).toEqual([]);
});

test("chart inspector has unique keys and Shift resize keeps its ratio with snapping", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name: "Horizontal bar chart", exact: true }).click();
  await page.evaluate(async () => {
    const path = "/src/store.ts";
    const { useEditor } = await import(path);
    const s = useEditor.getState();
    s.setGridSpacing(37);
    s.toggleSnap();
    Object.assign(window, { resizeProbe: useEditor });
  });
  const before = await page.evaluate(() => (window as any).resizeProbe.getState().project.elements[0]);
  const handle = await page.getByTestId("resize-se").boundingBox();
  await page.keyboard.down("Shift");
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + 75, handle!.y + 30, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const after = await page.evaluate(() => (window as any).resizeProbe.getState().project.elements[0]);
  expect(after.width).not.toBe(before.width);
  expect(after.width / after.height).toBeCloseTo(before.width / before.height, 6);
  expect(errors).toEqual([]);
});

test("pending paste preserves intervening edits and cancels after opening another document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.evaluate(async () => {
    const modelPath = "/src/model.ts", storePath = "/src/store.ts";
    const { newElement, blankProject } = await import(modelPath);
    const { useEditor } = await import(storePath);
    const payload = JSON.stringify({ app: "vega-studio", schema: 4, elements: [newElement("rectangle")] });
    const pending: Array<(text: string) => void> = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      readText: () => new Promise<string>((resolve) => pending.push(resolve)),
    } });
    Object.assign(window, { pasteProbe: { pending, payload, useEditor, newElement, blankProject } });
  });
  await page.keyboard.press("Control+v");
  await page.evaluate(() => {
    const p = (window as any).pasteProbe;
    const s = p.useEditor.getState();
    s.commit({ ...s.project, elements: [p.newElement("ellipse")] });
    p.pending.shift()(p.payload);
  });
  await expect(page.locator(".layer-list .layer-name")).toHaveCount(2);
  await page.keyboard.press("Control+v");
  await page.evaluate(() => {
    const p = (window as any).pasteProbe;
    p.useEditor.getState().open(p.blankProject());
    p.pending.shift()(p.payload);
  });
  await expect(page.locator(".layer-list .layer-name")).toHaveCount(0);
});

test("snapping a line endpoint leaves the opposite endpoint fixed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.evaluate(async () => {
    const modelPath = "/src/model.ts", storePath = "/src/store.ts";
    const { newElement } = await import(modelPath);
    const { useEditor } = await import(storePath);
    const s = useEditor.getState();
    const line = { ...newElement("line"), x: 53, y: 57, x2: 103, y2: 41 };
    s.commit({ ...s.project, elements: [line] });
    s.select(line.id);
    s.setGridSpacing(24);
    s.toggleSnap();
    Object.assign(window, { lineProbe: useEditor });
  });
  for (const endpoint of ["end", "start"]) {
    const before = await page.evaluate(() => (window as any).lineProbe.getState().project.elements[0]);
    const handle = await page.getByTestId(`endpoint-${endpoint}`).boundingBox();
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle!.x + handle!.width / 2 + 40, handle!.y + handle!.height / 2 + 25, { steps: 4 });
    await page.mouse.up();
    const after = await page.evaluate(() => (window as any).lineProbe.getState().project.elements[0]);
    if (endpoint === "end") {
      expect([after.x, after.y]).toEqual([before.x, before.y]);
      expect((after.x + after.x2) % 24).toBe(0);
    } else {
      expect([after.x + after.x2, after.y + after.y2]).toEqual([before.x + before.x2, before.y + before.y2]);
      expect(after.x % 24).toBe(0);
    }
  }
});
