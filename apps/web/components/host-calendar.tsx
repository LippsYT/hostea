'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DayPicker, DateRange, type DayButtonProps } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { addDays, format } from 'date-fns';

type ListingOption = { id: string; title: string };

type Block = { id: string; startDate: string; endDate: string; reason?: string | null };

type Reservation = { id: string; checkIn: string; checkOut: string; status: string };

export const HostCalendar = ({ listings }: { listings: ListingOption[] }) => {
  const [csrf, setCsrf] = useState('');
  const [listingId, setListingId] = useState(listings[0]?.id || '');
  const [range, setRange] = useState<DateRange | undefined>();
  const [mode, setMode] = useState<'BLOCK' | 'MAINTENANCE' | 'PRICE'>('BLOCK');
  const [reason, setReason] = useState('Bloqueo manual');
  const [priceOverride, setPriceOverride] = useState(0);
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
    if (!range?.from) return;
    const start = range.from;
    const end = range.to ?? range.from;
    if (mode === 'PRICE' && (!priceOverride || priceOverride <= 0)) return;
    await fetch('/api/host/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({
        listingId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        reason: mode === 'PRICE' ? undefined : reason,
        price: mode === 'PRICE' ? priceOverride : undefined
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

  const priceBlocks = blocks.filter((b) => (b.reason || '').startsWith('PRICE:'));
  const blockOnly = blocks.filter((b) => !priceBlocks.includes(b));
  const disabledRanges = [
    ...blockOnly.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
    ...reservations.map((r) => ({ from: new Date(r.checkIn), to: new Date(r.checkOut) }))
  ];

  const maintenanceBlocks = blockOnly.filter((b) => (b.reason || '').toLowerCase().includes('mantenimiento'));
  const manualBlocks = blockOnly.filter((b) => !maintenanceBlocks.includes(b));
  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    priceBlocks.forEach((b) => {
      const price = Number((b.reason || '').replace('PRICE:', ''));
      if (!Number.isFinite(price)) return;
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      for (let d = start; d <= end; d = addDays(d, 1)) {
        map.set(format(d, 'yyyy-MM-dd'), price);
      }
    });
    return map;
  }, [priceBlocks]);

  return (
    <div className="space-y-4">
      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Calendario real</h2>
            <p className="text-sm text-slate-500">
              Selecciona un rango (o un día) para bloquear o cambiar el precio.
            </p>
          </div>
          <Button size="sm" onClick={createBlock} disabled={!range?.from}>
            {mode === 'PRICE' ? 'Aplicar precio' : 'Bloquear fechas'}
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
              value={mode}
              onChange={(e) => {
                const next = e.target.value as 'BLOCK' | 'MAINTENANCE' | 'PRICE';
                setMode(next);
                if (next === 'MAINTENANCE') setReason('Mantenimiento');
                if (next === 'BLOCK') setReason('Bloqueo manual');
              }}
            >
              <option value="BLOCK">Bloqueo manual</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="PRICE">Precio personalizado</option>
            </select>
            {mode === 'PRICE' ? (
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Precio USD"
                  value={priceOverride || ''}
                  onChange={(e) => setPriceOverride(Number(e.target.value))}
                />
                <p className="text-xs text-slate-500">Tip: selecciona un solo día para cambiar ese precio.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-500">
                Reservas confirmadas y bloqueos se muestran deshabilitados.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              disabled={disabledRanges}
              components={{
                DayButton: (props: DayButtonProps) => {
                  const key = format(props.day.date, 'yyyy-MM-dd');
                  const price = priceMap.get(key);
                  const { children, ...buttonProps } = props;
                  return (
                    <button {...buttonProps}>
                      <div className="rdp-day-content">
                        <span className="rdp-day-number">{children}</span>
                        {price !== undefined && (
                          <span className="rdp-day-price">USD {price}</span>
                        )}
                      </div>
                    </button>
                  );
                }
              }}
              modifiers={{
                blocked: manualBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
                maintenance: maintenanceBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
                reserved: reservations.map((r) => ({ from: new Date(r.checkIn), to: new Date(r.checkOut) })),
                price: priceBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) }))
              }}
              modifiersClassNames={{
                blocked: 'rdp-day_blocked',
                maintenance: 'rdp-day_maintenance',
                reserved: 'rdp-day_reserved',
                price: 'rdp-day_price'
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
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" /> Precio personalizado
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Bloqueos existentes</h2>
        <div className="mt-5 space-y-2 text-sm">
          {blockOnly.map((b) => (
            <div key={b.id} className="surface-muted flex items-center justify-between gap-3">
              <span>{b.startDate.slice(0, 10)} - {b.endDate.slice(0, 10)} - {b.reason || 'Bloqueo'}</span>
              <button className="text-red-600" onClick={() => removeBlock(b.id)}>Eliminar</button>
            </div>
          ))}
          {blockOnly.length === 0 && <p className="text-sm text-slate-500">Sin bloqueos.</p>}
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Precios personalizados</h2>
        <div className="mt-5 space-y-2 text-sm">
          {priceBlocks.map((b) => (
            <div key={b.id} className="surface-muted flex items-center justify-between gap-3">
              <span>
                {b.startDate.slice(0, 10)} - {b.endDate.slice(0, 10)} - USD {(b.reason || '').replace('PRICE:', '')}
              </span>
              <button className="text-red-600" onClick={() => removeBlock(b.id)}>Eliminar</button>
            </div>
          ))}
          {priceBlocks.length === 0 && <p className="text-sm text-slate-500">Sin precios personalizados.</p>}
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
