'use client';

import { useState, useEffect } from 'react';
import type { HHAppointment, HHPatient, PaymentStatus } from '@hh/core';

interface TeamMember { id: string; name: string; }

interface Props {
  initial?: { date: string; time: string };
  appointment?: HHAppointment;
  practitioners?: TeamMember[];
  defaultPractitionerId?: string;
  onClose: () => void;
  onSaved: (appt: HHAppointment) => void;
}

const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
];

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
};

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function AppointmentModal({ initial, appointment, practitioners = [], defaultPractitionerId, onClose, onSaved }: Props) {
  const isEdit = !!appointment;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<HHPatient[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPractitionerId, setSelectedPractitionerId] = useState(
    defaultPractitionerId ?? (practitioners[0]?.id ?? '')
  );
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixResult, setPixResult] = useState<{ pixCopiaECola: string; invoiceUrl: string } | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState(
    appointment?.price ? formatBRL(appointment.price) : ''
  );

  const initDate = appointment
    ? appointment.start.slice(0, 10)
    : (initial?.date ?? new Date().toISOString().slice(0, 10));
  const initTime = appointment
    ? appointment.start.slice(11, 16)
    : (initial?.time ?? '09:00');

  const [form, setForm] = useState({
    patientId: appointment?.patientId ?? '',
    patientName: appointment?.patientName ?? '',
    date: initDate,
    time: initTime,
    durationMinutes: 60,
    notes: appointment?.notes ?? '',
    isHomeVisit: appointment?.isHomeVisit ?? false,
    homeVisitAddress: appointment?.homeVisitAddress ?? '',
    price: appointment?.price ?? '',
    paymentStatus: appointment?.paymentStatus ?? 'pending' as PaymentStatus,
  });

  function set(field: string, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  useEffect(() => {
    if (!isEdit) return;
    fetch('/api/settings/payment')
      .then(r => r.json())
      .then(d => setProviderConfigured(d.configured === true))
      .catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const t = setTimeout(async () => {
      if (patientQuery.length < 2) { setPatients([]); return; }
      const practParam = selectedPractitionerId ? `&practitionerId=${selectedPractitionerId}` : '';
      const res = await fetch(`/api/patients?q=${encodeURIComponent(patientQuery)}${practParam}`);
      if (res.ok) setPatients(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [patientQuery, isEdit, selectedPractitionerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const start = `${form.date}T${form.time}:00`;
      const endDate = new Date(start);
      endDate.setMinutes(endDate.getMinutes() + form.durationMinutes);
      const end = endDate.toISOString().slice(0, 19);

      const url = isEdit ? `/api/appointments/${appointment!.id}` : '/api/appointments';
      const method = isEdit ? 'PATCH' : 'POST';

      const selectedPract = practitioners.find(p => p.id === selectedPractitionerId);
      const body: Record<string, unknown> = {
        patientId: form.patientId,
        patientName: form.patientName,
        start,
        end,
        notes: form.notes,
        isHomeVisit: form.isHomeVisit,
        homeVisitAddress: form.homeVisitAddress,
        ...(selectedPractitionerId && { practitionerId: selectedPractitionerId }),
        ...(selectedPract && { practitionerName: selectedPract.name }),
      };

      if (isEdit) {
        const priceNum = form.price !== '' ? parseFloat(String(form.price)) : undefined;
        if (priceNum !== undefined && !isNaN(priceNum)) body.price = priceNum;
        body.paymentStatus = form.paymentStatus;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar'); return; }
      onSaved(data);
      onClose();
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  async function sendWhatsAppReminder() {
    if (!appointment) return;
    setWhatsappLoading(true);
    try {
      const res = await fetch(`/api/patients/${appointment.patientId}`);
      if (!res.ok) return;
      const patient: HHPatient = await res.json();
      const phone = patient.phone.replace(/\D/g, '');
      if (!phone) return;
      const apptDate = new Date(appointment.start);
      const dateStr = apptDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const timeStr = apptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const msg = `Olá ${appointment.patientName}! Passando para lembrar da sua consulta dia ${dateStr} às ${timeStr}. Por favor, responda SIM para confirmar sua presença ou NÃO caso precise cancelar. Até logo!`;
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      setWhatsappLoading(false);
    }
  }

  async function generatePix() {
    if (!appointment) return;
    setPixLoading(true);
    setError('');
    try {
      const priceNum = parseFloat(String(form.price));
      if (isNaN(priceNum) || priceNum <= 0) {
        setError('Informe o valor da consulta antes de gerar o PIX');
        return;
      }
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const res = await fetch('/api/billing/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          amount: priceNum,
          description: `Consulta — ${appointment.patientName}`,
          dueDate: dueDate.toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao gerar PIX'); return; }
      setPixResult({ pixCopiaECola: data.pixCopiaECola, invoiceUrl: data.invoiceUrl });
    } finally {
      setPixLoading(false);
    }
  }

  async function handleCancel() {
    if (!appointment) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao cancelar'); return; }
      onSaved(data);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Consulta' : 'Nova consulta'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient */}
          {!isEdit ? (
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Paciente <span className="text-red-500">*</span>
              </label>
              {form.patientId ? (
                <div className="flex items-center justify-between rounded-lg border border-sky-400 bg-sky-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-900">{form.patientName}</span>
                  <button type="button" onClick={() => { set('patientId', ''); set('patientName', ''); }}
                    className="text-slate-400 hover:text-slate-600 text-sm">trocar</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {patients.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { set('patientId', p.id); set('patientName', p.name); setPatientQuery(''); setPatients([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex flex-col">
                          <span className="font-medium text-slate-900">{p.name}</span>
                          <span className="text-xs text-slate-500">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500">Paciente</p>
              <p className="text-sm font-medium text-slate-900">{appointment.patientName}</p>
            </div>
          )}

          {/* Practitioner selector (new appointment + owner with team) */}
          {!isEdit && practitioners.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profissional</label>
              <select
                value={selectedPractitionerId}
                onChange={e => { setSelectedPractitionerId(e.target.value); set('patientId', ''); set('patientName', ''); setPatientQuery(''); setPatients([]); }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              >
                {practitioners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Horário <span className="text-red-500">*</span></label>
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>

          {/* Duration */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duração</label>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map(d => (
                  <button key={d.minutes} type="button"
                    onClick={() => set('durationMinutes', d.minutes)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      form.durationMinutes === d.minutes
                        ? 'bg-sky-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Home visit */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isHomeVisit}
              onChange={e => set('isHomeVisit', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-600" />
            <span className="text-sm text-slate-700">Visita domiciliar</span>
          </label>

          {form.isHomeVisit && (
            <input type="text" value={form.homeVisitAddress}
              onChange={e => set('homeVisitAddress', e.target.value)}
              placeholder="Endereço da visita"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
          </div>

          {/* Billing section (edit only) */}
          {isEdit && appointment.status !== 'cancelled' && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cobrança</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
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
                      set('price', cents === 0 ? '' : brl);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.paymentStatus}
                    onChange={e => set('paymentStatus', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                  >
                    {(Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PIX button */}
              {providerConfigured && form.price && parseFloat(String(form.price)) > 0 && form.paymentStatus === 'pending' && (
                <button
                  type="button"
                  onClick={generatePix}
                  disabled={pixLoading}
                  className="w-full flex items-center justify-center gap-2 border border-sky-500 text-sky-700 hover:bg-sky-50 disabled:opacity-60 text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {pixLoading ? 'Gerando PIX...' : `Gerar PIX ${form.price ? formatBRL(parseFloat(String(form.price))) : ''}`}
                </button>
              )}

              {/* PIX result */}
              {pixResult && (
                <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-sky-700">PIX gerado!</p>
                  {pixResult.pixCopiaECola && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Copia e cola:</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={pixResult.pixCopiaECola}
                          className="flex-1 text-xs bg-white border border-slate-200 rounded px-2 py-1 truncate"
                        />
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(pixResult.pixCopiaECola)}
                          className="text-xs text-sky-600 font-medium px-2 hover:underline shrink-0"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                  {pixResult.invoiceUrl && (
                    <a
                      href={pixResult.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-sky-600 hover:underline"
                    >
                      Ver boleto/fatura →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WhatsApp reminder */}
          {isEdit && appointment.status !== 'cancelled' && (
            <button
              type="button"
              onClick={sendWhatsAppReminder}
              disabled={whatsappLoading}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {whatsappLoading ? 'Abrindo...' : 'Lembrete WhatsApp'}
            </button>
          )}

          <div className="flex gap-3 pt-1">
            {isEdit && appointment.status !== 'cancelled' && (
              <button type="button" onClick={handleCancel} disabled={loading}
                className="flex-1 border border-red-300 text-red-600 text-sm font-medium py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60">
                Cancelar consulta
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              Fechar
            </button>
            {appointment?.status !== 'cancelled' && (
              <button type="submit" disabled={loading || (!isEdit && !form.patientId)}
                className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Agendar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
