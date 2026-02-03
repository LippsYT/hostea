'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

type ListingOption = { id: string; title: string };

type Block = { id: string; startDate: string; endDate: string; reason?: string | null };

type Reservation = { id: string; checkIn: string; checkOut: string; status: string };

export const HostCalendar = ({ listings }: { listings: ListingOption[] }) => {
  const [csrf, setCsrf] = useState('');
  const [listingId, setListingId] = useState(listings[0]?.id || '');
  const [range, setRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('Bloqueo manual');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const loadBlocks = async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/host/calendar?listingId=${id}`);
    const data = await res.json();
    setBlocks(data.blocks || []);
    setReservations(data.reservations || []);
  };

  useEffect(() => {
    loadBlocks(listingId);
  }, [listingId]);

  const createBlock = async () => {
    if (!range?.from || !range?.to) return;
    await fetch('/api/host/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({
        listingId,
        startDate: range.from.toISOString(),
        endDate: range.to.toISOString(),
        reason
      })
    });
    setRange(undefined);
    loadBlocks(listingId);
  };

  const removeBlock = async (id: string) => {
    await fetch(`/api/host/calendar/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf }
    });
    loadBlocks(listingId);
  };

  const disabledRanges = [
    ...blocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
    ...reservations.map((r) => ({ from: new Date(r.checkIn), to: new Date(r.checkOut) }))
  ];

  const maintenanceBlocks = blocks.filter((b) => (b.reason || '').toLowerCase().includes('mantenimiento'));
  const manualBlocks = blocks.filter((b) => !maintenanceBlocks.includes(b));

  return (
    <div className="space-y-4">
      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Calendario real</h2>
            <p className="text-sm text-slate-500">Selecciona un rango para bloquear fechas.</p>
          </div>
          <Button size="sm" onClick={createBlock} disabled={!range?.from || !range?.to}>
            Bloquear fechas
          </Button>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <select
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
            <select
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="Bloqueo manual">Bloqueo manual</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-500">
              Reservas confirmadas y bloqueos se muestran deshabilitados.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              disabled={disabledRanges}
              modifiers={{
                blocked: manualBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
                maintenance: maintenanceBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
                reserved: reservations.map((r) => ({ from: new Date(r.checkIn), to: new Date(r.checkOut) }))
              }}
              modifiersClassNames={{
                blocked: 'rdp-day_blocked',
                maintenance: 'rdp-day_maintenance',
                reserved: 'rdp-day_reserved'
              }}
            />
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500" /> Bloqueado
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-400" /> Mantenimiento
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" /> Reservado
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Bloqueos existentes</h2>
        <div className="mt-5 space-y-2 text-sm">
          {blocks.map((b) => (
            <div key={b.id} className="surface-muted flex items-center justify-between gap-3">
              <span>{b.startDate.slice(0, 10)} - {b.endDate.slice(0, 10)} - {b.reason || 'Bloqueo'}</span>
              <button className="text-red-600" onClick={() => removeBlock(b.id)}>Eliminar</button>
            </div>
          ))}
          {blocks.length === 0 && <p className="text-sm text-slate-500">Sin bloqueos.</p>}
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Reservas confirmadas</h2>
        <div className="mt-5 space-y-2 text-sm">
          {reservations.map((r) => (
            <div key={r.id} className="surface-muted">
              {r.checkIn.slice(0, 10)} - {r.checkOut.slice(0, 10)} - {r.status}
            </div>
          ))}
          {reservations.length === 0 && <p className="text-sm text-slate-500">Sin reservas confirmadas.</p>}
        </div>
      </div>
    </div>
  );
};
