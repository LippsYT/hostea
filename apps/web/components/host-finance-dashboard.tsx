'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FinanceChart, FinanceChartPoint } from '@/components/finance-chart';
import { HostBankForm } from '@/components/host-bank-form';
import {
  FinanceRow,
  buildPeriodTotals,
  formatMoney,
  getPeriodLabel
} from '@/lib/finance-report';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import Link from 'next/link';

const buildPeriods = (rows: FinanceRow[]) => {
  const unique = Array.from(new Set(rows.map((r) => r.period))).sort().reverse();
  return unique.length > 0 ? unique : [new Date().toISOString().slice(0, 7)];
};

export const HostFinanceDashboard = ({
  rows,
  scheduled,
  paid,
  bankAccount,
  archiveMonths,
  selectedPeriod
}: {
  rows: FinanceRow[];
  scheduled: { id: string; listingTitle: string; guestName: string; amount: number; currency: string; eta: string; period: string }[];
  paid: { id: string; reservationId: string; amount: number; currency: string; createdAt: string }[];
  bankAccount: any | null;
  archiveMonths: string[];
  selectedPeriod?: string;
}) => {
  const periods = useMemo(() => buildPeriods(rows), [rows]);
  const [period, setPeriod] = useState(selectedPeriod || periods[0]);
  const [metric, setMetric] = useState<'gross' | 'hostNet' | 'commission' | 'adjustments'>('gross');
  const [viewArchived, setViewArchived] = useState(false);

  const periodRows = rows.filter((r) => r.period === period);
  const scheduledRows = scheduled.filter((s) => s.period === period);
  const paidRows = paid.filter((p) => p.createdAt.startsWith(period));

  const totals = buildPeriodTotals(periodRows, [period])[0];
  const chartData = buildPeriodTotals(rows, periods) as FinanceChartPoint[];

  const bankComplete = bankAccount && bankAccount.holderName && bankAccount.cbuOrAlias;

  const periodCards = periods
    .filter((p) => (viewArchived ? archiveMonths.includes(p) : !archiveMonths.includes(p)))
    .map((p) => {
      const summary = buildPeriodTotals(rows.filter((r) => r.period === p), [p])[0];
      return { period: p, summary };
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-subtitle">Panel Host</p>
          <h1 className="section-title">Finanzas y liquidaciones</h1>
          <p className="text-sm text-slate-500">Resumen mensual de ingresos y liquidaciones.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {getPeriodLabel(p)}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewArchived((v) => !v)}
          >
            {viewArchived ? 'Ver activos' : 'Ver archivados'}
          </Button>
        </div>
      </div>

      {!bankComplete && (
        <div className="surface-card border border-amber-200 bg-amber-50/70 text-sm text-amber-800">
          Faltan datos de cobro. Completalos para habilitar liquidaciones.
        </div>
      )}

      <HostBankForm />

      <div className="grid gap-4 md:grid-cols-5">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingresos brutos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.gross)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajustes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.adjustments)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comisión plataforma</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.commission)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Neto host</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.hostNet)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transacciones</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{periodRows.length}</p>
        </div>
      </div>

      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Evolución últimos 12 meses</h2>
            <p className="text-sm text-slate-500">Compará ingresos y comisiones.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['gross', 'hostNet', 'commission', 'adjustments'] as const).map((key) => (
              <button
                key={key}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  metric === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                }`}
                onClick={() => setMetric(key)}
              >
                {key === 'gross' && 'Bruto'}
                {key === 'hostNet' && 'Neto host'}
                {key === 'commission' && 'Comisión'}
                {key === 'adjustments' && 'Ajustes'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <FinanceChart data={chartData} metric={metric} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card">
          <h2 className="text-xl font-semibold text-slate-900">Transacciones programadas</h2>
          <div className="mt-4 space-y-3 text-sm">
            {scheduledRows.map((item) => (
              <div key={item.id} className="surface-muted flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{item.listingTitle}</p>
                  <p className="text-xs text-slate-500">{item.guestName}</p>
                </div>
                <div className="text-right">
                  <p>{formatMoney(item.amount, item.currency)}</p>
                  <p className="text-xs text-slate-500">ETA {item.eta}</p>
                </div>
              </div>
            ))}
            {scheduledRows.length === 0 && (
              <p className="text-sm text-slate-500">No hay liquidaciones futuras para este período.</p>
            )}
          </div>
        </div>
        <div className="surface-card">
          <h2 className="text-xl font-semibold text-slate-900">Transacciones pagadas</h2>
          <div className="mt-4 space-y-3 text-sm">
            {paidRows.map((item) => (
              <div key={item.id} className="surface-muted flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Reserva {item.reservationId.slice(0, 6)}</p>
                  <p className="text-xs text-slate-500">Pagado {item.createdAt}</p>
                </div>
                <p>{formatMoney(item.amount, item.currency)}</p>
              </div>
            ))}
            {paidRows.length === 0 && <p className="text-sm text-slate-500">Sin pagos registrados.</p>}
          </div>
        </div>
      </div>

      <div className="surface-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Informes de ingresos</h2>
            <p className="text-sm text-slate-500">Accedé al detalle por mes.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {periodCards.map((item) => (
            <div key={item.period} className="surface-muted space-y-2">
              <p className="text-sm font-semibold text-slate-900">{getPeriodLabel(item.period)}</p>
              <p className="text-sm text-slate-600">Neto: {formatMoney(item.summary.hostNet)}</p>
              <Link
                href={`/dashboard/host/finance/reports/${item.period}`}
                className="inline-flex items-center text-xs font-semibold text-slate-900"
              >
                Ver informe
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Detalle de transacciones</h2>
        <div className="mt-4 space-y-3 text-sm">
          {periodRows.map((r) => (
            <div key={r.id} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{r.guestName}</p>
                <p className="text-xs text-slate-500">
                  {r.listingTitle} · {r.date}
                </p>
                <Badge className={reservationStatusBadgeClass(r.status)}>{reservationStatusLabel(r.status)}</Badge>
              </div>
              <div className="text-right text-slate-600">
                <p>{formatMoney(r.total, r.currency)}</p>
                <p className="text-xs">Fee {formatMoney(r.commission, r.currency)}</p>
                <p className="text-xs">Neto {formatMoney(r.hostNet, r.currency)}</p>
              </div>
            </div>
          ))}
          {periodRows.length === 0 && <p className="text-sm text-slate-500">Sin movimientos para este período.</p>}
        </div>
      </div>
    </div>
  );
};
