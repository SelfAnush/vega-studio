import { test, expect } from "@playwright/test";

test("element library supports search, no results, keyboard insertion, and fresh reopening", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  const search = page.getByRole("textbox", { name: "Search elements" });
  await search.fill("does not exist");
  await expect(page.getByRole("status")).toContainText("No elements found");
  await search.fill("ellipse");
  await expect(page.getByRole("menuitem")).toHaveCount(1);
  await search.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Ellipse", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add element" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("menuitem")).toHaveCount(6);
  await search.fill("chart");
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await search.press("Escape");
  await expect(page.getByRole("button", { name: "Add element" })).toBeFocused();
});

test("source navigation retains inline, query, and fixture drafts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: /Sample data/ }).click();
  await page.getByLabel("Sample data JSON").fill('[{"value":42}]');
  await page.getByRole("button", { name: "Add Elasticsearch dataset" }).click();
  await page.getByLabel("Index pattern", { exact: true }).fill("draft-*");
  await page.getByLabel("Query DSL body", { exact: true }).fill('{"size":1}');
  await page.getByLabel("Response fixture JSON").fill('{"hits":{"hits":[]}}');
  await page
    .locator(".source-item")
    .filter({ hasText: /^source/ })
    .click();
  await expect(page.getByLabel("Sample data JSON")).toHaveValue(
    '[{"value":42}]',
  );
  await page.locator(".source-item").filter({ hasText: /^es/ }).click();
  await expect(page.getByLabel("Index pattern", { exact: true })).toHaveValue(
    "draft-*",
  );
  await expect(page.getByLabel("Query DSL body", { exact: true })).toHaveValue(
    '{"size":1}',
  );
  await expect(page.getByLabel("Response fixture JSON")).toHaveValue(
    '{"hits":{"hits":[]}}',
  );
});

test("export tabs support keyboard navigation and clipboard errors preserve downloads", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open example", exact: false })
    .click();
  await page.getByRole("button", { name: "Export Vega" }).click();
  const inline = page.getByRole("tab", { name: "Inline sample data" });
  await inline.focus();
  await inline.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Elasticsearch Query DSL" }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Elasticsearch export is blocked",
  );
  await page.keyboard.press("Home");
  await expect(inline).toBeFocused();
  await expect(page.getByRole("button", { name: "Copy JSON" })).toBeEnabled();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("Clipboard unavailable");
  await expect(
    page.getByRole("button", { name: "Download JSON" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  expect((await download).suggestedFilename()).toBe("vega-studio.vega.json");
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`application surfaces fit ${viewport.width} in both themes`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    for (const theme of ["dark", "light"]) {
      await page.goto("/");
      await page.evaluate(
        (theme) => localStorage.setItem("vega-studio-theme", theme),
        theme,
      );
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Create project" }),
      ).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`welcome-${theme}.png`),
      });
      await page.getByRole("button", { name: "Create project" }).click();
      await page.screenshot({
        path: testInfo.outputPath(`empty-editor-${theme}.png`),
      });
      await page.getByRole("button", { name: "Add element" }).click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`library-${theme}.png`),
      });
      await page.getByRole("menuitem", { name: "Text", exact: true }).click();
      await page
        .getByLabel("Layer name", { exact: true })
        .fill(
          "A long layer name that should truncate cleanly in the navigation",
        );
      await page.getByLabel("Layer name", { exact: true }).press("Tab");
      await page.screenshot({
        path: testInfo.outputPath(`editor-${theme}.png`),
      });
      await page.getByRole("button", { name: /Sample data/ }).click();
      await page.screenshot({ path: testInfo.outputPath(`data-${theme}.png`) });
      await page
        .getByRole("button", { name: "Add Elasticsearch dataset" })
        .click();
      await page.getByLabel("Index pattern", { exact: true }).fill("logs-*");
      await page
        .getByRole("button", { name: "Apply source" })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Close dialog" }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Apply source" }),
      ).toBeInViewport();
      const dialog = page.getByRole("dialog");
      expect(
        await dialog.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: testInfo.outputPath(`elasticsearch-${theme}.png`),
      });
      await page.getByRole("button", { name: "Close dialog" }).click();
      await page.getByRole("button", { name: "Export Vega" }).click();
      await expect(
        page.getByRole("button", { name: "Download JSON" }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "Download JSON" })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Close dialog" }),
      ).toBeInViewport();
      await page.screenshot({
        path: testInfo.outputPath(`export-${theme}.png`),
      });
      await page.getByRole("button", { name: "Close dialog" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
      page.once("dialog", (dialog) => dialog.accept());
    }
    expect(errors).toEqual([]);
  });
}
