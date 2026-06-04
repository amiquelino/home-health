import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch, fhirCreate } from '@/lib/medplum-client';
import { toFHIRPatient, fromFHIRPatient } from '@hh/fhir';
import { HH_EXT } from '@hh/fhir';
import { isValidCPF } from '@hh/core';
import type { Patient, Practitioner } from '@medplum/fhirtypes';

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
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const practitionersParam = req.nextUrl.searchParams.get('practitioners');
  const practitionerIdParam = req.nextUrl.searchParams.get('practitionerId');

  // Owner with ?practitioners=all: search across all team members' patients
  if (practitionersParam === 'all' && session.user.role === 'owner') {
    const teamIds = await getTeamIds(session.user.practitionerId, session.user.projectId);
    const results = await Promise.all(
      teamIds.map(pid => {
        const params: Record<string, string> = {
          _sort: '-_lastUpdated',
          _count: '50',
          'general-practitioner': `Practitioner/${pid}`,
        };
        if (q) params.name = q;
        return fhirSearch<Patient>('Patient', params, session.user.projectId);
      })
    );
    const seen = new Set<string>();
    const patients = results.flat().filter(p => {
      if (seen.has(p.id!)) return false;
      seen.add(p.id!);
      return true;
    });
    return NextResponse.json(patients.map(fromFHIRPatient));
  }

  // Default: filter by the specific practitioner (own or explicit override for owner)
  const practitionerId =
    practitionerIdParam && session.user.role === 'owner'
      ? practitionerIdParam
      : session.user.practitionerId;

  const params: Record<string, string> = {
    _sort: '-_lastUpdated',
    _count: '50',
    'general-practitioner': `Practitioner/${practitionerId}`,
  };
  if (q) params.name = q;

  const patients = await fhirSearch<Patient>('Patient', params, session.user.projectId);
  return NextResponse.json(patients.map(fromFHIRPatient));
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await req.json();
  const { name, phone, cpf, email, birthDate, notes } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  if (!phone?.trim()) return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
  if (cpf && !isValidCPF(cpf)) return NextResponse.json({ error: 'CPF inválido' }, { status: 400 });

  const fhirPatient = toFHIRPatient(
    { id: '', name, phone, cpf, email, birthDate, notes, createdAt: '' },
    session.user.practitionerId,
  );
  const created = await fhirCreate<Patient>('Patient', fhirPatient, session.user.projectId);
  return NextResponse.json(fromFHIRPatient(created), { status: 201 });
});
