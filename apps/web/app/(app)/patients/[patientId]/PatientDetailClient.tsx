'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HHPatient, HHAppointment } from '@hh/core';
import { formatPhone, formatCPF, formatDate, formatTime, APPOINTMENT_STATUS_LABELS } from '@hh/core';
import type { SOAPNote, AnamnesisNote } from '@hh/fhir';
import { PatientModal } from '@/components/patients/PatientModal';
import Link from 'next/link';

type Tab = 'dados' | 'consultas' | 'avaliacoes' | 'evolucoes';

const STATUS_BADGE: Record<string, string> = {
  scheduled:  'bg-sky-100 text-sky-700',
  confirmed:  'bg-green-100 text-green-700',
  completed:  'bg-slate-100 text-slate-600',
  cancelled:  'bg-red-100 text-red-500',
  'no-show':  'bg-orange-100 text-orange-700',
};

const SOAP_LABELS = {
  subjective: 'S — Subjetivo',
  objective:  'O — Objetivo',
  assessment: 'A — Avaliação',
  plan:       'P — Plano',
} as const;

const ANAMNESIS_LABELS = {
  chiefComplaint: 'Queixa principal',
  presentIllness: 'História da doença atual',
  pastHistory:    'História patológica pregressa',
  objective:      'Objetivo',
} as const;

const emptySOAP = { subjective: '', objective: '', assessment: '', plan: '' };
const emptyAnamnesis = { chiefComplaint: '', presentIllness: '', pastHistory: '', objective: '' };

