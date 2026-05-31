'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PaymentStatus } from '@hh/core';
import { formatDate } from '@hh/core';

interface Charge {
  id: string;
  patientName: string;
  start: string;
  price: number;
  paymentStatus: PaymentStatus;
  appointmentStatus: string;
}

interface Summary {
  revenue: number;
  pending: number;
  appointmentsCount: number;
  averageTicket: number;
  charges: Charge[];
  pendingCharges: Charge[];
}

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  cancelled: 'Cancelado',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ChargeRow({ charge }: { charge: Charge }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{charge.patientName}</p>
        <p className="text-xs text-slate-500">{formatDate(charge.start.slice(0, 10))}</p>
      </div>
      <span className="text-sm font-semibold text-slate-900">{formatBRL(charge.price)}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_COLORS[charge.paymentStatus]}`}>
        {PAYMENT_LABELS[charge.paymentStatus]}
      </span>
    </div>
  );
}

export default function BillingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/summary?year=${year}&month=${month}`);
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoading(false);
    }
  }, [year, month]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Financeiro</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">‹</button>
          <span className="text-sm font-medium text-slate-700 capitalize min-w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">›</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Receita recebida', value: summary ? formatBRL(summary.revenue) : '—' },
          { label: 'A receber (total)', value: summary ? formatBRL(summary.pending) : '—', highlight: (summary?.pending ?? 0) > 0 },
          { label: 'Consultas', value: summary ? String(summary.appointmentsCount) : '—' },
          { label: 'Ticket médio', value: summary ? formatBRL(summary.averageTicket) : '—' },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-xl border p-4 ${card.highlight ? 'border-yellow-300' : 'border-slate-200'}`}>
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.highlight ? 'text-yellow-700' : 'text-slate-900'}`}>
              {loading ? '...' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Pending charges — all time */}
      {!loading && (summary?.pendingCharges.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200">
          <div className="px-5 py-3 border-b border-yellow-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-yellow-800">Pendentes de recebimento</h2>
            <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              {summary!.pendingCharges.length} {summary!.pendingCharges.length === 1 ? 'cobrança' : 'cobranças'}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {summary!.pendingCharges.map(charge => (
              <ChargeRow key={charge.id} charge={charge} />
            ))}
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
            {summary.charges.map(charge => (
              <ChargeRow key={charge.id} charge={charge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
