import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/model.ts", "src/compiler.ts", "src/store.ts", "src/commands.ts", "src/hierarchy.ts", "src/color.ts", "src/registry.ts", "src/examples.ts", "src/clipboard.ts"],
      exclude: [],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
