import { test, expect } from '@playwright/test';
import { mockAppointmentsAPI, mockTeamAPI } from '../helpers/api-mocks';

test.describe('Agenda (Schedule)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAppointmentsAPI(page);
    await mockTeamAPI(page);
    await page.goto('/schedule');
    // Wait for React hydration so calendar cell onClick handlers are attached
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  });

  test('renders week navigation buttons', async ({ page }) => {
    const nav = page.locator('button', { hasText: '‹' });
    await expect(nav).toBeVisible();
    await expect(page.locator('button', { hasText: '›' })).toBeVisible();
  });

  test('renders calendar day headers', async ({ page }) => {
    // Day labels from DAYS constant: Dom, Seg, Ter, Qua, Qui, Sex, Sáb
    await expect(page.getByText('Dom').first()).toBeVisible();
    await expect(page.getByText('Seg').first()).toBeVisible();
    await expect(page.getByText('Sex').first()).toBeVisible();
  });

  test('renders hour time slots', async ({ page }) => {
    // Hours 7–20 rendered as "7:00", "8:00", etc. Use exact to avoid matching "17:00", "18:00"
    await expect(page.getByText('7:00', { exact: true })).toBeVisible();
    await expect(page.getByText('8:00', { exact: true })).toBeVisible();
  });

  test('clicking a time slot opens appointment modal', async ({ page }) => {
    // Click the first clickable calendar cell (not the time label column)
    await page.locator('[class*="cursor-pointer"]').first().click();
    await expect(page.getByRole('heading', { name: 'Nova consulta' })).toBeVisible();
  });

  test('appointment modal can be closed', async ({ page }) => {
    await page.locator('[class*="cursor-pointer"]').first().click();
    await expect(page.getByRole('heading', { name: 'Nova consulta' })).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByRole('heading', { name: 'Nova consulta' })).not.toBeVisible();
  });
});
