import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    deps: {
      interopDefault: true
    }
  },
  resolve: {
    alias: {
      // Mock ebur128-wasm in tests - it requires WASM which is tricky in Node
      "ebur128-wasm": resolve(__dirname, "tests/mocks/ebur128-wasm.ts")
    }
  }
});
