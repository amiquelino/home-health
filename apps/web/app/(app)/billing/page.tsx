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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Financeiro</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">‹</button>
          <span className="text-sm font-medium text-slate-700 capitalize min-w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600">›</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Receita recebida', value: summary ? formatBRL(summary.revenue) : '—' },
          { label: 'A receber', value: summary ? formatBRL(summary.pending) : '—' },
          { label: 'Consultas', value: summary ? String(summary.appointmentsCount) : '—' },
          { label: 'Ticket médio', value: summary ? formatBRL(summary.averageTicket) : '—' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-slate-900">{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Charges list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Cobranças</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Carregando...</div>
        ) : !summary?.charges.length ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nenhuma cobrança este mês. Defina o valor nas consultas para registrar.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.charges.map(charge => (
              <div key={charge.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{charge.patientName}</p>
                  <p className="text-xs text-slate-500">{formatDate(charge.start.slice(0, 10))}</p>
                </div>
                <span className="text-sm font-semibold text-slate-900">{formatBRL(charge.price)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_COLORS[charge.paymentStatus]}`}>
                  {PAYMENT_LABELS[charge.paymentStatus]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
