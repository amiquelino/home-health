'use client';

import { useState, useEffect } from 'react';
import { SPECIALTY_LABELS } from '@hh/core';
import type { Specialty } from '@hh/core';

const CREDENTIAL_LABEL: Record<string, string> = {
  fisioterapia:            'CREFITO',
  quiropraxia:             'CREFITO',
  fonoaudiologia:          'CREFITO',
  'terapia-ocupacional':   'CREFITO',
  psicologia:              'CRP',
  nutricao:                'CRN',
  enfermagem:              'COREN',
  'cuidados-domiciliares': 'COREN',
  'educacao-fisica':       'CREF',
  estetica:                'CRO/Estética',
  outro:                   'Nº de Registro',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: '',
    specialty: '' as Specialty | '',
    professionalId: '',
    defaultPrice: null as number | null,
  });
  const [priceDisplay, setPriceDisplay] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.json())
      .then(data => {
        const price = data.defaultPrice != null ? parseFloat(data.defaultPrice) : null;
        setForm({
          name: data.name ?? '',
          specialty: data.specialty ?? '',
          professionalId: data.professionalId ?? '',
          defaultPrice: price,
        });
        if (price != null) setPriceDisplay(formatBRL(price));
      })
      .finally(() => setLoading(false));
  }, []);

  function set(field: string, value: string | null) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          specialty: form.specialty || null,
          professionalId: form.professionalId || null,
          defaultPrice: form.defaultPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return; }
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  const credLabel = form.specialty ? (CREDENTIAL_LABEL[form.specialty] ?? 'Nº de Registro') : 'Nº de Registro';

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Carregando…</div>;

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Perfil salvo com sucesso!</p>}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade</label>
          <select
            value={form.specialty}
            onChange={e => set('specialty', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            <option value="">Selecionar…</option>
            {(Object.entries(SPECIALTY_LABELS) as [Specialty, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{credLabel}</label>
          <input
            type="text"
            value={form.professionalId}
            onChange={e => set('professionalId', e.target.value)}
            placeholder={`Ex: ${credLabel}-123456`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor padrão da consulta</label>
          <input
            type="text"
            inputMode="numeric"
            value={priceDisplay}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '');
              const cents = parseInt(digits || '0', 10);
              const brl = cents / 100;
              setPriceDisplay(cents === 0 ? '' : formatBRL(brl));
              setForm(f => ({ ...f, defaultPrice: cents === 0 ? null : brl }));
            }}
            placeholder="R$ 0,00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <p className="text-xs text-slate-400 mt-1">Preenchido automaticamente ao criar novos agendamentos.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </form>
    </div>
  );
}
