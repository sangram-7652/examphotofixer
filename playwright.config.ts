import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4310);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E runs against a production build (`npm run build` first).
 * Runs on Chromium, Firefox and WebKit, plus a phone viewport.
 * WebKit on Linux needs system libraries: `sudo npx playwright install-deps webkit`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // Mobile-first checks on a phone viewport with touch. Engine tests are
    // browser-API tests and already run on the three desktop engines.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testIgnore: /image-engine/ },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    // Never reuse: a different app on the same port would silently be tested instead.
    reuseExistingServer: false,
    timeout: 60_000,
    // Enables the /dev/image-engine harness page (404 otherwise).
    env: { ENGINE_HARNESS: "1" },
  },
});
