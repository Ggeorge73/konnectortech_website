import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: process.env.PW_OUTPUT || 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  // Chromium runs everything. In CI (PW_ALL_BROWSERS=1) Firefox and WebKit, the engine behind Safari, also run the
  // cross-browser spec. They are not installed in every development environment, so they are opt-in.
  projects: [
    { name: 'chromium' },
    ...(process.env.PW_ALL_BROWSERS
      ? [
          // Headless Firefox turns 3D off when it finds no graphics chip. These settings ask it to use software drawing instead,
          // so the story itself is exercised in Firefox. If it still has no 3D, the test checks the fall back to brief mode.
          { name: 'firefox', use: { browserName: 'firefox' as const, launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false, 'gfx.webrender.software': true } } }, testMatch: /cross-browser\.spec\.ts/ },
          { name: 'webkit', use: { browserName: 'webkit' as const, launchOptions: {} }, testMatch: /cross-browser\.spec\.ts/ },
        ]
      : []),
  ],
  webServer: { command: `node scripts/serve.mjs ${PORT}`, port: PORT, reuseExistingServer: false },
});
