'use client';

import { useState, useEffect } from 'react';

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

const BAR_AREA = 120;

export function FinancialChart() {
  const [period, setPeriod] = useState<Period>('6m');
  const [data, setData] = useState<MonthData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<MonthData | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/revenue-chart?months=${PERIOD_MONTHS[period]}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d.months); })
      .finally(() => setLoading(false));
  }, [period]);

  const maxVal = data ? Math.max(...data.flatMap(d => [d.revenue, d.pending]), 1) : 1;

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
        <div className="relative" onMouseLeave={() => setTooltip(null)}>
          {tooltip && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs pointer-events-none whitespace-nowrap">
              <p className="font-semibold text-slate-700 mb-0.5 capitalize">{tooltip.label}</p>
              {tooltip.revenue > 0 && (
                <p className="text-green-700">Recebido: {formatBRL(tooltip.revenue)}</p>
              )}
              {tooltip.pending > 0 && (
                <p className="text-amber-600">Pendente: {formatBRL(tooltip.pending)}</p>
              )}
              {tooltip.revenue === 0 && tooltip.pending === 0 && (
                <p className="text-slate-400">Sem cobranças</p>
              )}
            </div>
          )}

          <div
            className="flex items-end justify-around"
            style={{ height: BAR_AREA + 28 }}
          >
            {data.map(d => {
              const revH = d.revenue > 0 ? Math.max(Math.round((d.revenue / maxVal) * BAR_AREA), 4) : 0;
              const penH = d.pending > 0 ? Math.max(Math.round((d.pending / maxVal) * BAR_AREA), 4) : 0;
              return (
                <div
                  key={d.label}
                  className="flex flex-col items-center flex-1 cursor-default group"
                  onMouseEnter={() => setTooltip(d)}
                >
                  <div className="flex items-end gap-0.5" style={{ height: BAR_AREA }}>
                    <div
                      className="w-2.5 bg-green-600 rounded-t-sm group-hover:bg-green-500 transition-colors"
                      style={{ height: revH || 0 }}
                    />
                    <div
                      className="w-2.5 bg-amber-400 rounded-t-sm group-hover:bg-amber-300 transition-colors"
                      style={{ height: penH || 0 }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 capitalize select-none">{d.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-3 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-600 inline-block shrink-0" />
              Recebido
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block shrink-0" />
              Pendente
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
