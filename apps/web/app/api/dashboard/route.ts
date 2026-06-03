import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch } from '@/lib/medplum-client';
import { fromFHIRAppointment } from '@hh/fhir';
import type { Appointment, Patient } from '@medplum/fhirtypes';

export const GET = withAuth(async (_req, session) => {
  const today = new Date().toISOString().slice(0, 10);
  const practitionerRef = `Practitioner/${session.user.practitionerId}`;

  const [todayAppts, allPatients, allAppts] = await Promise.all([
    fhirSearch<Appointment>('Appointment', {
      date: [`ge${today}`, `le${today}`],
      actor: practitionerRef,
      _sort: 'date',
      _count: '50',
    }, session.user.projectId),

    fhirSearch<Patient>('Patient', {
      'general-practitioner': practitionerRef,
      _count: '200',
    }, session.user.projectId),

    fhirSearch<Appointment>('Appointment', {
      actor: practitionerRef,
      _count: '500',
    }, session.user.projectId),
  ]);

  const appointments = todayAppts.map(fromFHIRAppointment);
  const scheduled = appointments.filter(a => a.status !== 'cancelled');
  const completed = appointments.filter(a => a.status === 'completed');

  const allMapped = allAppts.map(fromFHIRAppointment).filter(a => a.status !== 'cancelled');
  const pending = allMapped
    .filter(a => a.price && a.paymentStatus === 'pending')
    .reduce((sum, a) => sum + (a.price ?? 0), 0);

  const now = new Date().toISOString();
  const next = allMapped
    .filter(a => a.start > now && a.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;

  return NextResponse.json({
    today: {
      total: scheduled.length,
      completed: completed.length,
      remaining: scheduled.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length,
    },
    pending,
    patientCount: allPatients.length,
    todayAppointments: scheduled.map(a => ({
      id: a.id,
      patientName: a.patientName,
      start: a.start,
      status: a.status,
      isHomeVisit: a.isHomeVisit,
    })),
    nextAppointment: next ? {
      id: next.id,
      patientName: next.patientName,
      start: next.start,
      isHomeVisit: next.isHomeVisit,
    } : null,
  });
});
