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
  webServer: { command: `node scripts/serve.mjs ${PORT}`, port: PORT, reuseExistingServer: false },
});
