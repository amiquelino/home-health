import { test, expect } from '@playwright/test';
import { mockPatientsAPI } from '../helpers/api-mocks';

test.describe('Pacientes', () => {
  test.beforeEach(async ({ page }) => {
    // Initial load comes from SSR (mock Medplum returns empty bundle)
    // Client-side search calls are intercepted here
    await mockPatientsAPI(page);
    await page.goto('/patients');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
  });

  test('renders search input', async ({ page }) => {
    await expect(page.getByPlaceholder('Buscar por nome...')).toBeVisible();
  });

  test('renders new patient button', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Novo paciente' })).toBeVisible();
  });

  test('shows empty state when no patients', async ({ page }) => {
    await expect(page.getByText('Nenhum paciente cadastrado ainda.')).toBeVisible();
  });

  test('opens new patient modal on button click', async ({ page }) => {
    await page.getByRole('button', { name: '+ Novo paciente' }).click();
    await expect(page.getByRole('heading', { name: 'Novo paciente' })).toBeVisible();
  });

  test('patient modal can be closed', async ({ page }) => {
    await page.getByRole('button', { name: '+ Novo paciente' }).click();
    await expect(page.getByRole('heading', { name: 'Novo paciente' })).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByRole('heading', { name: 'Novo paciente' })).not.toBeVisible();
  });

  test('search input triggers API call with query', async ({ page }) => {
    const queries: string[] = [];
    await page.route('/api/patients**', (route) => {
      const url = new URL(route.request().url());
      queries.push(url.searchParams.get('q') ?? '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.getByPlaceholder('Buscar por nome...').fill('Maria');
    await page.waitForTimeout(500); // debounce is 350ms
    expect(queries.some((q) => q === 'Maria')).toBeTruthy();
  });
});
