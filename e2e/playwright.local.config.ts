import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// The same scenario in the Chrome installed on this computer (a real GPU renders the map: minutes become
// about one), instead of the Chromium in the Docker image (software GL). The stack still runs in WSL;
// Windows reaches it as http://localhost:8000. Run it with `bash`-free Windows Node:
//   node e2e/node_modules/@playwright/test/cli.js test -c e2e/playwright.local.config.ts --project=desktop
// (the Playwright package in e2e/node_modules is plain JavaScript, so Windows Node can use what the container installed.)
export default defineConfig({
  ...base,
  use: { ...base.use, channel: 'chrome', launchOptions: {} },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
});
