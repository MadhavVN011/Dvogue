import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome = process.env.CHROMIUM_EXECUTABLE_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:3173', launchOptions: chrome ? { executablePath: chrome } : {}, trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: { command: 'node tests/browser-server.js', url: 'http://127.0.0.1:3173', reuseExistingServer: false, timeout: 120000, env: { NEXT_TELEMETRY_DISABLED: '1' } },
});
