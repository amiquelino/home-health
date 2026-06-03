import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { HH_EXT, setExtension } from '@hh/fhir';
import type { Practitioner } from '@medplum/fhirtypes';

export const DELETE = withAuth(async (
  _req: NextRequest,
  session,
  context,
) => {
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o proprietário pode remover profissionais' }, { status: 403 });
  }

  const { practitionerId } = await context!.params;

  if (practitionerId === session.user.practitionerId) {
    return NextResponse.json({ error: 'Não é possível remover o proprietário' }, { status: 400 });
  }

  const practitioner = await fhirGet<Practitioner>('Practitioner', practitionerId, session.user.projectId);

  // Verify belongs to same project
  const projId = practitioner.extension?.find(e => e.url === HH_EXT.PROJECT_ID)?.valueString;
  if (projId !== session.user.projectId) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 });
  }

  // Soft delete: mark as inactive
  const exts = [...(practitioner.extension ?? [])];
  setExtension(exts, 'SUBSCRIPTION_STATUS', 'cancelled');

  await fhirUpdate<Practitioner>(
    'Practitioner',
    practitionerId,
    { ...practitioner, active: false, extension: exts },
    session.user.projectId,
  );

  return NextResponse.json({ ok: true });
});
