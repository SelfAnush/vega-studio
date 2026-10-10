import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise the real built assets using workflows that do not import dev modules.
export default defineConfig(base, {
  testMatch: ["editor.spec.ts", "analytics.spec.ts"],
  metadata: { analyticsEnabled: process.env.VITE_WEB_ANALYTICS !== "false" },
  outputDir: "test-results/production",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
