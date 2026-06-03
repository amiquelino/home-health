import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirSearch } from '@/lib/medplum-client';
import { createUser } from '@/lib/users';
import { HH_EXT } from '@hh/fhir';
import { PLAN_LIMITS } from '@hh/core';
import type { SubscriptionPlan } from '@hh/core';
import type { Practitioner } from '@medplum/fhirtypes';

export const GET = withAuth(async (_req, session) => {
  const all = await fhirSearch<Practitioner>('Practitioner', { _count: '100', active: 'true' }, session.user.projectId);

  const members = all
    .filter(p => p.extension?.some(e => e.url === HH_EXT.PROJECT_ID && e.valueString === session.user.projectId))
    .map(p => ({
      id: p.id!,
      name: p.name?.[0]?.text ?? '',
      email: p.telecom?.find(t => t.system === 'email')?.value ?? '',
      role: p.extension?.find(e => e.url === 'https://homehealth.com.br/fhir/StructureDefinition/role')?.valueString ?? 'practitioner',
    }));

  return NextResponse.json(members);
});

export const POST = withAuth(async (req: NextRequest, session) => {
  if (session.user.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o proprietário pode convidar profissionais' }, { status: 403 });
  }

  const { name, email, password } = await req.json();
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, { status: 400 });
  }

  // Check plan limit
  const plan = (session.user.subscriptionPlan ?? 'starter') as SubscriptionPlan;
  const limit = PLAN_LIMITS[plan]?.maxPractitioners ?? 1;
  const existing = await fhirSearch<Practitioner>('Practitioner', { _count: '100', active: 'true' }, session.user.projectId);
  const currentCount = existing.filter(p =>
    p.extension?.some(e => e.url === HH_EXT.PROJECT_ID && e.valueString === session.user.projectId)
  ).length;

  if (currentCount >= limit) {
    return NextResponse.json({
      error: `Seu plano ${plan} permite no máximo ${limit} profissional${limit > 1 ? 'is' : ''}. Faça upgrade para adicionar mais.`,
    }, { status: 403 });
  }

  // Check email not already taken
  const emailCheck = await fhirSearch<Practitioner>('Practitioner', { telecom: `email|${email}` });
  if (emailCheck.length > 0) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
  }

  const user = await createUser({
    name,
    email,
    password,
    role: 'practitioner',
    projectId: session.user.projectId,
  });

  return NextResponse.json({ id: user.practitionerId, name: user.name, email: user.email, role: user.role }, { status: 201 });
});
