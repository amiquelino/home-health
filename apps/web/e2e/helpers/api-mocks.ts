import type { Page } from '@playwright/test';

export async function mockDashboardAPI(page: Page) {
  await page.route('/api/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        today: { total: 3, completed: 1, remaining: 2 },
        pending: 450.0,
        patientCount: 12,
        todayAppointments: [],
        nextAppointment: null,
      }),
    }),
  );
}

export async function mockRevenueChartAPI(page: Page) {
  await page.route('/api/dashboard/revenue-chart**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

export async function mockAppointmentsAPI(page: Page) {
  await page.route('/api/appointments**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

export async function mockPatientsAPI(page: Page) {
  await page.route('/api/patients**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}

export async function mockTeamAPI(page: Page) {
  await page.route('/api/team', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  );
}
