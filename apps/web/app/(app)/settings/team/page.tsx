'use client';

import { useState, useEffect, useCallback } from 'react';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  practitioner: 'Profissional',
  receptionist: 'Recepcionista',
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team');
      if (res.ok) setMembers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao adicionar'); return; }
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remover este profissional da clínica?')) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      if (res.ok) setMembers(m => m.filter(p => p.id !== id));
      else {
        const d = await res.json();
        alert(d.error ?? 'Erro ao remover');
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Equipe</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Adicionar profissional
          </button>
        )}
      </div>

      {/* Invite form */}
      {showForm && (
        <form onSubmit={handleInvite} className="bg-white rounded-xl border border-slate-200 p-5 mb-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Novo profissional</h2>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha inicial</label>
            <input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowForm(false); setError(''); }}
              className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {saving ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Profissionais da clínica</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                  <p className="text-xs text-slate-500 truncate">{member.email}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
                {member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    disabled={removing === member.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0"
                  >
                    {removing === member.id ? '...' : 'Remover'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4 text-center">
        O profissional usa o e-mail e senha para fazer login na plataforma.
      </p>
    </div>
  );
}
