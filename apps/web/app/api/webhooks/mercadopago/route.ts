import { NextRequest, NextResponse } from 'next/server';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { setExtension } from '@hh/fhir';
import { MercadoPagoPlatformProvider } from '@hh/billing';
import type { Practitioner } from '@medplum/fhirtypes';

async function updatePractitionerStatus(practitionerId: string, status: string, projectId: string) {
  const practitioner = await fhirGet<Practitioner>('Practitioner', practitionerId, projectId);
  const exts = [...(practitioner.extension ?? [])];
  setExtension(exts, 'SUBSCRIPTION_STATUS', status);
  await fhirUpdate<Practitioner>('Practitioner', practitionerId, { ...practitioner, extension: exts }, projectId);
}

export async function POST(req: NextRequest) {
  // Validate secret from query param: configure webhook URL as .../mercadopago?secret=YOUR_SECRET
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET || secret !== process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Provider not configured' }, { status: 503 });
  }

  const provider = new MercadoPagoPlatformProvider(process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN);
  const payload = await req.json();
  const { type, data } = payload as { type: string; data?: { id: string } };

  try {
    if (type === 'subscription_preapproval' && data?.id) {
      const sub = await provider.fetchSubscription(data.id);
      if (!sub.externalReference) return NextResponse.json({ ok: true });

      const projectId = process.env.MEDPLUM_PROJECT_ID!;
      await updatePractitionerStatus(sub.externalReference, sub.status, projectId);
    }

    // Payment notification — look up its subscription then update status
    if (type === 'payment' && data?.id) {
      const subscriptionId = await provider.fetchPaymentSubscriptionId(data.id);
      if (subscriptionId) {
        const sub = await provider.fetchSubscription(subscriptionId);
        if (sub.externalReference) {
          const projectId = process.env.MEDPLUM_PROJECT_ID!;
          await updatePractitionerStatus(sub.externalReference, sub.status, projectId);
        }
      }
    }
  } catch (err) {
    console.error('MP webhook error:', err);
    // Return 200 so MP doesn't retry — log and investigate separately
  }

  return NextResponse.json({ ok: true });
}
