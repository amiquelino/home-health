import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { fhirGet } from '@/lib/medplum-client';
import { fromFHIRPatient } from '@hh/fhir';
import { asaas } from '@hh/billing';
import type { Patient } from '@medplum/fhirtypes';

export const POST = withAuth(async (req: NextRequest, session) => {
  if (!process.env.ASAAS_API_KEY) {
    return NextResponse.json({ error: 'ASAAS_API_KEY não configurado' }, { status: 503 });
  }

  const { appointmentId, patientId, amount, description, dueDate } = await req.json();
  if (!patientId || !amount || !dueDate) {
    return NextResponse.json({ error: 'patientId, amount e dueDate são obrigatórios' }, { status: 400 });
  }

  const fhirPatient = await fhirGet<Patient>('Patient', patientId, session.user.projectId);
  const patient = fromFHIRPatient(fhirPatient);

  if (!patient.cpf) {
    return NextResponse.json({ error: 'Paciente sem CPF — necessário para gerar cobrança' }, { status: 422 });
  }

  const customer = await asaas.createCustomer({
    name: patient.name,
    cpfCnpj: patient.cpf.replace(/\D/g, ''),
    email: patient.email ?? `${patient.cpf.replace(/\D/g, '')}@placeholder.com`,
  });

  const charge = await asaas.createCharge({
    customer: customer.id,
    value: amount,
    dueDate,
    description: description ?? 'Consulta',
  });

  const qr = await asaas.getChargePixQrCode(charge.id).catch(() => null);

  return NextResponse.json({
    chargeId: charge.id,
    invoiceUrl: charge.invoiceUrl,
    pixCopiaECola: qr?.payload ?? null,
    pixQrCodeBase64: qr?.encodedImage ?? null,
    appointmentId,
  });
});
