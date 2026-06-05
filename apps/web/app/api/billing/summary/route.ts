import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch } from '@/lib/medplum-client';
import { fromFHIRAppointment, HH_EXT } from '@hh/fhir';
import { hasFeature, getAccessStatus } from '@hh/billing';
import type { Appointment, Practitioner } from '@medplum/fhirtypes';
import type { HHAppointment } from '@hh/core';

async function getTeamIds(ownerPractitionerId: string, projectId: string): Promise<{ id: string; name: string }[]> {
  const all = await fhirSearch<Practitioner>('Practitioner', { _count: '100' }, projectId);
  const owner = all.find(p => p.id === ownerPractitionerId);
  const members = all.filter(p =>
    p.active !== false &&
    p.extension?.some(e => e.url === HH_EXT.OWNER_ID && e.valueString === ownerPractitionerId)
  );
  const toMember = (p: Practitioner) => ({ id: p.id!, name: p.name?.[0]?.text ?? p.id! });
  return [
    ...(owner ? [toMember(owner)] : [{ id: ownerPractitionerId, name: '' }]),
    ...members.map(toMember),
  ];
}

function buildStats(appts: HHAppointment[], practitionerId?: string) {
  const nonCancelled = appts.filter(a => a.status !== 'cancelled' && (!practitionerId || a.practitionerId === practitionerId));
  const priced = nonCancelled.filter(a => a.price);
  const revenue = priced.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price ?? 0), 0);
  const averageTicket = priced.length > 0 ? priced.reduce((s, a) => s + (a.price ?? 0), 0) / priced.length : 0;
  return { revenue, appointmentsCount: nonCancelled.length, averageTicket };
}

export const GET = withAuth(async (req: NextRequest, session) => {
  const access = getAccessStatus({
    subscriptionStatus: session.user.subscriptionStatus ?? 'trial',
    createdAt: new Date(session.user.createdAt || Date.now()),
  });
  if (!hasFeature('financeiro', session.user.subscriptionPlan, access)) {
    return NextResponse.json({ error: 'Recurso disponível a partir do plano Pro' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const now = new Date();
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));
  const practitionersParam = searchParams.get('practitioners');

  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  // Determine which practitioner IDs to fetch
  let practitionerIds: { id: string; name: string }[];
  if (practitionersParam && session.user.role === 'owner') {
    if (practitionersParam === 'all') {
      practitionerIds = await getTeamIds(session.user.practitionerId, session.user.projectId);
    } else {
      practitionerIds = practitionersParam.split(',').map(id => ({ id, name: '' }));
    }
  } else {
    practitionerIds = [{ id: session.user.practitionerId, name: session.user.name ?? '' }];
  }

  // Fetch month appointments for all practitioners in parallel
  const [monthResults, allResults] = await Promise.all([
    Promise.all(practitionerIds.map(({ id }) =>
      fhirSearch<Appointment>(
        'Appointment',
        { date: [`ge${from}`, `le${to}`], _count: '500', actor: `Practitioner/${id}` },
        session.user.projectId,
      )
    )),
    Promise.all(practitionerIds.map(({ id }) =>
      fhirSearch<Appointment>(
        'Appointment',
        { _count: '1000', actor: `Practitioner/${id}` },
        session.user.projectId,
      )
    )),
  ]);

  const monthAppts = monthResults.flat().map(fromFHIRAppointment);
  const allAppts   = allResults.flat().map(fromFHIRAppointment);

  const nonCancelled = monthAppts.filter(a => a.status !== 'cancelled');
  const priced       = nonCancelled.filter(a => a.price);

  const revenue      = priced.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price ?? 0), 0);
  const averageTicket = priced.length > 0 ? priced.reduce((s, a) => s + (a.price ?? 0), 0) / priced.length : 0;

  // All-time pending
  const allNonCancelled = allAppts.filter(a => a.status !== 'cancelled');
  const pendingCharges = allNonCancelled
    .filter(a => a.price && a.paymentStatus === 'pending')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(a => ({ id: a.id, patientId: a.patientId, patientName: a.patientName, practitionerName: a.practitionerName, start: a.start, price: a.price!, paymentStatus: 'pending' as const, appointmentStatus: a.status }));

  const pending = pendingCharges.reduce((s, a) => s + a.price, 0);

  // Breakdown by practitioner (only when multiple)
  const byPractitioner = practitionerIds.length > 1
    ? practitionerIds.map(({ id, name }) => ({ id, name, ...buildStats(monthAppts, id) }))
    : [];

  return NextResponse.json({
    revenue,
    pending,
    appointmentsCount: nonCancelled.length,
    averageTicket,
    byPractitioner,
    charges: priced
      .sort((a, b) => b.start.localeCompare(a.start))
      .map(a => ({ id: a.id, patientId: a.patientId, patientName: a.patientName, practitionerName: a.practitionerName, start: a.start, price: a.price!, paymentStatus: a.paymentStatus ?? 'pending', appointmentStatus: a.status })),
    pendingCharges,
  });
});
