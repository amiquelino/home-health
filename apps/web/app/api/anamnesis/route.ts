import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch, fhirCreate } from '@/lib/medplum-client';
import { toFHIRAnamnesis, fromFHIRAnamnesis } from '@hh/fhir';
import type { ClinicalImpression } from '@medplum/fhirtypes';

export const GET = withAuth(async (req: NextRequest, session) => {
  const patientId = req.nextUrl.searchParams.get('patientId');
  if (!patientId) return NextResponse.json({ error: 'patientId é obrigatório' }, { status: 400 });

  const all = await fhirSearch<ClinicalImpression>(
    'ClinicalImpression',
    {
      subject: `Patient/${patientId}`,
      assessor: `Practitioner/${session.user.practitionerId}`,
      _sort: '-date',
      _count: '50',
    },
    session.user.projectId,
  );

  const notes = all.filter(ci =>
    ci.extension?.some(e => e.url.endsWith('/note-type') && e.valueString === 'avaliacao')
  );

  return NextResponse.json(notes.map(fromFHIRAnamnesis));
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json();
  const { patientId, appointmentId, date, chiefComplaint, presentIllness, pastHistory, objective } = body;

  if (!patientId) return NextResponse.json({ error: 'Paciente é obrigatório' }, { status: 400 });
  if (!chiefComplaint && !presentIllness && !pastHistory && !objective) {
    return NextResponse.json({ error: 'Preencha pelo menos um campo da avaliação' }, { status: 400 });
  }

  const fhir = toFHIRAnamnesis({
    patientId,
    practitionerId: session.user.practitionerId,
    appointmentId,
    date: date ?? new Date().toISOString(),
    chiefComplaint: chiefComplaint ?? '',
    presentIllness: presentIllness ?? '',
    pastHistory:    pastHistory ?? '',
    objective:      objective ?? '',
  });

  const created = await fhirCreate<ClinicalImpression>(
    'ClinicalImpression',
    fhir,
    session.user.projectId,
  );

  return NextResponse.json(fromFHIRAnamnesis(created), { status: 201 });
});
