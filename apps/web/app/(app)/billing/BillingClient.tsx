'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PaymentStatus } from '@hh/core';
import { formatDate } from '@hh/core';

interface Charge {
  id: string;
  patientName: string;
  practitionerName?: string;
  start: string;
  price: number;
  paymentStatus: PaymentStatus;
  appointmentStatus: string;
}

interface PractitionerStats {
  id: string;
  name: string;
  revenue: number;
  appointmentsCount: number;
  averageTicket: number;
}

interface Summary {
  revenue: number;
  pending: number;
  appointmentsCount: number;
  averageTicket: number;
  byPractitioner: PractitionerStats[];
  charges: Charge[];
  pendingCharges: Charge[];
}

interface TeamMember { id: string; name: string; role: string; }

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  paid:      'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-slate-100 text-slate-500',
};
const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: 'Pago', pending: 'Pendente', cancelled: 'Cancelado',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function exportCSV(charges: Charge[], month: number, year: number) {
  const monthStr = String(month).padStart(2, '0');
  const header = 'Data,Paciente,Profissional,Valor,Status pagamento,Status consulta';
  const rows = charges.map(c => [
    c.start.slice(0, 10),
    `"${c.patientName}"`,
    `"${c.practitionerName ?? ''}"`,
    c.price.toFixed(2).replace('.', ','),
    PAYMENT_LABELS[c.paymentStatus],
    c.appointmentStatus,
  ].join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeiro-${year}-${monthStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ChargeRow({ charge, showPractitioner }: { charge: Charge; showPractitioner?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{charge.patientName}</p>
        <p className="text-xs text-slate-500">
          {formatDate(charge.start.slice(0, 10))}
          {showPractitioner && charge.practitionerName && ` · ${charge.practitionerName}`}
        </p>
      </div>
      <span className="text-sm font-semibold text-slate-900 shrink-0">{formatBRL(charge.price)}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${PAYMENT_COLORS[charge.paymentStatus]}`}>
        {PAYMENT_LABELS[charge.paymentStatus]}
      </span>
    </div>
  );
}

export function BillingClient({ isOwner = false }: { isOwner?: boolean }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [team, setTeam]         = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] = useState<'all' | string>('all');

  // Load team for owners
  useEffect(() => {
    if (!isOwner) { setTeamLoaded(true); return; }
    fetch('/api/team')
      .then(r => r.ok ? r.json() : [])
      .then((members: TeamMember[]) => { setTeam(members); setTeamLoaded(true); })
      .catch(() => setTeamLoaded(true));
  }, [isOwner]);

  const hasTeam = isOwner && team.some(m => m.role !== 'owner');

  const load = useCallback(async () => {
    if (!teamLoaded) return;
    setLoading(true);
    try {
      let url = `/api/billing/summary?year=${year}&month=${month}`;
      if (hasTeam) {
        url += selectedPractitioner === 'all'
          ? '&practitioners=all'
          : `&practitioners=${selectedPractitioner}`;
      }
      const res = await fetch(url);
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoading(false);
    }
  }, [year, month, teamLoaded, hasTeam, selectedPractitioner]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const monthLabel = new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const showPractitioner = hasTeam && selectedPractitioner === 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900">Financeiro</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">‹</button>
          <span className="text-sm font-medium text-slate-700 capitalize min-w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">›</button>
          {summary?.charges.length ? (
            <button
              onClick={() => exportCSV(summary.charges, month, year)}
              className="ml-2 text-xs border border-slate-300 text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              ↓ CSV
            </button>
          ) : null}
        </div>
      </div>

      {/* Practitioner filter */}
      {hasTeam && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedPractitioner('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedPractitioner === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {team.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedPractitioner(m.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedPractitioner === m.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Receita recebida',  value: summary ? formatBRL(summary.revenue) : '—' },
          { label: 'A receber (total)', value: summary ? formatBRL(summary.pending) : '—', highlight: (summary?.pending ?? 0) > 0 },
          { label: 'Consultas',         value: summary ? String(summary.appointmentsCount) : '—' },
          { label: 'Ticket médio',      value: summary ? formatBRL(summary.averageTicket) : '—' },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-xl border p-4 ${card.highlight ? 'border-yellow-300' : 'border-slate-200'}`}>
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.highlight ? 'text-yellow-700' : 'text-slate-900'}`}>
              {loading ? '...' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Breakdown by practitioner */}
      {!loading && showPractitioner && (summary?.byPractitioner.length ?? 0) > 1 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Por profissional — <span className="capitalize">{monthLabel}</span></h2>
          </div>
          <div className="divide-y divide-slate-100">
            {summary!.byPractitioner.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.appointmentsCount} consultas · ticket médio {formatBRL(p.averageTicket)}</p>
                </div>
                <span className="text-sm font-semibold text-green-700">{formatBRL(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending charges */}
      {!loading && (summary?.pendingCharges.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200">
          <div className="px-5 py-3 border-b border-yellow-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-yellow-800">Pendentes de recebimento</h2>
            <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              {summary!.pendingCharges.length} {summary!.pendingCharges.length === 1 ? 'cobrança' : 'cobranças'}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {summary!.pendingCharges.map(c => <ChargeRow key={c.id} charge={c} showPractitioner={showPractitioner} />)}
          </div>
        </div>
      )}

      {/* Month charges */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Cobranças — <span className="capitalize">{monthLabel}</span>
          </h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Carregando...</div>
        ) : !summary?.charges.length ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhuma cobrança neste mês. Defina o valor nas consultas para registrar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.charges.map(c => <ChargeRow key={c.id} charge={c} showPractitioner={showPractitioner} />)}
          </div>
        )}
      </div>
    </div>
  );
}