export function PatientDetailClient({ patient: initial }: { patient: HHPatient }) {
  const [patient, setPatient] = useState(initial);
  const [showEdit, setShowEdit] = useState(false);
  const [tab, setTab] = useState<Tab>('dados');

  // Appointments
  const [appointments, setAppointments] = useState<HHAppointment[]>([]);
  const [apptLoading, setApptLoading] = useState(false);

  // SOAP notes (evoluções)
  const [notes, setNotes] = useState<SOAPNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showSOAPForm, setShowSOAPForm] = useState(false);
  const [soapForm, setSoapForm] = useState(emptySOAP);
  const [soapSaving, setSoapSaving] = useState(false);
  const [soapError, setSoapError] = useState<string | null>(null);

  // Anamnesis notes (avaliações)
  const [anamneses, setAnamneses] = useState<AnamnesisNote[]>([]);
  const [anamnesisLoading, setAnamnesisLoading] = useState(false);
  const [showAnamnesisForm, setShowAnamnesisForm] = useState(false);
  const [anamnesisForm, setAnamnesisForm] = useState(emptyAnamnesis);
  const [anamnesisSaving, setAnamnesisSaving] = useState(false);
  const [anamnesisError, setAnamnesisError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    setApptLoading(true);
    try {
      const res = await fetch(`/api/appointments?patientId=${patient.id}`);
      if (res.ok) setAppointments(await res.json());
    } finally {
      setApptLoading(false);
    }
  }, [patient.id]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/soap?patientId=${patient.id}`);
      if (res.ok) setNotes(await res.json());
    } finally {
      setNotesLoading(false);
    }
  }, [patient.id]);

  const loadAnamneses = useCallback(async () => {
    setAnamnesisLoading(true);
    try {
      const res = await fetch(`/api/anamnesis?patientId=${patient.id}`);
      if (res.ok) setAnamneses(await res.json());
    } finally {
      setAnamnesisLoading(false);
    }
  }, [patient.id]);

  const loaded = useRef({ consultas: false, avaliacoes: false, evolucoes: false });
  useEffect(() => {
    if (tab === 'consultas' && !loaded.current.consultas) {
      loaded.current.consultas = true;
      loadAppointments();
    }
    if (tab === 'avaliacoes' && !loaded.current.avaliacoes) {
      loaded.current.avaliacoes = true;
      loadAnamneses();
    }
    if (tab === 'evolucoes' && !loaded.current.evolucoes) {
      loaded.current.evolucoes = true;
      loadNotes();
    }
  }, [tab, loadAppointments, loadAnamneses, loadNotes]);

  async function handleSOAPSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSoapSaving(true);
    setSoapError(null);
    try {
      const res = await fetch('/api/soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, ...soapForm }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSoapError(data.error ?? 'Erro ao salvar evolução');
        return;
      }
      setSoapForm(emptySOAP);
      setShowSOAPForm(false);
      await loadNotes();
    } finally {
      setSoapSaving(false);
    }
  }

  async function handleAnamnesisSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAnamnesisSaving(true);
    setAnamnesisError(null);
    try {
      const res = await fetch('/api/anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, ...anamnesisForm }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAnamnesisError(data.error ?? 'Erro ao salvar avaliação');
        return;
      }
      setAnamnesisForm(emptyAnamnesis);
      setShowAnamnesisForm(false);
      await loadAnamneses();
    } finally {
      setAnamnesisSaving(false);
    }
  }

  return (
    <>
      {/* Back */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/patients" className="text-slate-400 hover:text-slate-600 text-sm">
          ← Pacientes
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xl font-bold shrink-0">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
          <p className="text-sm text-slate-500">{formatPhone(patient.phone)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="border border-slate-300 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Editar
          </button>
          <a
            href={`https://wa.me/55${patient.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            WhatsApp
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {([
          { key: 'dados',      label: 'Dados' },
          { key: 'consultas',  label: 'Consultas' },
          { key: 'avaliacoes', label: 'Avaliações' },
          { key: 'evolucoes',  label: 'Evoluções' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dados ── */}
      {tab === 'dados' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {patient.cpf      && <Row label="CPF"          value={formatCPF(patient.cpf)} />}
            {patient.email    && <Row label="E-mail"       value={patient.email} />}
            {patient.birthDate && <Row label="Nascimento"  value={formatDate(patient.birthDate)} />}
            {patient.notes    && <Row label="Observações"  value={patient.notes} />}
          </div>
          <Link
            href={`/schedule`}
            className="block w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2.5 rounded-lg text-center transition-colors"
          >
            + Agendar consulta
          </Link>
        </div>
      )}

      {/* ── Consultas ── */}
      {tab === 'consultas' && (
        <div>
          {apptLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Carregando…</div>
          ) : appointments.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-400 text-sm">Nenhuma consulta registrada.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {new Date(a.start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-slate-500">{formatTime(a.start)}</span>
                      {a.isHomeVisit && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Domiciliar</span>
                      )}
                    </div>
                    {a.practitionerName && (
                      <p className="text-xs text-slate-400 mt-0.5">{a.practitionerName}</p>
                    )}
                    {a.notes && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{a.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {a.price != null && (
                      <span className="text-sm text-slate-600">
                        {a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[a.status] ?? STATUS_BADGE.scheduled}`}>
                      {APPOINTMENT_STATUS_LABELS[a.status as keyof typeof APPOINTMENT_STATUS_LABELS] ?? a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Avaliações ── */}
      {tab === 'avaliacoes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            {!showAnamnesisForm && (
              <button
                onClick={() => setShowAnamnesisForm(true)}
                className="ml-auto bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Nova avaliação
              </button>
            )}
          </div>

          {showAnamnesisForm && (
            <form onSubmit={handleAnamnesisSubmit} className="bg-white rounded-xl border border-slate-200 p-5 mb-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Nova avaliação</h2>
              {anamnesisError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{anamnesisError}</p>
              )}
              {(['chiefComplaint', 'presentIllness', 'pastHistory', 'objective'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{ANAMNESIS_LABELS[field]}</label>
                  <textarea
                    value={anamnesisForm[field]}
                    onChange={e => setAnamnesisForm(f => ({ ...f, [field]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  />
                </div>
              ))}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowAnamnesisForm(false); setAnamnesisForm(emptyAnamnesis); setAnamnesisError(null); }}
                  className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={anamnesisSaving}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  {anamnesisSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          )}

          {anamnesisLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Carregando…</div>
          ) : anamneses.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-400 text-sm">Nenhuma avaliação registrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anamneses.map(note => (
                <div key={note.id} className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <div className="px-5 py-3">
                    <span className="text-xs font-semibold text-slate-500">{formatDate(note.date)}</span>
                  </div>
                  {(['chiefComplaint', 'presentIllness', 'pastHistory', 'objective'] as const)
                    .filter(f => note[f])
                    .map(field => (
                      <div key={field} className="px-5 py-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">{ANAMNESIS_LABELS[field]}</p>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{note[field]}</p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Evoluções ── */}
      {tab === 'evolucoes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            {!showSOAPForm && (
              <button
                onClick={() => setShowSOAPForm(true)}
                className="ml-auto bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Nova evolução
              </button>
            )}
          </div>

          {showSOAPForm && (
            <form onSubmit={handleSOAPSubmit} className="bg-white rounded-xl border border-slate-200 p-5 mb-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Nova evolução</h2>
              {soapError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{soapError}</p>
              )}
              {(['subjective', 'objective', 'assessment', 'plan'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{SOAP_LABELS[field]}</label>
                  <textarea
                    value={soapForm[field]}
                    onChange={e => setSoapForm(f => ({ ...f, [field]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  />
                </div>
              ))}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowSOAPForm(false); setSoapForm(emptySOAP); setSoapError(null); }}
                  className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={soapSaving}
                  className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  {soapSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          )}

          {notesLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Carregando…</div>
          ) : notes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-400 text-sm">Nenhuma evolução registrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <div className="px-5 py-3">
                    <span className="text-xs font-semibold text-slate-500">{formatDate(note.date)}</span>
                  </div>
                  {(['subjective', 'objective', 'assessment', 'plan'] as const)
                    .filter(f => note[f])
                    .map(field => (
                      <div key={field} className="px-5 py-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">{SOAP_LABELS[field]}</p>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{note[field]}</p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <PatientModal
          initial={patient}
          onClose={() => setShowEdit(false)}
          onSaved={(updated: HHPatient) => { setPatient(updated); setShowEdit(false); }}
        />
      )}
    </>
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
