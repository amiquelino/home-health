import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { getExtension, setExtension, HH_EXT } from '@hh/fhir';
import type { Practitioner } from '@medplum/fhirtypes';

// Map specialty → which credential extension to use
const SPECIALTY_CREDENTIAL: Record<string, keyof typeof HH_EXT> = {
  fisioterapia:          'CREFITO',
  quiropraxia:           'CREFITO',
  fonoaudiologia:        'CREFITO',
  'terapia-ocupacional': 'CREFITO',
  psicologia:            'CRP',
  nutricao:              'CRN',
  outro:                 'CRN',
  enfermagem:            'CRN',
  'cuidados-domiciliares': 'CRN',
  'educacao-fisica':     'CRN',
  estetica:              'CFO',
};

function getCredentialKey(specialty: string): keyof typeof HH_EXT {
  return SPECIALTY_CREDENTIAL[specialty] ?? 'CREFITO';
}

export const GET = withAuth(async (_req, session) => {
  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const specialty = getExtension(practitioner, 'SPECIALTY') ?? '';
  const credKey = getCredentialKey(specialty);
  const professionalId = getExtension(practitioner, credKey) ?? '';
  const defaultPrice = getExtension(practitioner, 'DEFAULT_PRICE') ?? '';

  return NextResponse.json({
    name: practitioner.name?.[0]?.text ?? '',
    specialty,
    professionalId,
    defaultPrice: defaultPrice ? parseFloat(defaultPrice) : null,
  });
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  const { name, specialty, professionalId, defaultPrice } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const exts = [...(practitioner.extension ?? [])];
  if (specialty) setExtension(exts, 'SPECIALTY', specialty);
  if (professionalId?.trim()) {
    const credKey = getCredentialKey(specialty ?? '');
    setExtension(exts, credKey, professionalId.trim());
  }
  if (defaultPrice != null && !isNaN(parseFloat(defaultPrice))) {
    setExtension(exts, 'DEFAULT_PRICE', String(parseFloat(defaultPrice)));
  }

  await fhirUpdate<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    {
      ...practitioner,
      name: [{ text: name.trim() }],
      extension: exts,
    },
    session.user.projectId,
  );

  return NextResponse.json({ ok: true });
});
