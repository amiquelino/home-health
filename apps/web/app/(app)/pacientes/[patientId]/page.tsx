import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fhirGet } from '@/lib/medplum-client';
import { fromFHIRPatient } from '@hh/fhir';
import { formatPhone, formatCPF, formatDate } from '@hh/core';
import type { Patient } from '@medplum/fhirtypes';

export default async function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;

  let patient;
  try {
    const fhir = await fhirGet<Patient>('Patient', patientId);
    patient = fromFHIRPatient(fhir);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pacientes" className="text-slate-400 hover:text-slate-600 text-sm">
          ← Pacientes
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xl font-bold">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
          <p className="text-sm text-slate-500">{formatPhone(patient.phone)}</p>
        </div>
        <a
          href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          WhatsApp
        </a>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-4">
        {patient.cpf && (
          <Row label="CPF" value={formatCPF(patient.cpf)} />
        )}
        {patient.email && (
          <Row label="E-mail" value={patient.email} />
        )}
        {patient.birthDate && (
          <Row label="Nascimento" value={formatDate(patient.birthDate)} />
        )}
        {patient.notes && (
          <Row label="Observações" value={patient.notes} />
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/agenda?paciente=${patientId}`}
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2.5 rounded-lg text-center transition-colors"
        >
          + Agendar consulta
        </Link>
        <Link
          href={`/pacientes/${patientId}/evolucao`}
          className="border border-slate-300 text-slate-700 text-sm font-medium py-2.5 rounded-lg text-center hover:bg-slate-50 transition-colors"
        >
          Ver evoluções
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex px-4 py-3 gap-4">
      <span className="text-sm text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}
