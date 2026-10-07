import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.evaluate(async () => {
    const modelPath = "/src/model.ts",
      storePath = "/src/store.ts";
    const { newElement, sample } = await import(modelPath);
    const { useEditor } = await import(storePath);
    const types = ["text", "rectangle", "ellipse", "line", "bar", "group"];
    const elements = types.map((type) => ({ ...newElement(type), id: type }));
    useEditor.getState().open({ ...sample, elements });
    Object.assign(window, { inspectorStore: useEditor });
  });
}

test("every inspector fits both themes and all supported panel widths", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await setup(page);
  const panel = page.getByRole("complementary", { name: "Properties" });
  for (const theme of ["dark", "light"]) {
    for (const width of [240, 320, 520]) {
      for (const type of [
        null,
        "text",
        "rectangle",
        "ellipse",
        "line",
        "bar",
        "group",
      ]) {
        await page.evaluate(
          ({ theme, width, type }) => {
            const s = (window as any).inspectorStore.getState();
            s.setTheme(theme);
            s.setPropertiesWidth(width);
            s.select(type);
          },
          { theme, width, type },
        );
        await expect(panel.locator(".property-intro h2")).toHaveText(
          type === "bar"
            ? "Bar chart"
            : type
              ? type.charAt(0).toUpperCase() + type.slice(1)
              : "Canvas",
        );
        if (type === "bar")
          await panel.getByText("Advanced", { exact: true }).click();
        const overflow = await panel.evaluate((node) => {
          const scroll = node.querySelector(".inspector-scroll")!;
          const rect = node.getBoundingClientRect();
          const controls = [
            ...node.querySelectorAll("input,select,textarea,button"),
          ].filter((el) => el.getClientRects().length);
          return {
            scroll: scroll.scrollWidth - scroll.clientWidth,
            outside: controls
              .filter((el) => {
                const b = el.getBoundingClientRect();
                return b.left < rect.left - 1 || b.right > rect.right + 1;
              })
              .map((el) => el.getAttribute("aria-label")),
            page: document.documentElement.scrollWidth - innerWidth,
            grids: [...node.querySelectorAll("*")].filter((el) =>
              getComputedStyle(el).display.includes("grid")).length,
            sideBySide: [...node.querySelectorAll(".field-stack, .paint-controls")].some((stack) => {
              const fields = [...stack.children].filter((el) => el.getClientRects().length);
              return fields.some((el, i) => i > 0 &&
                el.getBoundingClientRect().top < fields[i - 1].getBoundingClientRect().bottom - 1);
            }),
          };
        });
        expect(overflow, `${type}, ${theme}, ${width}`).toEqual({
          scroll: 0,
          outside: [],
          page: 0,
          grids: 0,
          sideBySide: false,
        });
        if (type) {
          const footer = await panel
            .locator(".inspector-actions")
            .boundingBox();
          expect(footer!.y + footer!.height).toBeLessThanOrEqual(768);
          await panel.locator(".inspector-scroll").evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          expect(
            await panel.locator(".inspector-actions").boundingBox(),
          ).toEqual(footer);
        }
        if (width === 320) {
          await panel.locator(".inspector-scroll").evaluate((el) => {
            el.scrollTop = 0;
          });
          await panel.screenshot({
            path: testInfo.outputPath(
              `properties-${type ?? "canvas"}-${theme}.png`,
            ),
          });
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test("section keyboard controls and collapse all stay synchronized without changing the document", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() =>
    (window as any).inspectorStore.getState().select("rectangle"),
  );
  const panel = page.getByRole("complementary", { name: "Properties" });
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).inspectorStore.getState().project),
  );
  await panel.getByRole("button", { name: "Collapse all sections" }).click();
  await expect(panel.locator("details[open]")).toHaveCount(0);
  await panel
    .locator("summary")
    .filter({ hasText: /^Layout$/ })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    panel.getByRole("button", { name: "Collapse all sections" }),
  ).toBeVisible();
  await expect(panel.getByLabel("Width", { exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    panel.getByRole("button", { name: "Expand all sections" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Expand all sections" }).click();
  expect(await panel.locator("details[open]").count()).toBe(
    await panel.locator("details").count(),
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as any).inspectorStore.getState().project),
    ),
  ).toBe(before);
  await panel.getByLabel("Width", { exact: true }).fill("280");
  await panel.getByLabel("Width", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as any).inspectorStore.getState().project),
    ),
  ).toBe(before);
});

test("expanded bindings and visibility remain usable in the narrow inspector", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.evaluate(() => {
    const s = (window as any).inspectorStore.getState();
    s.setPropertiesWidth(240);
    s.select("rectangle");
  });
  const panel = page.getByRole("complementary", { name: "Properties" });
  await panel.getByLabel("Fill mode", { exact: true }).selectOption("rules");
  await panel
    .getByRole("button", { name: "Add condition", exact: true })
    .click();
  await panel
    .getByLabel("Fill rule 1 operator", { exact: true })
    .selectOption("between");
  await panel.getByLabel("Fill rule 1 upper bound", { exact: true }).fill("75");
  await panel
    .getByLabel("Fill rule 1 upper bound", { exact: true })
    .press("Tab");
  await panel.getByLabel("Map opacity from data", { exact: true }).check();
  await panel.getByLabel("Visibility", { exact: true }).selectOption("rule");
  await panel
    .getByLabel("Visibility operator", { exact: true })
    .selectOption("between");
  await panel.getByLabel("Visibility upper bound", { exact: true }).fill("90");
  await panel
    .getByLabel("Visibility upper bound", { exact: true })
    .press("Tab");
  expect(
    await panel
      .locator(".inspector-scroll")
      .evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBe(0);
  await panel.screenshot({
    path: testInfo.outputPath("properties-visibility-narrow.png"),
  });
  await panel.getByLabel("Fill mode", { exact: true }).scrollIntoViewIfNeeded();
  await panel.screenshot({
    path: testInfo.outputPath("properties-bindings-narrow.png"),
  });
  await page
    .getByRole("button", { name: "Lock Rectangle", exact: true })
    .click();
  await expect(panel.getByLabel("Fill mode", { exact: true })).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Duplicate", exact: true }),
  ).toBeDisabled();
});
