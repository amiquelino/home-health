import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet } from '@/lib/medplum-client';
import { fromFHIRPatient, getExtension } from '@hh/fhir';
import { getProvider } from '@hh/billing';
import type { ProviderType } from '@hh/billing';
import type { Patient, Practitioner } from '@medplum/fhirtypes';

export const POST = withAuth(async (req: NextRequest, session) => {
  const practitioner = await fhirGet<Practitioner>(
    'Practitioner',
    session.user.practitionerId,
    session.user.projectId,
  );

  const providerType = getExtension(practitioner, 'PAYMENT_PROVIDER_TYPE') as ProviderType | undefined;
  const apiKey = getExtension(practitioner, 'PAYMENT_PROVIDER_KEY');

  if (!providerType || !apiKey) {
    return NextResponse.json(
      { error: 'Nenhum provedor de pagamento configurado. Acesse Configurações → Pagamentos.' },
      { status: 503 },
    );
  }

  const { appointmentId, patientId, amount, description, dueDate } = await req.json();
  if (!patientId || !amount || !dueDate) {
    return NextResponse.json({ error: 'patientId, amount e dueDate são obrigatórios' }, { status: 400 });
  }

  const fhirPatient = await fhirGet<Patient>('Patient', patientId, session.user.projectId);
  const patient = fromFHIRPatient(fhirPatient);

  if (!patient.cpf) {
    return NextResponse.json(
      { error: 'Paciente sem CPF — necessário para gerar cobrança' },
      { status: 422 },
    );
  }

  const provider = getProvider({ type: providerType, apiKey });

  const result = await provider.createPixCharge({
    customerName: patient.name,
    customerCpf: patient.cpf,
    customerEmail: patient.email ?? `${patient.cpf.replace(/\D/g, '')}@placeholder.com`,
    amount,
    dueDate,
    description: description ?? 'Consulta',
  });

  return NextResponse.json({ ...result, appointmentId });
});
