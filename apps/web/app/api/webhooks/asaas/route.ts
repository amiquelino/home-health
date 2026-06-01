import { NextRequest, NextResponse } from 'next/server';
import { parseAsaasWebhook } from '@hh/billing';
import { fhirSearch, fhirUpdate } from '@/lib/medplum-client';
import { getExtension, setExtension, HH_EXT } from '@hh/fhir';
import type { Practitioner } from '@medplum/fhirtypes';

async function findPractitionerBySubscription(subscriptionId: string): Promise<Practitioner | null> {
  const all = await fhirSearch<Practitioner>('Practitioner', { _count: '200' });
  return all.find(p =>
    p.extension?.some(e => e.url === HH_EXT.ASAAS_SUBSCRIPTION_ID && e.valueString === subscriptionId)
  ) ?? null;
}

async function updateSubscriptionStatus(subscriptionId: string, status: string) {
  const practitioner = await findPractitionerBySubscription(subscriptionId);
  if (!practitioner?.id) return;

  const projectId = getExtension(practitioner, 'PROJECT_ID') ?? process.env.MEDPLUM_PROJECT_ID!;
  const exts = [...(practitioner.extension ?? [])];
  setExtension(exts, 'SUBSCRIPTION_STATUS', status);

  await fhirUpdate<Practitioner>('Practitioner', practitioner.id, { ...practitioner, extension: exts }, projectId);
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('asaas-access-token');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await req.json();
  const event = parseAsaasWebhook(payload);
  if (!event) return NextResponse.json({ ok: true });

  switch (event.type) {
    case 'payment.succeeded':
      await updateSubscriptionStatus(event.subscriptionId, 'active');
      break;
    case 'payment.failed':
      await updateSubscriptionStatus(event.subscriptionId, 'past_due');
      break;
    case 'subscription.activated':
      await updateSubscriptionStatus(event.subscriptionId, 'active');
      break;
    case 'subscription.cancelled':
      await updateSubscriptionStatus(event.subscriptionId, 'cancelled');
      break;
  }

  return NextResponse.json({ ok: true });
}
