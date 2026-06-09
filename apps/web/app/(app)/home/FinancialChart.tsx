'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Period = '3m' | '6m' | '12m';

const PERIOD_MONTHS: Record<Period, number> = { '3m': 3, '6m': 6, '12m': 12 };

interface MonthData {
  label: string;
  revenue: number;
  pending: number;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm text-xs">
      <p className="font-semibold text-slate-700 mb-1 capitalize">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} style={{ color: entry.fill }}>
          {entry.name === 'revenue' ? 'Recebido' : 'Pendente'}: {formatBRL(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function FinancialChart() {
  const [period, setPeriod] = useState<Period>('6m');
  const [data, setData] = useState<MonthData[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/revenue-chart?months=${PERIOD_MONTHS[period]}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d.months); })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Receita</h2>
        <div className="flex gap-1">
          {(['3m', '6m', '12m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-44 bg-slate-100 animate-pulse rounded-lg" />
      ) : !data?.length ? (
        <div className="h-44 flex items-center justify-center text-slate-400 text-sm">
          Nenhuma cobrança neste período.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} barGap={2} barCategoryGap="35%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="pending" fill="#fbbf24" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-600 inline-block" />
              Recebido
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
              Pendente
            </span>
          </div>
        </>
      )}
    </div>
  );
}
