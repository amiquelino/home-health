import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'auth-pages',
      testDir: './e2e/auth',
    },
    {
      name: 'app-pages',
      testDir: './e2e/app',
      use: { storageState: 'e2e/.auth/user.json' },
    },
  ],
  webServer: {
    // next.config.ts uses output:'standalone', so 'next start' is a no-op.
    // Use the standalone server directly. Static assets must be copied alongside
    // before this runs (done in CI by the "Prepare standalone server" step).
    command: 'node .next/standalone/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // AUTH_SECRET: inherited from process.env (set in CI step env, or read from
      // .env.local by the existing dev server when reuseExistingServer=true locally)
      AUTH_TRUST_HOST: 'true',
      NEXTAUTH_URL: 'http://localhost:3000',
      MEDPLUM_BASE_URL: process.env.MEDPLUM_BASE_URL ?? 'http://localhost:8103/',
      MEDPLUM_CLIENT_ID: process.env.MEDPLUM_CLIENT_ID ?? 'test',
      MEDPLUM_CLIENT_SECRET: process.env.MEDPLUM_CLIENT_SECRET ?? 'test',
      MEDPLUM_PROJECT_ID: process.env.MEDPLUM_PROJECT_ID ?? 'test',
    },
  },
});
