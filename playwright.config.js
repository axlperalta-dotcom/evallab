import { defineConfig } from "@playwright/test";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
mkdirSync(".data", { recursive: true });
const dataDir = mkdtempSync(path.resolve(".data", "test-browser-"));
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3013",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      process.platform === "win32"
        ? "py -3 server.py --port 3013"
        : "python server.py --port 3013",
    url: "http://127.0.0.1:3013",
    reuseExistingServer: false,
    env: { EVALLAB_DATA_DIR: dataDir },
  },
});
