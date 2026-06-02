import { NextRequest, NextResponse } from 'next/server';
import { parseAsaasWebhook, AsaasPlatformProvider } from '@hh/billing';
import { fhirGet, fhirSearch, fhirUpdate } from '@/lib/medplum-client';
import { getExtension, setExtension, HH_EXT } from '@hh/fhir';
import type { Practitioner } from '@medplum/fhirtypes';

async function findPractitionerBySubscription(subscriptionId: string): Promise<Practitioner | null> {
  // Try direct lookup via externalReference first (new subscriptions store practitionerId)
  // Fall back to full scan for subscriptions created before this change
  const all = await fhirSearch<Practitioner>('Practitioner', { _count: '200' });
  return all.find(p =>
    p.extension?.some(e => e.url === HH_EXT.ASAAS_SUBSCRIPTION_ID && e.valueString === subscriptionId)
  ) ?? null;
}

async function updateSubscriptionStatus(subscriptionId: string, status: string) {
  if (!process.env.ASAAS_PLATFORM_API_KEY) return;
  const provider = new AsaasPlatformProvider(process.env.ASAAS_PLATFORM_API_KEY);

  try {
    // Fetch subscription to get externalReference (practitionerId)
    const sub = await provider.fetchSubscription(subscriptionId);
    const projectId = process.env.MEDPLUM_PROJECT_ID!;

    if (sub.externalReference) {
      // Direct lookup — fast path for new subscriptions
      const practitioner = await fhirGet<Practitioner>('Practitioner', sub.externalReference, projectId);
      const exts = [...(practitioner.extension ?? [])];
      setExtension(exts, 'SUBSCRIPTION_STATUS', status);
      await fhirUpdate<Practitioner>('Practitioner', practitioner.id!, { ...practitioner, extension: exts }, projectId);
    } else {
      // Fallback — scan all practitioners (legacy subscriptions without externalReference)
      const practitioner = await findPractitionerBySubscription(subscriptionId);
      if (!practitioner?.id) return;
      const pProjectId = getExtension(practitioner, 'PROJECT_ID') ?? projectId;
      const exts = [...(practitioner.extension ?? [])];
      setExtension(exts, 'SUBSCRIPTION_STATUS', status);
      await fhirUpdate<Practitioner>('Practitioner', practitioner.id, { ...practitioner, extension: exts }, pProjectId);
    }
  } catch (err) {
    console.error('Asaas webhook error:', err);
  }
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
    case 'subscription.activated':
      await updateSubscriptionStatus(event.subscriptionId, 'active');
      break;
    case 'payment.failed':
      await updateSubscriptionStatus(event.subscriptionId, 'past_due');
      break;
    case 'subscription.cancelled':
      await updateSubscriptionStatus(event.subscriptionId, 'cancelled');
      break;
  }

  return NextResponse.json({ ok: true });
}
