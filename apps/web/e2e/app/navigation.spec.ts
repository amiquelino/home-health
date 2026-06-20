import { test, expect } from '@playwright/test';
import { mockDashboardAPI, mockRevenueChartAPI } from '../helpers/api-mocks';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockDashboardAPI(page);
    await mockRevenueChartAPI(page);
  });

  test('sidebar shows all nav links', async ({ page }) => {
    await page.goto('/home');
    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByRole('link', { name: /Dashboard/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Agenda/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Pacientes/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Evoluções/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Avaliações/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Equipe/ })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Configurações/ })).toBeVisible();
  });

  test('shows brand name in sidebar', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('aside').first().getByText('Home Health')).toBeVisible();
  });

  test('shows logged-in user name in top bar', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('shows active plan badge in sidebar', async ({ page }) => {
    await page.goto('/home');
    // Test user has subscriptionPlan=clinic and status=active
    await expect(page.locator('aside').first().getByText('clinic')).toBeVisible();
  });

  test('navigates to schedule on Agenda link click', async ({ page }) => {
    await page.goto('/home');
    await page.locator('aside').first().getByRole('link', { name: /Agenda/ }).click();
    await expect(page).toHaveURL('/schedule');
  });
});
