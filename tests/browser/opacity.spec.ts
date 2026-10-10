import { test, expect } from "@playwright/test";

for (const name of ["Text", "Rectangle", "Ellipse", "Line"]) {
  test(`${name} opacity renders immediately and one undo restores the edit`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.getByRole("button", { name: "Add element" }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
    const opacity = page.getByLabel("Opacity", { exact: true });
    const rendered = (value: string) => page.locator(
      `[data-testid="vega-render"] [opacity="${value}"], [data-testid="vega-render"] [stroke-opacity="${value}"]`,
    );
    await opacity.fill("0.4");
    await expect(opacity).toBeFocused();
    await expect(rendered("0.4").first()).toBeAttached();
    await opacity.press("ArrowDown");
    await expect(opacity).toHaveValue("0.35");
    await expect(opacity).toBeFocused();
    await expect(rendered("0.35").first()).toBeAttached();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(opacity).toHaveValue("1");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(opacity).toHaveValue("0.35");
    await expect(rendered("0.35").first()).toBeAttached();
  });
}

test("opacity keeps incomplete input editable and never applies invalid values", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "Add element" }).click();
  await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
  const opacity = page.getByLabel("Opacity", { exact: true });
  await opacity.fill("0.6");
  await opacity.fill("");
  await expect(opacity).toHaveValue("");
  await expect(page.locator('[data-testid="vega-render"] [opacity="0.6"]')).toBeAttached();
  await opacity.pressSequentially("0.25");
  await expect(opacity).toBeFocused();
  await expect(page.locator('[data-testid="vega-render"] [opacity="0.25"]')).toBeAttached();
  await opacity.fill("2");
  await expect(opacity).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-testid="vega-render"] [opacity="0.25"]')).toBeAttached();
  await opacity.press("Tab");
  await expect(opacity).toHaveValue("0.25");
  await opacity.fill("0");
  await expect(page.locator('[data-testid="vega-render"] [opacity="0"]')).toBeAttached();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(opacity).toHaveValue("0.25");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(opacity).toHaveValue("1");
});
