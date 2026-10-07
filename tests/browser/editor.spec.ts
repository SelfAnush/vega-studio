import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("edit, sample data, save/open, and export through the real editor", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole('button',{name:'Open example',exact:false}).click();
  await expect(page.locator('[data-testid="vega-render"] svg')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("initial-editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name: "Text", exact: true }).click();
  await page.getByLabel("Content", { exact: true }).fill("Operations overview");
  await page.getByLabel("Content", { exact: true }).press("Tab");
  await page.getByLabel("Font size", { exact: true }).fill("20");
  await page.getByLabel("Font size", { exact: true }).press("Tab");
  await page.getByLabel("Y", { exact: true }).fill("520");
  await page.getByLabel("Y", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
  await page.getByLabel("Y", { exact: true }).fill("112");
  await page.getByLabel("Y", { exact: true }).press("Tab");
  await page.getByLabel("Height", { exact: true }).fill("8");
  await page.getByLabel("Height", { exact: true }).press("Tab");
  await expect(page.getByRole("alert")).toContainText("height");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByLabel("Height", { exact: true }).fill("20");
  await page.getByLabel("Height", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Queue usage", exact: true }).click();
  await page.getByLabel("Warning at", { exact: true }).fill("60");
  await page.getByLabel("Warning at", { exact: true }).press("Tab");
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "Healthy < 60",
  );
  await page
    .getByRole("button", { name: "Sample data", exact: false })
    .first()
    .click();
  const data = JSON.parse(
    await page.getByLabel("Sample data JSON").inputValue(),
  );
  data[0].usage_pct = 99;
  await page.getByLabel("Sample data JSON").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Apply data" }).click();
  await expect(page.locator('[data-testid="vega-render"]')).toContainText("99");
  await page.screenshot({
    path: testInfo.outputPath("edited-editor.png"),
    fullPage: true,
  });
  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await saving;
  const path = (await saved.path())!;
  const project = JSON.parse(await readFile(path, "utf8"));
  expect(project.elements).toHaveLength(5);
  expect(project.sources[0].rows[0].usage_pct).toBe(99);
  await page.getByLabel("Warning at", { exact: true }).fill("61");
  await page.getByLabel("Warning at", { exact: true }).press("Tab");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Open project file").setInputFiles(path);
  await expect(page.getByLabel("Saved",{exact:true})).toBeVisible();
  const resaving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const reopenedPath = (await (await resaving).path())!;
  expect(JSON.parse(await readFile(reopenedPath, "utf8"))).toEqual(project);
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "Healthy < 60",
  );
  await page.getByRole("button", { name: "Export Vega" }).click();
  await expect(page.getByRole("status")).toContainText("Valid Vega 6.2.0");
  const spec = JSON.parse(
    await page.getByLabel("Generated Vega JSON").inputValue(),
  );
  expect(spec.data[0].values).toEqual(project.sources[0].rows);
  expect(spec.marks).toHaveLength(5);
  const exporting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  expect((await exporting).suggestedFilename()).toContain(".vega.json");
  expect(errors).toEqual([]);
});

test("layer actions, field bindings, viewport and input-safe shortcuts", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole('button',{name:'Open example',exact:false}).click();
  await page.getByRole('button',{name:'Queue usage',exact:true}).click();
  await page
    .getByLabel("Category field", { exact: true })
    .selectOption("pipeline");
  await expect(page.getByRole("alert")).toContainText("Duplicate category");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByLabel("Category field", { exact: true }).selectOption("host");
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "worker-01",
  );
  await page
    .getByRole("button", { name: "Hide Queue usage", exact: true })
    .click();
  await expect(page.getByTestId("overlay-queues")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show Queue usage", exact: true })
    .click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
  await page.getByRole('button',{name:'Fill',exact:true}).click();
  await page.getByLabel('Hex color').fill('#334455');
  await page.getByRole('button',{name:'Apply color'}).click();
  await page.getByLabel("Opacity", { exact: true }).fill("0.5");
  await page.getByLabel("Opacity", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Align right", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("660");
  await page.getByRole("button", { name: "Align center", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("330");
  await page.getByRole("button", { name: "Align left", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("0");
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rectangle copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move layer down", exact: true })
    .click();
  await expect(page.locator(".layer-name").first()).toHaveText("Rectangle");
  await page
    .getByRole("button", { name: "Move layer up", exact: true })
    .click();
  await expect(page.locator(".layer-name").first()).toHaveText(
    "Rectangle copy",
  );
  await page.getByRole("button", { name: "Delete layer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rectangle copy", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Panel title", exact: true }).click();
  await page.getByLabel("Content", { exact: true }).focus();
  await page.getByLabel("Content", { exact: true }).press("Control+a");
  await page.getByLabel("Content", { exact: true }).press("Backspace");
  await expect(
    page.getByRole("button", { name: "Panel title", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Content", { exact: true }).fill("Updated title");
  await page.getByLabel("Content", { exact: true }).press("Tab");
  await page.getByRole('button',{name:'Canvas 900 × 560',exact:true}).click();
  await page.getByLabel("Canvas width", { exact: true }).fill("1000");
  await page.getByLabel("Canvas width", { exact: true }).press("Tab");
  await expect(page.locator(".panel-shell")).toHaveCSS("width", "1000px");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.locator(".zoom-control")).toContainText("90%");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  const shell = page.locator(".panel-shell");
  const before = await shell.boundingBox();
  await page.getByRole("button", { name: "Pan tool", exact: true }).click();
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(740, 540, { steps: 4 });
  await page.mouse.up();
  expect((await shell.boundingBox())!.x).toBeCloseTo(before!.x + 40, 0);
  await page.getByRole("button", { name: "Export Vega" }).click();
  await expect(page.getByRole("status")).toContainText("Valid Vega");
  await page.getByRole("button", { name: "Copy JSON", exact: true }).click();
  expect(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).width,
  ).toBe(1000);
});

test("pointer gestures are one undo step; lock prevents edits; resize preserves data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole('button',{name:'Open example',exact:false}).click();
  const box = page.getByTestId("overlay-queues");
  await expect(box).toBeVisible();
  const before = await box.boundingBox();
  await page.mouse.move(before!.x + 100, before!.y + 50);
  await page.mouse.down();
  await page.mouse.move(before!.x + 145, before!.y + 70, { steps: 12 });
  await page.mouse.up();
  const after = await page.getByLabel("X", { exact: true }).inputValue();
  expect(Number(after)).toBeGreaterThan(40);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("40");
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue(after);
  const handle = await page.getByTestId("resize-se").boundingBox();
  await page.mouse.move(handle!.x + 5, handle!.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle!.x - 55, handle!.y - 35, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel("Width", { exact: true })).not.toHaveValue(
    "820",
  );
  await page
    .getByRole("button", { name: "Lock Queue usage", exact: true })
    .click();
  await expect(page.getByLabel("X", { exact: true })).toBeDisabled();
  await page.keyboard.press("Delete");
  await expect(box).toBeVisible();
  await page
    .getByRole("button", { name: "Unlock Queue usage", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sample data", exact: false })
    .first()
    .click();
  expect(
    JSON.parse(await page.getByLabel("Sample data JSON").inputValue()).map(
      (r: { usage_pct: number }) => r.usage_pct,
    ),
  ).toEqual([32, 48, 72, 91, 58]);
});

test("bad files and bad data are actionable and preserve the project", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole('button',{name:'Open example',exact:false}).click();
  await page.getByLabel("Open project file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":9}'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Unsupported project version",
  );
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "Logstash queue usage",
  );
  await page
    .getByRole("button", { name: "Sample data", exact: false })
    .first()
    .click();
  await page
    .getByLabel("Sample data JSON")
    .fill('[{"label":"x","usage_pct":1},{"label":"x","usage_pct":2}]');
  await page.getByRole("button", { name: "Apply data" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Duplicate category",
  );
  await page.getByLabel("Sample data JSON").fill("not json");
  await page.getByRole("button", { name: "Apply data" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Invalid JSON",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator('[data-testid="vega-render"]')).toContainText(
    "edge-01 / ingest",
  );
});
