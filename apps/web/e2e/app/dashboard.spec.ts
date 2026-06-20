import { test, expect } from '@playwright/test';
import { mockDashboardAPI, mockRevenueChartAPI } from '../helpers/api-mocks';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockDashboardAPI(page);
    await mockRevenueChartAPI(page);
    await page.goto('/home');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('renders all three stat cards', async ({ page }) => {
    await expect(page.getByText('Consultas hoje')).toBeVisible();
    await expect(page.getByText('A receber')).toBeVisible();
    await expect(page.getByText('Pacientes', { exact: true })).toBeVisible();
  });

  test('displays data from mocked API', async ({ page }) => {
    await expect(page.getByText('R$ 450,00')).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toBeVisible();
  });

  test('renders today consultations section', async ({ page }) => {
    await expect(page.getByText('Consultas de hoje')).toBeVisible();
    await expect(page.getByText('Nenhuma consulta hoje.')).toBeVisible();
  });

  test('renders quick action buttons', async ({ page }) => {
    await expect(page.getByRole('link', { name: '+ Nova consulta' })).toBeVisible();
    await expect(page.getByRole('link', { name: '+ Novo paciente' })).toBeVisible();
  });

  test('Nova consulta button links to schedule', async ({ page }) => {
    const href = await page.getByRole('link', { name: '+ Nova consulta' }).getAttribute('href');
    expect(href).toBe('/schedule');
  });
});
