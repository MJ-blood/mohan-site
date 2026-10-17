import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '.tmp/browser-results',
  reporter: [['list'], ['html', { outputFolder: '.tmp/browser-report', open: 'never' }]],
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4322', channel: process.env.BROWSER_CHANNEL ?? 'msedge', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4322',
    url: 'http://127.0.0.1:4322', reuseExistingServer: false,
    env: { ASTRO_TELEMETRY_DISABLED: '1' },
  },
});
