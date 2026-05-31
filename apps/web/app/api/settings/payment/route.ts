import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { HH_EXT, getExtension, setExtension } from '@hh/fhir';
import type { ProviderType } from '@hh/billing';
import type { Practitioner } from '@medplum/fhirtypes';

export const GET = withAuth(async (_req, session) => {
  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const type = getExtension(practitioner, 'PAYMENT_PROVIDER_TYPE') as ProviderType | undefined;
  const configured = !!getExtension(practitioner, 'PAYMENT_PROVIDER_KEY');

  return NextResponse.json({ type: type ?? null, configured });
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  const { type, apiKey } = await req.json() as { type: ProviderType; apiKey: string };

  if (!type || !apiKey?.trim()) {
    return NextResponse.json({ error: 'type e apiKey são obrigatórios' }, { status: 400 });
  }

  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const exts = [...(practitioner.extension ?? [])];
  setExtension(exts, 'PAYMENT_PROVIDER_TYPE', type);
  setExtension(exts, 'PAYMENT_PROVIDER_KEY', apiKey.trim());

  await fhirUpdate<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    { ...practitioner, extension: exts },
    session.user.projectId,
  );

  return NextResponse.json({ ok: true, type, configured: true });
});
