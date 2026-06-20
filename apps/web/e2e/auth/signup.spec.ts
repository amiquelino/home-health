import { test, expect } from '@playwright/test';

test.describe('Signup', () => {
  test('renders signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    await expect(page.locator('[autocomplete="name"]')).toBeVisible();
    await expect(page.locator('[autocomplete="email"]')).toBeVisible();
    await expect(page.locator('[autocomplete="new-password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar conta grátis' })).toBeVisible();
    await expect(page.getByText('14 dias grátis, sem cartão')).toBeVisible();
  });

  test('shows error when email is already in use', async ({ page }) => {
    await page.route('/api/users', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'E-mail já cadastrado' }),
      }),
    );

    await page.goto('/signup');
    await page.locator('[autocomplete="name"]').fill('Test User');
    await page.locator('[autocomplete="email"]').fill('existing@example.com');
    await page.locator('[autocomplete="new-password"]').fill('password123');
    await page.getByRole('button', { name: 'Criar conta grátis' }).click();
    await expect(page.getByText('E-mail já cadastrado')).toBeVisible();
  });

  test('link to login navigates correctly', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
