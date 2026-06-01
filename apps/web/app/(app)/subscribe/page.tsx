'use client';

import { useState } from 'react';
import type { SubscriptionPlan } from '@hh/core';
import { PLANS } from '@hh/billing';

const FEATURE_LABELS: Record<string, string> = {
  agenda: 'Agenda e calendário',
  pacientes: 'Gestão de pacientes',
  evolucoes: 'Evoluções SOAP',
  whatsapp: 'Lembretes WhatsApp',
  financeiro: 'Financeiro e PIX',
  'multi-agenda': 'Multi-profissional',
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SubscribePage() {
  const [selected, setSelected] = useState<SubscriptionPlan>('starter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubscribe() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao criar assinatura'); return; }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Escolha seu plano</h1>
        <p className="text-slate-500 text-sm">Cancele quando quiser. Sem multa.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {(Object.values(PLANS) as typeof PLANS[SubscriptionPlan][]).map(plan => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelected(plan.id)}
            className={`rounded-2xl border-2 p-5 text-left transition-all ${
              selected === plan.id
                ? 'border-sky-500 bg-sky-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-900">{plan.name}</span>
              {selected === plan.id && (
                <span className="w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center text-white text-xs">✓</span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {formatBRL(plan.priceBRL)}
              <span className="text-sm font-normal text-slate-500">/mês</span>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {plan.maxPractitioners === 1 ? '1 profissional' : `Até ${plan.maxPractitioners} profissionais`}
            </p>
            <ul className="space-y-1.5">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-slate-700">
                  <span className="text-green-500 shrink-0">✓</span>
                  {FEATURE_LABELS[f] ?? f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-4 text-center">{error}</p>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Aguarde...' : `Assinar plano ${PLANS[selected].name} — ${formatBRL(PLANS[selected].priceBRL)}/mês`}
      </button>

      <p className="text-center text-xs text-slate-400 mt-4">
        Pagamento via PIX ou cartão. Processado pelo Asaas.
      </p>
    </div>
  );
}
