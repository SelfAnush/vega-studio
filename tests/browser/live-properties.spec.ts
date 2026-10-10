import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open example", exact: false })
    .click();
  await page.evaluate(async () => {
    const path = "/src/store.ts";
    const { useEditor } = await import(path);
    Object.assign(window, { liveProbe: useEditor });
  });
}
async function current(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).liveProbe.getState();
    return s.project.elements.find((e: any) => e.id === s.selected);
  });
}
async function fill(page: Page, label: string, value: string) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(value);
  await expect(input).toBeFocused();
}
async function add(page: Page, name: string) {
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("text and geometry render while editing and preserve focus and undo", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Panel title", exact: true }).click();
  await fill(page, "Layer name", "Live heading");
  await expect(
    page.getByRole("button", { name: "Live heading", exact: true }),
  ).toBeVisible();
  await fill(page, "Content", "Live preview\nSecond line");
  await expect(page.getByTestId("vega-render")).toContainText("Live preview");
  await expect(page.getByTestId("vega-render")).toContainText("Second line");
  await fill(page, "Font size", "32");
  await expect(
    page.getByTestId("vega-render").getByText("Live preview", { exact: true }),
  ).toHaveCSS("font-size", "32px");
  const before = await current(page);
  await fill(page, "X", "120");
  await fill(page, "X", "150");
  await expect.poll(async () => (await current(page)).x).toBe(150);
  await expect(page.getByTestId(`overlay-${before.id}`)).toHaveCSS(
    "left",
    "150px",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue(
    String(before.x),
  );
  await fill(page, "Width", "");
  await page.getByLabel("Width", { exact: true }).pressSequentially("320");
  await expect(page.getByLabel("Width", { exact: true })).toBeFocused();
  await expect(page.getByTestId(`overlay-${before.id}`)).toHaveCSS(
    "width",
    "320px",
  );
  await add(page, "Text");
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
    "Your text here",
  );
});

test("chart titles, thresholds and padding apply before blur", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Queue usage", exact: true }).click();
  await page.getByLabel("Show value axis", { exact: true }).check();
  await fill(page, "Value axis title", "Live axis");
  await expect(page.getByTestId("vega-render")).toContainText("Live axis");
  await fill(page, "Warning at", "45");
  await expect.poll(async () => (await current(page)).warning).toBe(45);
  await page.getByText("Advanced", { exact: true }).click();
  await fill(page, "Padding top", "35");
  await expect.poll(async () => (await current(page)).padding.top).toBe(35);
});

test("data rules and mapped values update without leaving their fields", async ({
  page,
}) => {
  await setup(page);
  await add(page, "Rectangle");
  await page.getByLabel("Fill mode", { exact: true }).selectOption("rules");
  await page
    .getByRole("button", { name: "Add condition", exact: true })
    .click();
  await fill(page, "Fill rule 1 value", "12");
  await expect
    .poll(async () => (await current(page)).fillRules.rules[0].value)
    .toBe(12);
  await page
    .getByLabel("Fill record selection", { exact: true })
    .selectOption("match");
  await fill(page, "Fill match field", "queue_name");
  await expect
    .poll(async () => (await current(page)).fillRules.pick.matchField)
    .toBe("queue_name");
  await fill(page, "Fill match value", "live queue");
  await expect
    .poll(async () => (await current(page)).fillRules.pick.matchValue)
    .toBe("live queue");
  await page.getByLabel("Map opacity from data", { exact: true }).check();
  await fill(page, "Opacity Data max", "200");
  await expect
    .poll(async () => (await current(page)).opacityMap.dataMax)
    .toBe(200);
  await fill(page, "Opacity Output max", "0.6");
  await expect
    .poll(async () => (await current(page)).opacityMap.outMax)
    .toBe(0.6);
  await page.getByLabel("Visibility", { exact: true }).selectOption("rule");
  await fill(page, "Visibility value", "22");
  await expect
    .poll(async () => (await current(page)).visibility.value)
    .toBe(22);
});

test("canvas dimensions, grid and background preview immediately", async ({
  page,
}) => {
  await setup(page);
  await fill(page, "Canvas width", "1200");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).liveProbe.getState().project.canvas.width,
      ),
    )
    .toBe(1200);
  await expect(page.getByTestId("vega-render").locator("svg")).toHaveAttribute(
    "width",
    "1200",
  );
  await fill(page, "Grid spacing", "24");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).liveProbe.getState().gridSpacing),
    )
    .toBe(24);
  await page.getByRole("button", { name: "Background", exact: true }).click();
  await fill(page, "Hex color", "#123456");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).liveProbe.getState().project.canvas.background,
      ),
    )
    .toBe("#123456");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).liveProbe.getState().project.canvas.background,
      ),
    )
    .not.toBe("#123456");
});

test("numeric-looking text retains exact values through undo", async ({
  page,
}) => {
  await setup(page);
  await add(page, "Text");
  await fill(page, "Content", "01");
  await page.getByLabel("Content", { exact: true }).press("Tab");
  await fill(page, "Content", "1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue("01");
  await expect(page.getByTestId("vega-render")).toContainText("01");
});
