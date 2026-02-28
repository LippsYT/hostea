'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DayPicker, DateRange, type DayButtonProps } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { addDays, format } from 'date-fns';

type ListingOption = { id: string; title: string };

type Block = { id: string; startDate: string; endDate: string; reason?: string | null; createdBy?: string };

type Reservation = { id: string; checkIn: string; checkOut: string; status: string };
type Hold = {
  id: string;
  reservationId: string;
  startDate: string;
  endDate: string;
  expiresAt: string;
};
type OccupancyByDate = Record<string, { occupied: number; total: number }>;
type DayMeta = {
  status: 'Bloqueado' | 'iCal' | 'Reservado' | null;
  occupancyLabel: string;
  reservations: number;
  external: number;
  holds: number;
  occupied: number;
  total: number;
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

export const HostCalendar = ({ listings }: { listings: ListingOption[] }) => {
  const [csrf, setCsrf] = useState('');
  const [listingId, setListingId] = useState(listings[0]?.id || '');
  const [range, setRange] = useState<DateRange | undefined>();
  const [mode, setMode] = useState<'BLOCK' | 'MAINTENANCE' | 'PRICE'>('BLOCK');
  const [reason, setReason] = useState('Bloqueo manual');
  const [priceOverride, setPriceOverride] = useState(0);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [inventoryQty, setInventoryQty] = useState(1);
  const [occupancyByDate, setOccupancyByDate] = useState<OccupancyByDate>({});
  const [monthsToShow, setMonthsToShow] = useState(1);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  useEffect(() => {
    const updateMonths = () => {
      setMonthsToShow(window.innerWidth >= 1280 ? 2 : 1);
    };
    updateMonths();
    window.addEventListener('resize', updateMonths);
    return () => window.removeEventListener('resize', updateMonths);
  }, []);

  const loadBlocks = async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/host/calendar?listingId=${id}`);
    const data = await res.json();
    setBlocks(data.blocks || []);
    setReservations(data.reservations || []);
    setHolds(data.holds || []);
    setInventoryQty(Math.max(1, Number(data.inventoryQty || 1)));
    setOccupancyByDate(data.occupancyByDate || {});
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
  const fullOccupancyDays = Object.entries(occupancyByDate)
    .filter(([, value]) => Number(value?.occupied || 0) >= Number(value?.total || 1))
    .map(([key]) => new Date(`${key}T00:00:00.000Z`));
  const disabledRanges = fullOccupancyDays;

  const maintenanceBlocks = blockOnly.filter((b) => (b.reason || '').toLowerCase().includes('mantenimiento'));
  const externalBlocks = blockOnly.filter((b) => (b.createdBy || '').startsWith('ICAL:'));
  const manualBlocks = blockOnly.filter((b) => !maintenanceBlocks.includes(b) && !externalBlocks.includes(b));
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
  const dayMeta = useMemo(() => {
    const map = new Map<string, DayMeta>();
    for (const [key, value] of Object.entries(occupancyByDate)) {
      const dayStart = new Date(`${key}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const reservationsCount = reservations.filter((reservation) =>
        overlaps(dayStart, dayEnd, new Date(reservation.checkIn), new Date(reservation.checkOut))
      ).length;
      const externalCount = externalBlocks.filter((block) =>
        overlaps(dayStart, dayEnd, new Date(block.startDate), new Date(block.endDate))
      ).length;
      const holdsCount = holds.filter((hold) =>
        overlaps(dayStart, dayEnd, new Date(hold.startDate), new Date(hold.endDate))
      ).length;
      const hardBlocksCount = manualBlocks.filter((block) =>
        overlaps(dayStart, dayEnd, new Date(block.startDate), new Date(block.endDate))
      ).length;

      let status: DayMeta['status'] = null;
      if (hardBlocksCount > 0) status = 'Bloqueado';
      else if (externalCount > 0) status = 'iCal';
      else if (reservationsCount > 0 || holdsCount > 0) status = 'Reservado';

      map.set(key, {
        status,
        occupancyLabel: `${value.occupied}/${value.total}`,
        reservations: reservationsCount,
        external: externalCount,
        holds: holdsCount,
        occupied: value.occupied,
        total: value.total
      });
    }
    return map;
  }, [occupancyByDate, reservations, externalBlocks, holds, manualBlocks]);

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
            {inventoryQty > 1 && externalBlocks.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                iCal activo + inventario tipo hotel. Recomendado: reservas por aprobacion para evitar overbooking.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 md:p-5">
            <DayPicker
              className="host-calendar-picker"
              mode="range"
              selected={range}
              onSelect={setRange}
              showOutsideDays
              numberOfMonths={monthsToShow}
              pagedNavigation
              fixedWeeks
              disabled={disabledRanges}
              components={{
                DayButton: (props: DayButtonProps) => {
                  const key = format(props.day.date, 'yyyy-MM-dd');
                  const price = priceMap.get(key);
                  const meta = dayMeta.get(key);
                  const statusClass =
                    meta?.status === 'Bloqueado'
                      ? 'rdp-day-status-blocked'
                      : meta?.status === 'iCal'
                        ? 'rdp-day-status-ical'
                        : meta?.status === 'Reservado'
                          ? 'rdp-day-status-reserved'
                          : '';
                  const tooltip = meta
                    ? `Reservas: ${meta.reservations} | iCal: ${meta.external} | Holds: ${meta.holds} | Total: ${meta.occupied}/${meta.total}`
                    : undefined;
                  const { children, ...buttonProps } = props;
                  return (
                    <button {...buttonProps} title={tooltip}>
                      <div className="rdp-day-content">
                        <span className="rdp-day-number">{children}</span>
                        {meta?.status && (
                          <span className={`rdp-day-status ${statusClass}`}>{meta.status}</span>
                        )}
                        {meta && (
                          <span className="rdp-day-occupancy">{meta.occupancyLabel}</span>
                        )}
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
                price: priceBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) })),
                external: externalBlocks.map((b) => ({ from: new Date(b.startDate), to: new Date(b.endDate) }))
              }}
              modifiersClassNames={{
                blocked: 'rdp-day_blocked',
                maintenance: 'rdp-day_maintenance',
                reserved: 'rdp-day_reserved',
                price: 'rdp-day_price',
                external: 'rdp-day_blocked'
              }}
            />
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500" /> Bloqueado
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" /> Externo iCal
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
              <span>
                {b.startDate.slice(0, 10)} - {b.endDate.slice(0, 10)} -{' '}
                {(b.createdBy || '').startsWith('ICAL:')
                  ? 'Bloqueado por calendario externo'
                  : b.reason || 'Bloqueo'}
              </span>
              {(b.createdBy || '').startsWith('ICAL:') ? (
                <span className="text-xs text-slate-500">Gestionado por iCal</span>
              ) : (
                <button className="text-red-600" onClick={() => removeBlock(b.id)}>
                  Eliminar
                </button>
              )}
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

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Holds de pago activos</h2>
        <p className="mt-1 text-xs text-slate-500">Bloqueos temporales en checkout aprobado.</p>
        <div className="mt-5 space-y-2 text-sm">
          {holds.map((hold) => (
            <div key={hold.id} className="surface-muted">
              {hold.startDate.slice(0, 10)} - {hold.endDate.slice(0, 10)} - vence{' '}
              {new Date(hold.expiresAt).toLocaleString('es-AR')}
            </div>
          ))}
          {holds.length === 0 && <p className="text-sm text-slate-500">Sin holds activos.</p>}
        </div>
      </div>
    </div>
  );
};
