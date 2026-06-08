'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HHPatient } from '@hh/core';
import { formatDate } from '@hh/core';
import type { AnamnesisNote } from '@hh/fhir';

const ANAMNESIS_LABELS = {
  chiefComplaint: 'Queixa principal',
  presentIllness: 'História da doença atual',
  pastHistory: 'História patológica pregressa',
  objective: 'Objetivo',
} as const;

const emptyForm = { chiefComplaint: '', presentIllness: '', pastHistory: '', objective: '' };

function PatientAvaliacoes({ patient }: { patient: HHPatient }) {
  const [notes, setNotes] = useState<AnamnesisNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anamnesis?patientId=${patient.id}`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: patient.id, ...form }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Erro ao salvar avaliação');
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">{patient.name}</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nova avaliação
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-700">Nova avaliação</h3>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {(['chiefComplaint', 'presentIllness', 'pastHistory', 'objective'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {ANAMNESIS_LABELS[field]}
              </label>
              <textarea
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>
          ))}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm); setError(null); }}
              className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Carregando…</div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">Nenhuma avaliação registrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100"
            >
              <div className="px-5 py-3">
                <span className="text-xs font-semibold text-slate-500">
                  {formatDate(note.date)}
                </span>
              </div>
              {(['chiefComplaint', 'presentIllness', 'pastHistory', 'objective'] as const)
                .filter((f) => note[f])
                .map((field) => (
                  <div key={field} className="px-5 py-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      {ANAMNESIS_LABELS[field]}
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{note[field]}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AvaliacoesPageClient() {
  const [patients, setPatients] = useState<HHPatient[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HHPatient | null>(null);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(query)}`);
      if (res.ok) setPatients(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search('');
  }, [search]);

  useEffect(() => {
    if (q === '') return;
    const t = setTimeout(() => search(q), 350);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div className="flex h-full gap-0 -m-6">
      {/* Patient list panel */}
      <div className="w-64 shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-base font-bold text-slate-900 mb-3">Avaliações</h1>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar paciente…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-slate-400 text-center py-4">Buscando…</p>
          )}
          {!loading && patients.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Nenhum paciente encontrado.</p>
          )}
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                selected?.id === p.id ? 'bg-sky-50 border-l-2 border-l-sky-500' : ''
              }`}
            >
              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Avaliações panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {selected ? (
          <PatientAvaliacoes key={selected.id} patient={selected} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Selecione um paciente para ver as avaliações.</p>
          </div>
        )}
      </div>
    </div>
  );
}
