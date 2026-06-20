import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolve AUTH_SECRET once: shell env → .env.local → hardcoded fallback.
// Written back to process.env so global-setup (same process) reads the same value.
function resolveAuthSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    const content = readFileSync(join(__dirname, '.env.local'), 'utf-8');
    const m = content.match(/^AUTH_SECRET=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  return 'test-e2e-auth-secret-minimum-32ch';
}

const AUTH_SECRET = resolveAuthSecret();
process.env.AUTH_SECRET = AUTH_SECRET;

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
    // In a monorepo the standalone entry point mirrors the workspace path.
    // Static assets must be copied alongside before this runs (CI step).
    command: 'node .next/standalone/apps/web/server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_SECRET,
      AUTH_TRUST_HOST: 'true',
      NEXTAUTH_URL: 'http://localhost:3000',
      MEDPLUM_BASE_URL: process.env.MEDPLUM_BASE_URL ?? 'http://localhost:8103/',
      MEDPLUM_CLIENT_ID: process.env.MEDPLUM_CLIENT_ID ?? 'test',
      MEDPLUM_CLIENT_SECRET: process.env.MEDPLUM_CLIENT_SECRET ?? 'test',
      MEDPLUM_PROJECT_ID: process.env.MEDPLUM_PROJECT_ID ?? 'test',
    },
  },
});
