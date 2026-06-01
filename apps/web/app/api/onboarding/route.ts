import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { setExtension } from '@hh/fhir';
import type { Practitioner } from '@medplum/fhirtypes';

export const PUT = withAuth(async (req: NextRequest, session) => {
  const { specialty, defaultPrice } = await req.json();

  if (!specialty) {
    return NextResponse.json({ error: 'Especialidade é obrigatória' }, { status: 400 });
  }

  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const exts = [...(practitioner.extension ?? [])];
  setExtension(exts, 'SPECIALTY', specialty);
  setExtension(exts, 'ONBOARDED', 'true');
  if (defaultPrice !== undefined && defaultPrice > 0) {
    setExtension(exts, 'DEFAULT_PRICE', String(defaultPrice));
  }

  await fhirUpdate<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    { ...practitioner, extension: exts },
    session.user.projectId,
  );

  return NextResponse.json({ ok: true });
});
