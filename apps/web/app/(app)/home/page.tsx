'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatTime } from '@hh/core';

interface TodayAppointment {
  id: string;
  patientName: string;
  start: string;
  status: string;
  isHomeVisit?: boolean;
}

interface DashboardData {
  today: { total: number; completed: number; remaining: number };
  pending: number;
  patientCount: number;
  todayAppointments: TodayAppointment[];
  nextAppointment: { id: string; patientName: string; start: string; isHomeVisit?: boolean } | null;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:  'bg-sky-100 text-sky-700',
  confirmed:  'bg-green-100 text-green-700',
  completed:  'bg-slate-100 text-slate-500',
  cancelled:  'bg-red-50 text-red-400',
  'no-show':  'bg-orange-100 text-orange-700',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  'no-show': 'Não compareceu',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'agora';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `em ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `em ${hrs}h${rem}min` : `em ${hrs}h`;
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  const todayLabel = formatDay(new Date().toISOString());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 capitalize">{todayLabel}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Consultas hoje</p>
          <p className="text-2xl font-bold text-slate-900">{loading ? '…' : data?.today.total ?? 0}</p>
          {!loading && data && data.today.total > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              {data.today.completed} realizada{data.today.completed !== 1 ? 's' : ''} · {data.today.remaining} restante{data.today.remaining !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">A receber</p>
          <p className="text-2xl font-bold text-yellow-600">{loading ? '…' : formatBRL(data?.pending ?? 0)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 mb-1">Pacientes</p>
          <p className="text-2xl font-bold text-slate-900">{loading ? '…' : data?.patientCount ?? 0}</p>
        </div>
      </div>

      {/* Next appointment highlight */}
      {!loading && data?.nextAppointment && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center text-lg shrink-0">
            🗓
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-sky-600 font-medium mb-0.5">Próxima consulta</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{data.nextAppointment.patientName}</p>
            <p className="text-xs text-slate-500">
              {formatTime(data.nextAppointment.start)} · {timeUntil(data.nextAppointment.start)}
              {data.nextAppointment.isHomeVisit ? ' · 🏠 domiciliar' : ''}
            </p>
          </div>
          <Link href="/schedule" className="text-xs text-sky-600 font-medium hover:underline shrink-0">
            Ver agenda →
          </Link>
        </div>
      )}

      {/* Today's appointments */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Consultas de hoje</h2>
          <Link href="/schedule" className="text-xs text-sky-600 hover:underline">Ver agenda</Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Carregando…</div>
        ) : !data?.todayAppointments.length ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">Nenhuma consulta hoje.</p>
            <Link href="/schedule" className="text-xs text-sky-600 hover:underline mt-2 inline-block">
              + Agendar consulta
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.todayAppointments.map(appt => (
              <div key={appt.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-sm font-medium text-slate-500 w-12 shrink-0">
                  {formatTime(appt.start)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{appt.patientName}</p>
                  {appt.isHomeVisit && <p className="text-xs text-slate-400">🏠 domiciliar</p>}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled}`}>
                  {STATUS_LABELS[appt.status] ?? appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/schedule" className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-3 rounded-xl text-center transition-colors">
          + Nova consulta
        </Link>
        <Link href="/patients/new" className="border border-slate-300 text-slate-700 text-sm font-medium py-3 rounded-xl text-center hover:bg-slate-50 transition-colors">
          + Novo paciente
        </Link>
      </div>
    </div>
  );
}
