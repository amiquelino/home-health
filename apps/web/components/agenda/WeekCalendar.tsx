'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import type { HHAppointment } from '@hh/core';
import { formatTime } from '@hh/core';
import { AppointmentModal } from './AppointmentModal';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-sky-100 border-sky-400 text-sky-900',
  confirmed: 'bg-green-100 border-green-400 text-green-900',
  completed: 'bg-slate-100 border-slate-400 text-slate-600',
  cancelled: 'bg-red-50 border-red-300 text-red-400 line-through',
  'no-show': 'bg-orange-50 border-orange-300 text-orange-700',
};

const PRACT_PALETTES = [
  { bg: 'bg-sky-100', border: 'border-sky-400', text: 'text-sky-900', dot: 'bg-sky-500' },
  { bg: 'bg-violet-100', border: 'border-violet-400', text: 'text-violet-900', dot: 'bg-violet-500' },
  { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-900', dot: 'bg-emerald-500' },
  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-900', dot: 'bg-orange-500' },
  { bg: 'bg-pink-100', border: 'border-pink-400', text: 'text-pink-900', dot: 'bg-pink-500' },
  { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-900', dot: 'bg-amber-500' },
];

interface TeamMember { id: string; name: string; role: string; }

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDateParam(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function WeekCalendar({ isOwner = false }: { isOwner?: boolean }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<HHAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<'color' | 'columns'>('color');
  const [modal, setModal] = useState<
    | { type: 'create'; date: string; time: string }
    | { type: 'edit'; appointment: HHAppointment }
    | null
  >(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Load team once for owners
  useEffect(() => {
    if (!isOwner) { setTeamLoaded(true); return; }
    fetch('/api/team')
      .then(r => r.ok ? r.json() : [])
      .then((members: TeamMember[]) => {
        setTeam(members);
        setTeamLoaded(true);
      })
      .catch(() => setTeamLoaded(true));
  }, [isOwner]);

  // hasTeam = owner with at least 1 non-owner team member
  const hasTeam = isOwner && team.some(m => m.role !== 'owner');

  const load = useCallback(async () => {
    if (!teamLoaded) return;
    setLoading(true);
    try {
      const from = fmtDateParam(weekStart);
      const to = fmtDateParam(addDays(weekStart, 6));
      let url = `/api/appointments?from=${from}&to=${to}`;
      if (hasTeam) {
        if (selectedPractitioner === 'all') {
          url += '&practitioners=all';
        } else {
          url += `&practitioners=${selectedPractitioner}`;
        }
      }
      const res = await fetch(url);
      if (res.ok) setAppointments(await res.json());
    } finally {
      setLoading(false);
    }
  }, [weekStart, teamLoaded, hasTeam, selectedPractitioner]);

  useEffect(() => { load(); }, [load]);

  // Map practitionerId → palette index
  const practColorMap = new Map<string, number>();
  team.forEach((m, i) => practColorMap.set(m.id, i % PRACT_PALETTES.length));

  function getPalette(practitionerId: string) {
    const idx = practColorMap.get(practitionerId) ?? 0;
    return PRACT_PALETTES[idx];
  }

  function apptCardClass(a: HHAppointment) {
    if (!hasTeam || selectedPractitioner !== 'all') {
      return STATUS_COLOR[a.status] ?? STATUS_COLOR.scheduled;
    }
    const p = getPalette(a.practitionerId);
    if (a.status === 'cancelled') return 'bg-red-50 border-red-300 text-red-400 line-through';
    return `${p.bg} ${p.border} ${p.text}`;
  }

  function apptsByDayHour(dayIndex: number, hour: number, practId?: string) {
    const day = weekDays[dayIndex];
    return appointments.filter(a => {
      const s = new Date(a.start);
      return (
        s.getFullYear() === day.getFullYear() &&
        s.getMonth() === day.getMonth() &&
        s.getDate() === day.getDate() &&
        s.getHours() === hour &&
        (practId === undefined || a.practitionerId === practId)
      );
    });
  }

  function isToday(day: Date) {
    const t = new Date();
    return day.getDate() === t.getDate() &&
      day.getMonth() === t.getMonth() &&
      day.getFullYear() === t.getFullYear();
  }

  function handleSaved(appt: HHAppointment) {
    setAppointments(prev => {
      const exists = prev.find(a => a.id === appt.id);
      if (exists) return prev.map(a => a.id === appt.id ? appt : a);
      return [...prev, appt];
    });
  }

  const today = new Date();
  const isCurrentWeek = fmtDateParam(weekStart) === fmtDateParam(startOfWeek(today));

  // Practitioners shown in column mode
  const columnPractitioners = hasTeam && viewMode === 'columns'
    ? (selectedPractitioner === 'all' ? team : team.filter(m => m.id === selectedPractitioner))
    : [];

  // Default practitioner for new appointment modal
  const defaultPractitionerId = selectedPractitioner !== 'all' ? selectedPractitioner : undefined;

  // Practitioners list for modal (non-owner members + owner)
  const modalPractitioners = hasTeam ? team : [];

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setWeekStart(w => addDays(w, -7))}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 text-sm font-medium">‹</button>

        <span className="text-sm font-medium text-slate-700 min-w-48 text-center">
          {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} –{' '}
          {addDays(weekStart, 6).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>

        <button onClick={() => setWeekStart(w => addDays(w, 7))}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 text-sm font-medium">›</button>

        {!isCurrentWeek && (
          <button onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="ml-1 text-xs text-sky-600 hover:underline">Hoje</button>
        )}

        {hasTeam && (
          <button
            onClick={() => setViewMode(v => v === 'color' ? 'columns' : 'color')}
            title={viewMode === 'color' ? 'Modo colunas' : 'Modo cores'}
            className="ml-auto text-xs border border-slate-300 text-slate-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            {viewMode === 'color' ? '⊞ Colunas' : '≡ Cores'}
          </button>
        )}

        {loading && <span className={`text-xs text-slate-400 ${hasTeam ? '' : 'ml-auto'}`}>Carregando...</span>}
      </div>

      {/* Practitioner filter pills */}
      {hasTeam && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setSelectedPractitioner('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedPractitioner === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {team.map((m, i) => {
            const p = PRACT_PALETTES[i % PRACT_PALETTES.length];
            const isSelected = selectedPractitioner === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedPractitioner(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isSelected ? `${p.bg} ${p.text} ring-1 ${p.border}` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop grid */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {viewMode === 'color' || !hasTeam ? (
          // COLOR MODE
          <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-b border-slate-200" />
            {weekDays.map((day, i) => (
              <div key={i} className={`border-b border-l border-slate-200 py-2 text-center ${isToday(day) ? 'bg-sky-50' : ''}`}>
                <p className="text-xs text-slate-500">{DAYS[day.getDay()]}</p>
                <p className={`text-sm font-semibold ${isToday(day) ? 'text-sky-600' : 'text-slate-900'}`}>{day.getDate()}</p>
              </div>
            ))}
            {HOURS.map(hour => (
              <Fragment key={hour}>
                <div className="border-b border-slate-100 py-1 pr-2 text-right">
                  <span className="text-xs text-slate-400">{hour}:00</span>
                </div>
                {weekDays.map((day, dayIdx) => {
                  const appts = apptsByDayHour(dayIdx, hour);
                  const dateStr = fmtDateParam(day);
                  const timeStr = `${String(hour).padStart(2, '0')}:00`;
                  return (
                    <div key={`${dayIdx}-${hour}`}
                      onClick={() => setModal({ type: 'create', date: dateStr, time: timeStr })}
                      className={`border-b border-l border-slate-100 min-h-12 p-0.5 cursor-pointer group relative ${isToday(day) ? 'bg-sky-50/50' : 'hover:bg-slate-50'}`}>
                      {appts.map(a => (
                        <button key={a.id}
                          onClick={e => { e.stopPropagation(); setModal({ type: 'edit', appointment: a }); }}
                          className={`w-full text-left text-xs px-1.5 py-1 rounded border-l-2 mb-0.5 truncate ${apptCardClass(a)}`}>
                          <span className="font-medium">{formatTime(a.start)}</span>
                          {' '}{a.patientName}
                          {hasTeam && selectedPractitioner === 'all' && (
                            <span className="block opacity-70 truncate">{a.practitionerName}</span>
                          )}
                        </button>
                      ))}
                      {appts.length === 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs opacity-0 group-hover:opacity-100">+</span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ) : (
          // COLUMNS MODE
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(${7 * columnPractitioners.length}, 1fr)` }}>
            {/* Corner */}
            <div className="border-b border-slate-200 row-span-2" />
            {/* Day headers */}
            {weekDays.map((day, i) => (
              <div key={i}
                style={{ gridColumn: `span ${columnPractitioners.length}` }}
                className={`border-b border-l border-slate-200 py-2 text-center ${isToday(day) ? 'bg-sky-50' : ''}`}>
                <p className="text-xs text-slate-500">{DAYS[day.getDay()]}</p>
                <p className={`text-sm font-semibold ${isToday(day) ? 'text-sky-600' : 'text-slate-900'}`}>{day.getDate()}</p>
              </div>
            ))}
            {/* Practitioner sub-headers */}
            {weekDays.map((day, dayIdx) =>
              columnPractitioners.map((m, pi) => {
                const p = PRACT_PALETTES[team.findIndex(t => t.id === m.id) % PRACT_PALETTES.length];
                return (
                  <div key={`${dayIdx}-${pi}`}
                    className={`border-b border-l border-slate-100 py-1 text-center ${isToday(day) ? 'bg-sky-50/50' : ''}`}>
                    <span className={`text-xs font-medium ${p.text} truncate px-1`}>{m.name.split(' ')[0]}</span>
                  </div>
                );
              })
            )}
            {/* Time rows */}
            {HOURS.map(hour => (
              <Fragment key={hour}>
                <div className="border-b border-slate-100 py-1 pr-2 text-right">
                  <span className="text-xs text-slate-400">{hour}:00</span>
                </div>
                {weekDays.map((day, dayIdx) =>
                  columnPractitioners.map((m, pi) => {
                    const appts = apptsByDayHour(dayIdx, hour, m.id);
                    const dateStr = fmtDateParam(day);
                    const timeStr = `${String(hour).padStart(2, '0')}:00`;
                    const p = PRACT_PALETTES[team.findIndex(t => t.id === m.id) % PRACT_PALETTES.length];
                    return (
                      <div key={`${dayIdx}-${pi}-${hour}`}
                        onClick={() => setModal({ type: 'create', date: dateStr, time: timeStr })}
                        className={`border-b border-l border-slate-100 min-h-12 p-0.5 cursor-pointer group relative ${isToday(day) ? 'bg-sky-50/50' : 'hover:bg-slate-50'}`}>
                        {appts.map(a => (
                          <button key={a.id}
                            onClick={e => { e.stopPropagation(); setModal({ type: 'edit', appointment: a }); }}
                            className={`w-full text-left text-xs px-1.5 py-1 rounded border-l-2 mb-0.5 truncate ${p.bg} ${p.border} ${p.text}`}>
                            <span className="font-medium">{formatTime(a.start)}</span> {a.patientName}
                          </button>
                        ))}
                        {appts.length === 0 && (
                          <span className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs opacity-0 group-hover:opacity-100">+</span>
                        )}
                      </div>
                    );
                  })
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: day list */}
      <div className="md:hidden space-y-2">
        {weekDays.map((day, dayIdx) => {
          const dayAppts = appointments
            .filter(a => fmtDateParam(new Date(a.start)) === fmtDateParam(day))
            .sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div key={dayIdx} className={`bg-white rounded-xl border ${isToday(day) ? 'border-sky-300' : 'border-slate-200'}`}>
              <div className={`px-4 py-2 border-b flex items-center justify-between ${isToday(day) ? 'border-sky-200 bg-sky-50' : 'border-slate-100'}`}>
                <span className={`text-sm font-semibold ${isToday(day) ? 'text-sky-700' : 'text-slate-700'}`}>
                  {DAYS[day.getDay()]}, {day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
                <button
                  onClick={() => setModal({ type: 'create', date: fmtDateParam(day), time: '09:00' })}
                  className="text-xs text-sky-600 font-medium">+ Adicionar</button>
              </div>
              {dayAppts.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">Sem consultas</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dayAppts.map(a => {
                    const p = hasTeam ? getPalette(a.practitionerId) : null;
                    return (
                      <button key={a.id} onClick={() => setModal({ type: 'edit', appointment: a })}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            a.status === 'cancelled' ? 'bg-red-400' : p ? p.dot : 'bg-sky-500'
                          }`} />
                          <span className="text-xs text-slate-500 w-10 shrink-0">{formatTime(a.start)}</span>
                          <span className="text-sm font-medium text-slate-900 truncate">{a.patientName}</span>
                          {hasTeam && selectedPractitioner === 'all' && (
                            <span className="text-xs text-slate-400 shrink-0 ml-auto">{a.practitionerName.split(' ')[0]}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {modal?.type === 'create' && (
        <AppointmentModal
          initial={{ date: modal.date, time: modal.time }}
          practitioners={modalPractitioners}
          defaultPractitionerId={defaultPractitionerId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {modal?.type === 'edit' && (
        <AppointmentModal
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
