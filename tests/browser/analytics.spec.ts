import { test, expect } from "@playwright/test";

test("analytics respects build settings and stays mounted across screens", async ({ page }, testInfo) => {
  const scripts: string[] = [];
  // Stub the network boundary: this test must never submit real analytics.
  await page.route(/\/_vercel\/insights\/|https:\/\/va\.vercel-scripts\.com\//, async (route) => {
    scripts.push(route.request().url());
    await route.fulfill({ contentType: "application/javascript", body: "" });
  });
  await page.goto("/");
  const selector = 'script[src*="/_vercel/insights/"], script[src*="va.vercel-scripts.com"]';
  const enabled = testInfo.config.metadata.analyticsEnabled === true;
  await expect(page.getByRole("button", { name: "Create project" })).toBeVisible();
  await expect(page.locator(selector)).toHaveCount(enabled ? 1 : 0);
  if (enabled) await expect.poll(() => scripts.length).toBe(1);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("button", { name: "Add element" })).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create project" })).toBeVisible();
  await expect(page.locator(selector)).toHaveCount(enabled ? 1 : 0);
  expect(scripts).toHaveLength(enabled ? 1 : 0);
});
