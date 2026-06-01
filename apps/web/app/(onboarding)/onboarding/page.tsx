'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Specialty } from '@hh/core';
import { SPECIALTY_LABELS } from '@hh/core';

const STEPS = ['Especialidade', 'Valor padrão', 'Pagamento'] as const;

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [specialty, setSpecialty] = useState<Specialty | ''>('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const [priceValue, setPriceValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function finish(skipPayment = false) {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, defaultPrice: priceValue }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Erro ao salvar');
        return;
      }
      router.push(skipPayment ? '/schedule' : '/settings?setup=1');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-8">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              i < step ? 'bg-sky-600 text-white' :
              i === step ? 'bg-sky-600 text-white' :
              'bg-slate-200 text-slate-500'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-sky-700' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-sky-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">

        {/* Step 1 — Specialty */}
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Qual é sua especialidade?</h2>
            <p className="text-sm text-slate-500 mb-5">Isso personaliza sua experiência no Home Health.</p>

            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(SPECIALTY_LABELS) as [Specialty, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpecialty(value)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors ${
                    specialty === value
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={!specialty}
              className="mt-6 w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              Continuar
            </button>
          </>
        )}

        {/* Step 2 — Default price */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Qual o valor da sua consulta?</h2>
            <p className="text-sm text-slate-500 mb-5">Será sugerido automaticamente ao registrar cobranças. Pode alterar depois.</p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor padrão (R$)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={priceDisplay}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  const cents = parseInt(digits || '0', 10);
                  const brl = cents / 100;
                  setPriceDisplay(cents === 0 ? '' : formatBRL(brl));
                  setPriceValue(brl);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {priceValue > 0 ? 'Continuar' : 'Pular'}
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Payment */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Configurar pagamentos</h2>
            <p className="text-sm text-slate-500 mb-5">
              Conecte o Asaas ou Mercado Pago para gerar cobranças PIX para seus pacientes. Pode configurar depois em <span className="font-medium">Configurações</span>.
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => finish(true)}
                disabled={saving}
                className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Pular por agora
              </button>
              <button
                onClick={() => finish(false)}
                disabled={saving}
                className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? 'Salvando...' : 'Configurar pagamento'}
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        Você pode alterar tudo isso depois em Configurações.
      </p>
    </div>
  );
}
