import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch } from '@/lib/medplum-client';
import { fromFHIRAppointment } from '@hh/fhir';
import type { Appointment } from '@medplum/fhirtypes';

export const GET = withAuth(async (req: NextRequest, session) => {
  const { searchParams } = req.nextUrl;
  const months = Math.min(12, Math.max(3, parseInt(searchParams.get('months') ?? '6')));

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const lastDay = new Date(endYear, endMonth, 0).getDate();

  const from = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${endYear}-${String(endMonth).padStart(2, '0')}-${lastDay}`;

  const raw = await fhirSearch<Appointment>(
    'Appointment',
    {
      date: [`ge${from}`, `le${to}`],
      actor: `Practitioner/${session.user.practitionerId}`,
      _count: '500',
    },
    session.user.projectId,
  );

  const appts = raw.map(fromFHIRAppointment).filter(a => a.status !== 'cancelled');

  // Build ordered month keys
  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const byMonth: Record<string, { revenue: number; pending: number }> = {};
  for (const key of monthKeys) byMonth[key] = { revenue: 0, pending: 0 };

  for (const appt of appts) {
    const key = appt.start.slice(0, 7);
    if (!byMonth[key] || !appt.price) continue;
    if (appt.paymentStatus === 'paid') byMonth[key].revenue += appt.price;
    else if (appt.paymentStatus === 'pending') byMonth[key].pending += appt.price;
  }

  const result = monthKeys.map(key => {
    const [y, m] = key.split('-').map(Number);
    const label = new Date(y, m - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'short' })
      .replace('.', '');
    return { label, ...byMonth[key] };
  });

  return NextResponse.json({ months: result });
});
