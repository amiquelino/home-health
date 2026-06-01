import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet, fhirUpdate } from '@/lib/medplum-client';
import { getExtension, setExtension } from '@hh/fhir';
import { PLANS, makeAsaasClient } from '@hh/billing';
import type { SubscriptionPlan } from '@hh/core';
import type { Practitioner } from '@medplum/fhirtypes';

export const POST = withAuth(async (req: NextRequest, session) => {
  if (!process.env.ASAAS_PLATFORM_API_KEY) {
    return NextResponse.json({ error: 'Pagamento não configurado na plataforma' }, { status: 503 });
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

  const platformClient = makeAsaasClient(process.env.ASAAS_PLATFORM_API_KEY!);
  const email = practitioner.telecom?.find(t => t.system === 'email')?.value ?? '';
  const name = practitioner.name?.[0]?.text ?? email;

  // Reuse existing Asaas customer or create new one
  let customerId = getExtension(practitioner, 'ASAAS_CUSTOMER_ID');
  if (!customerId) {
    const customer = await platformClient.createCustomer({ name, cpfCnpj: '00000000000', email });
    customerId = customer.id;
  }

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);

  const subscription = await platformClient.createSubscription({
    customer: customerId,
    value: PLANS[plan].priceBRL / 100,
    nextDueDate: nextDueDate.toISOString().slice(0, 10),
    description: `Home Health — Plano ${PLANS[plan].name}`,
  });

  const exts = [...(practitioner.extension ?? [])];
  setExtension(exts, 'ASAAS_CUSTOMER_ID', customerId);
  setExtension(exts, 'ASAAS_SUBSCRIPTION_ID', subscription.id);
  setExtension(exts, 'SUBSCRIPTION_PLAN', plan);
  setExtension(exts, 'SUBSCRIPTION_STATUS', 'trial');

  await fhirUpdate<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    { ...practitioner, extension: exts },
    session.user.projectId,
  );

  return NextResponse.json({
    subscriptionId: subscription.id,
    paymentUrl: `https://www.asaas.com/c/${subscription.id}`,
  });
});
