import { test, expect, type Page } from "@playwright/test";

const add = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
};
const set = async (page: Page, label: string, value: string) => {
  await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel(label, { exact: true }).press("Tab");
};
const layerCount = (page: Page) =>
  page.locator(".layer-list .layer-name").count();

test("full-window layout fits 1366x768 and 1920x1080 without page scroll", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const create = page.getByRole("button", { name: "Create project" });
    await expect(create).toBeVisible();
    const bb = await create.boundingBox();
    expect(bb!.y + bb!.height).toBeLessThanOrEqual(viewport.height);
    await create.click();
    await expect(
      page.getByRole("button", { name: "Export Vega" }),
    ).toBeVisible();
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - window.innerWidth,
      y: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(overflow.x).toBeLessThanOrEqual(1);
    expect(overflow.y).toBeLessThanOrEqual(1);
    await expect(page.locator(".layers")).toBeVisible();
    await expect(page.locator(".properties")).toBeVisible();
    await expect(page.locator(".canvas-stage")).toBeVisible();
    await page.getByRole("button", { name: "Home", exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test("palette drop creates at drop point; moves show live art; escape cancels", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  expect(await layerCount(page)).toBe(0);

  // Drag from the palette onto the canvas.
  await page.getByRole("button", { name: "Add element" }).click();
  const shell = page.locator(".panel-shell");
  const shellBox = await shell.boundingBox();
  await page
    .getByRole("menuitem", { name: "Rectangle", exact: true })
    .dragTo(shell, {
      targetPosition: {
        x: shellBox!.width / 2,
        y: shellBox!.height / 2,
      },
    });
  expect(await layerCount(page)).toBe(1);
  await expect(page.locator(".placement-ghost")).toHaveCount(0);
  const overlay = page.locator(".element-overlay.selected");
  const placed = await overlay.boundingBox();
  // Roughly centered on the 900x560 canvas (zoom-to-fit may scale).
  expect(placed!.width).toBeGreaterThan(50);

  // Dropping outside the canvas (Escape cancels the drag) creates nothing.
  await page.getByRole("button", { name: "Add element" }).click();
  const item = page.getByRole("menuitem", { name: "Ellipse", exact: true });
  const ibox = await item.boundingBox();
  await page.mouse.move(ibox!.x + 10, ibox!.y + 10);
  await page.mouse.down();
  await page.mouse.move(shellBox!.x + 60, shellBox!.y + 60, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await layerCount(page)).toBe(1);

  // Live move: the visible representation follows the pointer mid-drag.
  const before = await overlay.boundingBox();
  await page.mouse.move(before!.x + 30, before!.y + 30);
  await page.mouse.down();
  await page.mouse.move(before!.x + 90, before!.y + 70, { steps: 6 });
  await expect(page.locator(".drag-preview")).toBeVisible();
  const mid = await overlay.boundingBox();
  expect(Math.abs(mid!.x - before!.x)).toBeGreaterThan(5);
  await page.mouse.up();
  const after = await page.getByLabel("X", { exact: true }).inputValue();
  expect(Number(after)).not.toBe(48);

  // Escape cancels and restores the previous state.
  const xBefore = await page.getByLabel("X", { exact: true }).inputValue();
  const box2 = await overlay.boundingBox();
  await page.mouse.move(box2!.x + 20, box2!.y + 20);
  await page.mouse.down();
  await page.mouse.move(box2!.x + 120, box2!.y + 80, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue(xBefore);
  await page.screenshot({
    path: testInfo.outputPath("drop-and-drag.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("copy and paste layers, groups, and undo in one step", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await add(page, "Rectangle");
  await set(page, "Layer name", "Solo");
  await add(page, "Rectangle");
  await set(page, "Layer name", "Mate");

  // Focus leaves inputs first: shortcuts never hijack text editing.
  await page.getByRole("button", { name: "Mate", exact: true }).click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  expect(await layerCount(page)).toBe(3);
  // Rename the pasted copy so names stay unambiguous below.
  await set(page, "Layer name", "Mate copy");

  // Group both originals, copy the group, paste: subtree comes along.
  await page.getByRole("button", { name: "Solo", exact: true }).click();
  await page
    .getByRole("button", { name: "Mate", exact: true })
    .click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Group selection" }).click();
  const grouped = await layerCount(page);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  expect(await layerCount(page)).toBe(grouped + 3);
  // One undo removes the whole paste.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await layerCount(page)).toBe(grouped);

  // Locked selections refuse to copy with an explanation.
  await page.getByRole("button", { name: "Solo", exact: true }).click();
  await page.getByRole("button", { name: "Lock Solo", exact: true }).click();
  await page.keyboard.press("Control+c");
  await expect(page.getByRole("alert")).toContainText("Unlock");
  expect(errors).toEqual([]);
});

test("legends show all states with units; zoom anchors; grid and resize work", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Service load panel" }).click();
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "Healthy < 70.0%",
  );
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "Critical ≥ 90.0%",
  );

  // Pointer-anchored zoom: the canvas point under the cursor stays put.
  const stage = page.locator(".canvas-stage");
  const stageBox = await stage.boundingBox();
  const mx = stageBox!.x + stageBox!.width / 2;
  const my = stageBox!.y + stageBox!.height / 2;
  const target = page.locator(".element-overlay").first();
  const p0 = await target.boundingBox();
  const zoomText = page.locator(".zoom-control span").first();
  const z0 = await zoomText.textContent();
  const canvasWidthBefore = (await page.locator(".panel-shell").boundingBox())!.width;
  await stage.dispatchEvent("wheel", {
    deltaY: -240,
    deltaMode: 0,
    ctrlKey: true,
    clientX: mx,
    clientY: my,
  });
  await expect(zoomText).not.toHaveText(z0!);
  // The displayed percentage is rounded; measure actual scale at any panel width.
  const f = (await page.locator(".panel-shell").boundingBox())!.width / canvasWidthBefore;
  const p1 = await target.boundingBox();
  expect(p1!.x).toBeCloseTo(mx + (p0!.x - mx) * f, 0);
  expect(p1!.y).toBeCloseTo(my + (p0!.y - my) * f, 0);

  // Grid settings live with Canvas properties, outside the toolbar.
  await page.getByRole("button", { name: /^Canvas \d/ }).click();
  await page.getByLabel("Show grid", { exact: true }).check();
  await expect(page.locator(".canvas-grid")).toBeVisible();
  await page.getByLabel("Grid spacing", { exact: true }).fill("24");
  await page.getByLabel("Grid spacing", { exact: true }).press("Tab");
  await expect(page.getByLabel("Grid spacing", { exact: true })).toHaveValue("24");
  await page.getByLabel("Snap to grid", { exact: true }).check();

  // Eight handles on a rectangle; corner resize is one undo step.
  // Fit first: at high zoom handles can sit beneath the side panels.
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByRole("button", { name: "Header", exact: true }).click();
  expect(await page.locator('[data-testid^="resize-"]').count()).toBe(8);
  const se = await page.getByTestId("resize-se").boundingBox();
  await page.mouse.move(se!.x + 4, se!.y + 4);
  await page.mouse.down();
  await page.mouse.move(se!.x + 44, se!.y + 24, { steps: 6 });
  await page.mouse.up();
  const w = await page.getByLabel("Width", { exact: true }).inputValue();
  expect(Number(w)).toBeGreaterThan(952);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Width", { exact: true })).toHaveValue("952");

  // Export carries no editing overlays.
  await page.getByRole("button", { name: "Export Vega" }).click();
  const spec = await page.getByLabel("Generated Vega JSON").inputValue();
  expect(spec).not.toContain("element-overlay");
  expect(spec).not.toContain("selection-tag");
  expect(spec).not.toContain("resize-");
  await page.screenshot({
    path: testInfo.outputPath("legend-zoom-grid.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: testInfo.outputPath("legend-zoom-grid-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  expect(errors).toEqual([]);
});

test("layer rows drag to reorder in one undo step; escape cancels", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await add(page, "Text");
  await add(page, "Rectangle");
  await add(page, "Ellipse");

  // Layers list is top-of-stack first, so the last created row is on top.
  const names = () =>
    page.locator(".layer-list .layer-name span").allTextContents();
  const before = await names();
  expect(before).toHaveLength(3);

  // A plain click must still select: pointer capture on pointerdown would
  // retarget the derived click and silently break selection.
  await page.locator(".layer-row").first().locator(".layer-name").click();
  await expect(page.locator(".layer-row.active")).toHaveCount(1);

  // Drag the top row below the bottom one.
  const from = (await page.locator(".layer-row").first().boundingBox())!;
  const to = (await page.locator(".layer-row").last().boundingBox())!;
  await page.mouse.move(from.x + 120, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + from.height / 2 - 12, { steps: 4 });
  await page.mouse.move(to.x + 120, to.y + to.height - 3, { steps: 8 });
  // The insertion rule only appears when the drop would actually move it.
  await expect(page.locator(".drop-line")).toHaveCount(1);
  await testInfo.attach("drag", {
    body: await page.locator(".layers").screenshot(),
    contentType: "image/png",
  });
  await page.mouse.up();

  const after = await names();
  expect(after).not.toEqual(before);
  expect(after[2]).toBe(before[0]);

  // The whole move is a single history entry.
  await page.keyboard.press("Control+z");
  await expect.poll(() => names()).toEqual(before);

  // Escape mid-drag discards the gesture without changing the order.
  const a = (await page.locator(".layer-row").first().boundingBox())!;
  const b = (await page.locator(".layer-row").last().boundingBox())!;
  await page.mouse.move(a.x + 120, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 120, a.y + a.height / 2 - 12, { steps: 4 });
  await page.mouse.move(b.x + 120, b.y + b.height - 3, { steps: 8 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".drop-line")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(() => names()).toEqual(before);

  // Pressing an action button must never start a drag.
  const eye = page.locator('.layer-row .layer-action[aria-label^="Hide"]').first();
  const eyeBox = (await eye.boundingBox())!;
  await page.mouse.move(eyeBox.x + eyeBox.width / 2, eyeBox.y + eyeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(eyeBox.x + 120, eyeBox.y + 220, { steps: 8 });
  await expect(page.locator(".drop-line")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(() => names()).toEqual(before);

  expect(errors).toEqual([]);
});

test("data-bound text and elasticsearch export choices", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Sample data", exact: false }).click();
  await page
    .getByLabel("Sample data JSON")
    .fill('[{"s":"a","v":10},{"s":"b","v":90}]');
  await page.getByRole("button", { name: "Apply data" }).click();

  await add(page, "Text");
  await page.getByLabel("Bind content to data", { exact: true }).check();
  await page
    .getByLabel("Content reduce field", { exact: true })
    .selectOption("v");
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "100",
  );

  // Elasticsearch tab is blocked until a source exists.
  await page.getByRole("button", { name: "Export Vega" }).click();
  await page.getByRole("tab", { name: "Elasticsearch Query DSL" }).click();
  await expect(page.getByRole("alert")).toContainText("No Elasticsearch source");
  await page.getByRole("button", { name: "Close dialog" }).click();

  // Add and configure an ES dataset with a fixture.
  await page.getByRole("button", { name: "Sample data", exact: false }).click();
  await page.getByRole("button", { name: "Add Elasticsearch dataset" }).click();
  await page.getByLabel("Index pattern", { exact: true }).fill("logs-*");
  await page
    .getByLabel("Query DSL body", { exact: true })
    .fill('{"size":0,"aggs":{"cats":{"terms":{"field":"s"}}}}');
  await page.getByRole("button", { name: "Apply source" }).click();
  await page
    .getByLabel("Response fixture JSON")
    .fill('{"hits":{"hits":[{"_source":{"s":"a","v":1}}]}}');
  await page.getByRole("button", { name: "Extract fixture rows" }).click();
  await expect(page.getByText("1 fixture rows stored")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Export Vega" }).click();
  await page.getByRole("tab", { name: "Elasticsearch Query DSL" }).click();
  await expect(page.getByRole("status")).toContainText("Valid Vega");
  const spec = JSON.parse(
    await page.getByLabel("Generated Vega JSON").inputValue(),
  );
  const es = spec.data.find((d: { name: string }) => d.name === "es");
  expect(es.url).toMatchObject({ index: "logs-*" });
  expect(es.url["%context%"]).toBe(true);
  expect(es.format).toEqual({ property: "hits.hits._source" });
  await page.screenshot({
    path: testInfo.outputPath("es-export.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
