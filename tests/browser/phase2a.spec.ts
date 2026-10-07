import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const add = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
};
const set = async (page: Page, label: string, value: string) => {
  await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel(label, { exact: true }).press("Tab");
};
const save = async (page: Page) => {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = (await (await event).path())!;
  return { file, project: JSON.parse(await readFile(file, "utf8")) };
};
// Inspector sections are native <details> disclosures so the whole panel can
// be collapsed; the align/distribute block is the one containing "equal gaps".
const arrangeScope = (page: Page) =>
  page
    .locator("aside.properties section, aside.properties details", {
      hasText: "equal gaps",
    })
    .first();

test("add and style new basics, group, save/open, export", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();

  await add(page, "Rectangle");
  await page.getByLabel("Fill style", { exact: true }).selectOption("none");
  await page
    .getByLabel("Stroke style", { exact: true })
    .selectOption("fixed");
  await set(page, "Corner radius", "16");

  await add(page, "Ellipse");
  await page
    .locator(".check-field", { hasText: "Lock aspect" })
    .locator("input")
    .check();

  await add(page, "Line");
  await set(page, "End X", "300");
  await expect(page.getByLabel("End X", { exact: true })).toHaveValue("300");

  await add(page, "Text");
  await page.getByLabel("Content", { exact: true }).fill("First line\nSecond line");
  await page.getByLabel("Content", { exact: true }).press("Tab");
  await page.getByLabel("Text alignment", { exact: true }).selectOption("center");
  await page.screenshot({
    path: testInfo.outputPath("basics.png"),
    fullPage: true,
  });

  // Multiselect rectangle + ellipse, then group.
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page
    .getByRole("button", { name: "Ellipse", exact: true })
    .click({ modifiers: ["Shift"] });
  await expect(
    page.getByRole("heading", { name: "2 layers selected" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Group selection" }).click();
  await expect(
    page.getByRole("button", { name: "Rectangle", exact: true }),
  ).toBeVisible();

  const saved = await save(page);
  expect(saved.project.version).toBe(4);
  expect(
    saved.project.elements.map((e: { type: string }) => e.type).sort(),
  ).toEqual(["ellipse", "group", "line", "rectangle", "text"]);
  await page.getByLabel("Open project file").setInputFiles(saved.file);
  await expect(page.getByLabel("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Export Vega" }).click();
  await expect(page.getByRole("status")).toContainText("Valid Vega 6.2.0");
  const spec = JSON.parse(
    await page.getByLabel("Generated Vega JSON").inputValue(),
  );
  expect(JSON.stringify(spec)).toContain('"transparent"');
  expect(JSON.stringify(spec)).toContain('"lineBreak"');
  expect(errors).toEqual([]);
});

test("configure a vertical bar chart: sorting and formats", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("button", { name: "Sample data", exact: false }).click();
  await page
    .getByLabel("Sample data JSON")
    .fill(
      '[{"endpoint":"a","requests":1240},{"endpoint":"b","requests":860},{"endpoint":"c","requests":2100}]',
    );
  await page.getByRole("button", { name: "Apply data" }).click();

  await add(page, "Vertical bar chart");
  await expect(page.getByLabel("Orientation", { exact: true })).toHaveValue(
    "vertical",
  );
  await page.getByLabel("Category field", { exact: true }).selectOption("endpoint");
  await page.getByLabel("Numeric value field", { exact: true }).selectOption("requests");
  await expect(page.getByTestId("chart-setup")).toHaveCount(0);
  await page.getByLabel("Sort order", { exact: true }).selectOption("value-desc");
  await page.getByLabel("Value format", { exact: true }).selectOption("bytes");
  await expect(page.locator('[data-testid="vega-render"]')).toContainText("KB");
  await page.screenshot({
    path: testInfo.outputPath("vertical-bars.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Export Vega" }).click();
  await expect(page.getByRole("status")).toContainText("Valid Vega 6.2.0");
  const spec = JSON.parse(
    await page.getByLabel("Generated Vega JSON").inputValue(),
  );
  const ds = spec.data.find((d: { name: string }) => d.name !== "source");
  expect(ds.transform[1]).toEqual({
    type: "collect",
    sort: { field: "requests", order: "descending" },
  });
  expect(errors).toEqual([]);
});

test("multiselect align/distribute/undo and gesture cancel", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();

  for (const name of ["Box A", "Box B", "Box C"]) {
    await add(page, "Rectangle");
    await set(page, "Layer name", name);
  }
  await page.getByRole("button", { name: "Box A", exact: true }).click();
  await set(page, "Width", "100");
  await page.getByRole("button", { name: "Box B", exact: true }).click();
  await set(page, "X", "150");
  await set(page, "Width", "100");
  await page.getByRole("button", { name: "Box C", exact: true }).click();
  await set(page, "X", "400");
  await set(page, "Width", "100");
  await page.getByRole("button", { name: "Box A", exact: true }).click();
  await set(page, "X", "0");

  // Escape cancels an in-progress drag without touching the document.
  await page.getByRole("button", { name: "Box A", exact: true }).click();
  const overlay = page.locator(".element-overlay.selected");
  const bb = await overlay.boundingBox();
  await page.mouse.move(bb!.x + 20, bb!.y + 20);
  await page.mouse.down();
  await page.mouse.move(bb!.x + 60, bb!.y + 40, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.getByRole("button", { name: "Box A", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("0");
  await page.screenshot({
    path: testInfo.outputPath("arrange.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Box A", exact: true }).click();
  await page
    .getByRole("button", { name: "Box B", exact: true })
    .click({ modifiers: ["Shift"] });
  await page
    .getByRole("button", { name: "Box C", exact: true })
    .click({ modifiers: ["Shift"] });
  await arrangeScope(page)
    .getByRole("button", { name: "Distribute horizontally" })
    .click();
  await page.getByRole("button", { name: "Box B", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("200");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Box B", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("150");
  await expect(errors).toEqual([]);
});
