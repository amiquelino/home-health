import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch, fhirCreate, fhirGet } from '@/lib/medplum-client';
import { toFHIRAppointment, fromFHIRAppointment, getExtension } from '@hh/fhir';
import { HH_EXT } from '@hh/fhir';
import type { Appointment, Practitioner } from '@medplum/fhirtypes';

async function getTeamIds(ownerPractitionerId: string, projectId: string): Promise<string[]> {
  const all = await fhirSearch<Practitioner>('Practitioner', { _count: '100' }, projectId);
  const memberIds = all
    .filter(p =>
      p.active !== false &&
      p.extension?.some(e => e.url === HH_EXT.OWNER_ID && e.valueString === ownerPractitionerId)
    )
    .map(p => p.id!);
  return [ownerPractitionerId, ...memberIds];
}

export const GET = withAuth(async (req: NextRequest, session) => {
  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get('from');
  const dateTo = searchParams.get('to');
  const practitionersParam = searchParams.get('practitioners');
  const patientIdParam = searchParams.get('patientId');

  const dateFilter: string[] = [];
  if (dateFrom) dateFilter.push(`ge${dateFrom}`);
  if (dateTo) dateFilter.push(`le${dateTo}`);

  // Patient history view: fetch all appointments for a specific patient
  if (patientIdParam) {
    const params: Record<string, string | string[]> = {
      _sort: '-date',
      _count: '200',
      actor: `Patient/${patientIdParam}`,
    };
    if (dateFilter.length) params['date'] = dateFilter;
    const results = await fhirSearch<Appointment>('Appointment', params, session.user.projectId);
    return NextResponse.json(results.map(fromFHIRAppointment));
  }

  let practitionerIds: string[];
  if (practitionersParam && session.user.role === 'owner') {
    if (practitionersParam === 'all') {
      practitionerIds = await getTeamIds(session.user.practitionerId, session.user.projectId);
    } else {
      practitionerIds = practitionersParam.split(',').filter(Boolean);
    }
  } else {
    practitionerIds = [session.user.practitionerId];
  }

  const results = await Promise.all(
    practitionerIds.map(pid => {
      const params: Record<string, string | string[]> = {
        _sort: 'date',
        _count: '200',
        actor: `Practitioner/${pid}`,
      };
      if (dateFilter.length) params['date'] = dateFilter;
      return fhirSearch<Appointment>('Appointment', params, session.user.projectId);
    })
  );

  const appointments = results.flat().map(fromFHIRAppointment);
  appointments.sort((a, b) => a.start.localeCompare(b.start));
  return NextResponse.json(appointments);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json();
  const { patientId, patientName, start, end, notes, isHomeVisit, homeVisitAddress, practitionerId: bodyPractitionerId } = body;

  if (!patientId) return NextResponse.json({ error: 'Paciente é obrigatório' }, { status: 400 });
  if (!start) return NextResponse.json({ error: 'Data/hora é obrigatória' }, { status: 400 });
  if (!end) return NextResponse.json({ error: 'Duração é obrigatória' }, { status: 400 });

  let practitionerId = session.user.practitionerId;
  let practitionerName = session.user.name ?? '';

  if (bodyPractitionerId && bodyPractitionerId !== session.user.practitionerId) {
    if (session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    // Verify the practitioner belongs to this owner's team
    const teamIds = await getTeamIds(session.user.practitionerId, session.user.projectId);
    if (!teamIds.includes(bodyPractitionerId)) {
      return NextResponse.json({ error: 'Profissional não encontrado na equipe' }, { status: 403 });
    }
    practitionerId = bodyPractitionerId;
    practitionerName = body.practitionerName ?? '';
  }

  // Read default price from the practitioner's profile
  let defaultPrice: number | undefined;
  try {
    const pract = await fhirGet<Practitioner>('Practitioner', practitionerId, session.user.projectId);
    const raw = getExtension(pract, 'DEFAULT_PRICE');
    if (raw) defaultPrice = parseFloat(raw);
  } catch { /* non-fatal */ }

  const fhir = toFHIRAppointment({
    id: '',
    patientId,
    patientName: patientName ?? '',
    practitionerId,
    practitionerName,
    start,
    end,
    status: 'scheduled',
    notes,
    isHomeVisit,
    homeVisitAddress,
    price: defaultPrice,
  });

  const created = await fhirCreate<Appointment>('Appointment', fhir, session.user.projectId);
  return NextResponse.json(fromFHIRAppointment(created), { status: 201 });
});
