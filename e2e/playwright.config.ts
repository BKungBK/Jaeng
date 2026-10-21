import { defineConfig, devices } from '@playwright/test';

// The demo scenario (spec 1.1) on the running dev stack. Run it with `bash scripts/e2e.sh`: it resets
// the demo data and runs this inside the Playwright image (the version of the image and of
// @playwright/test must match, see scripts/e2e.sh).
const baseURL = process.env.BASE_URL ?? 'http://localhost:8000';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL,
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
});
