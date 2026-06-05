'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProviderType } from '@hh/billing';

const PROVIDERS: { value: ProviderType; label: string; hint: string }[] = [
  {
    value: 'asaas',
    label: 'Asaas',
    hint: 'Painel Asaas → Configurações → Integrações → Chave API',
  },
  {
    value: 'mercadopago',
    label: 'Mercado Pago',
    hint: 'Painel MP → Seu negócio → Credenciais → Access Token de produção',
  },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const isSetup = searchParams.get('setup') === '1';
  const [type, setType] = useState<ProviderType>('asaas');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings/payment')
      .then(r => r.json())
      .then(data => {
        if (data.type) setType(data.type);
        setConfigured(data.configured);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) { setError('Informe a chave API'); return; }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/settings/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return; }
      setConfigured(true);
      setApiKey('');
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  const currentProvider = PROVIDERS.find(p => p.value === type)!;

  return (
    <div className="max-w-xl">
      {isSetup && (
        <div className="mb-6 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-700">
          Quase lá! Configure seu provedor de pagamento para gerar cobranças PIX para os pacientes.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Provedor de pagamento</h2>
          {configured && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Configurado
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-5">
          Escolha o provedor com as melhores taxas para você. A chave fica salva na sua conta e é usada para gerar cobranças PIX para os pacientes.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Provider selector */}
          <div className="grid grid-cols-2 gap-3">
            {PROVIDERS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setType(p.value)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  type === p.value
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold">{p.label}</p>
              </button>
            ))}
          </div>

          {/* API key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Chave API — {currentProvider.label}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={configured ? '••••••••  (deixe em branco para manter a atual)' : 'Cole sua chave aqui'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm pr-16 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">{currentProvider.hint}</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              Provedor salvo com sucesso!
            </p>
          )}

          <button
            type="submit"
            disabled={saving || (!apiKey.trim() && !configured)}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : configured ? 'Atualizar provedor' : 'Salvar provedor'}
          </button>
        </form>
      </div>
    </div>
  );
}
