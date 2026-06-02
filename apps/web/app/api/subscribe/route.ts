import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { getExtension, setExtension } from '@hh/fhir';
import { PLANS, getPlatformProvider } from '@hh/billing';
import type { SubscriptionPlan } from '@hh/core';
import type { Practitioner } from '@medplum/fhirtypes';

export const POST = withAuth(async (req: NextRequest, session) => {
  let provider;
  try {
    provider = getPlatformProvider();
  } catch {
    return NextResponse.json(
      { error: 'Pagamento não configurado na plataforma. Configure MERCADOPAGO_PLATFORM_ACCESS_TOKEN ou ASAAS_PLATFORM_API_KEY.' },
      { status: 503 },
    );
  }

  const { plan } = await req.json() as { plan: SubscriptionPlan };
  if (!PLANS[plan]) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
  }

  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const email = practitioner.telecom?.find(t => t.system === 'email')?.value ?? '';
  const name = practitioner.name?.[0]?.text ?? email;
  const existingSubId = getExtension(practitioner, 'ASAAS_SUBSCRIPTION_ID');

  const result = await provider.createSubscription({
    customerEmail: email,
    customerName: name,
    amount: PLANS[plan].priceBRL / 100,
    description: `Home Health — Plano ${PLANS[plan].name}`,
    externalReference: session.user.practitionerId,
  });

  if (!existingSubId) {
    const exts = [...(practitioner.extension ?? [])];
    setExtension(exts, 'ASAAS_SUBSCRIPTION_ID', result.subscriptionId);
    setExtension(exts, 'SUBSCRIPTION_PLAN', plan);

    await fhirUpdate<Practitioner>(
      'Practitioner',
      session.user.practitionerId,
      { ...practitioner, extension: exts },
      session.user.projectId,
    );
  }

  return NextResponse.json({
    subscriptionId: result.subscriptionId,
    paymentUrl: result.paymentUrl,
  });
});
