import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch } from '@/lib/medplum-client';
import { fromFHIRAppointment } from '@hh/fhir';
import type { Appointment } from '@medplum/fhirtypes';

export const GET = withAuth(async (req: NextRequest, session) => {
  const { searchParams } = req.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  // Month-specific appointments (for revenue stats)
  const monthRaw = await fhirSearch<Appointment>(
    'Appointment',
    { date: [`ge${from}`, `le${to}`], _count: '500' },
    session.user.projectId,
  );
  const monthAppts = monthRaw.map(fromFHIRAppointment).filter(a => a.status !== 'cancelled');

  const revenue = monthAppts
    .filter(a => a.paymentStatus === 'paid' && a.price)
    .reduce((sum, a) => sum + (a.price ?? 0), 0);

  const pricedCount = monthAppts.filter(a => a.price).length;
  const averageTicket = pricedCount > 0
    ? monthAppts.filter(a => a.price).reduce((sum, a) => sum + (a.price ?? 0), 0) / pricedCount
    : 0;

  // All-time pending charges (regardless of month)
  const allRaw = await fhirSearch<Appointment>(
    'Appointment',
    { _count: '1000' },
    session.user.projectId,
  );
  const allAppts = allRaw.map(fromFHIRAppointment).filter(a => a.status !== 'cancelled');

  const pendingCharges = allAppts
    .filter(a => a.price && a.paymentStatus === 'pending')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(a => ({
      id: a.id,
      patientId: a.patientId,
      patientName: a.patientName,
      start: a.start,
      price: a.price,
      paymentStatus: 'pending' as const,
      appointmentStatus: a.status,
    }));

  const pending = pendingCharges.reduce((sum, a) => sum + (a.price ?? 0), 0);

  return NextResponse.json({
    revenue,
    pending,
    appointmentsCount: monthAppts.length,
    averageTicket,
    charges: monthAppts
      .filter(a => a.price)
      .sort((a, b) => b.start.localeCompare(a.start))
      .map(a => ({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patientName,
        start: a.start,
        price: a.price,
        paymentStatus: a.paymentStatus ?? 'pending',
        appointmentStatus: a.status,
      })),
    pendingCharges,
  });
});
