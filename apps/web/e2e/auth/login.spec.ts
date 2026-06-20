import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Home Health' })).toBeVisible();
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Criar conta grátis' })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[name="email"]').fill('bad@example.com');
    await page.locator('[name="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();
    // Server action → verifyUser (mock Medplum) → redirect; can be slow on WSL2
    await page.waitForURL('**/login?error=*', { timeout: 20_000 });
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  });

  test('shows success banner when coming from signup', async ({ page }) => {
    await page.goto('/login?registered=1');
    await expect(page.getByText('Conta criada!')).toBeVisible();
  });

  test('link to signup navigates correctly', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Criar conta grátis' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
