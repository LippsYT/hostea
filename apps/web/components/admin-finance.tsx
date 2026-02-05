'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FinanceChart } from '@/components/finance-chart';
import {
  FinanceRow,
  buildPeriodTotals,
  formatMoney,
  getPeriodLabel
} from '@/lib/finance-report';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import Link from 'next/link';

export type FinanceHostRow = {
  hostId: string;
  hostName: string;
  hostEmail: string;
  bankAccount?: {
    holderName?: string;
    documentId?: string;
    bankName?: string;
    accountType?: string;
    cbuOrAlias?: string;
    currency?: string;
  } | null;
};

export type AdminPayoutRow = {
  id: string;
  reservationId: string;
  hostId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

const buildPeriods = (rows: FinanceRow[]) => {
  const unique = Array.from(new Set(rows.map((r) => r.period))).sort().reverse();
  return unique.length > 0 ? unique : [new Date().toISOString().slice(0, 7)];
};

export const AdminFinance = ({
  rows,
  hosts,
  payouts,
  archiveMap
}: {
  rows: FinanceRow[];
  hosts: FinanceHostRow[];
  payouts: AdminPayoutRow[];
  archiveMap: Record<string, string[]>;
}) => {
  const [csrf, setCsrf] = useState('');
  const [selectedHost, setSelectedHost] = useState('all');
  const [metric, setMetric] = useState<'gross' | 'hostNet' | 'commission' | 'adjustments'>('gross');
  const [selectedPeriod, setSelectedPeriod] = useState(buildPeriods(rows)[0]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const archiveMonths = selectedHost === 'all' ? [] : archiveMap[selectedHost] || [];
  const periods = useMemo(() => {
    const all = buildPeriods(rows);
    if (selectedHost === 'all') return all;
    if (archiveMonths.length === 0) return all;
    return showArchived ? all.filter((p) => archiveMonths.includes(p)) : all.filter((p) => !archiveMonths.includes(p));
  }, [rows, selectedHost, archiveMonths, showArchived]);

  useEffect(() => {
    if (!periods.includes(selectedPeriod)) {
      setSelectedPeriod(periods[0]);
    }
  }, [periods, selectedPeriod]);

  const hostFiltered = useMemo(
    () => (selectedHost === 'all' ? rows : rows.filter((r) => r.hostId === selectedHost)),
    [rows, selectedHost]
  );
  const filteredRows = useMemo(
    () => hostFiltered.filter((r) => r.period === selectedPeriod),
    [hostFiltered, selectedPeriod]
  );
  const chartData = buildPeriodTotals(rows, periods);
  const totals = buildPeriodTotals(filteredRows, [selectedPeriod])[0];

  const hostSummary = hosts.map((host) => {
    const hostRows = rows.filter((r) => r.period === selectedPeriod && r.hostId === host.hostId);
    const total = hostRows.reduce((acc, r) => acc + r.total, 0);
    const hostNet = hostRows.reduce((acc, r) => acc + r.hostNet, 0);
    const paid = payouts
      .filter((p) => p.hostId === host.hostId)
      .reduce((acc, p) => acc + p.amount, 0);
    return { host, total, hostNet, paid, due: Math.max(hostNet - paid, 0) };
  });

  const pendingPayouts = filteredRows.filter((r) => r.hostNet > 0);
  const paidRows = payouts.filter((p) => {
    if (!p.createdAt.startsWith(selectedPeriod)) return false;
    if (selectedHost !== 'all') return p.hostId === selectedHost;
    return true;
  });

  const markPaid = async (reservationId: string) => {
    await fetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ reservationId })
    });
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Resumen del período</h2>
            <p className="text-sm text-slate-500">Controlá ingresos y liquidaciones por mes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {getPeriodLabel(p)}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"
              value={selectedHost}
              onChange={(e) => setSelectedHost(e.target.value)}
            >
              <option value="all">Todos los hosts</option>
              {hosts.map((h) => (
                <option key={h.hostId} value={h.hostId}>
                  {h.hostName}
                </option>
              ))}
            </select>
            {selectedHost !== 'all' && (
              <button
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"
                onClick={() => setShowArchived((prev) => !prev)}
              >
                {showArchived ? 'Ver activas' : 'Ver archivadas'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bruto</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.gross)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajustes</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.adjustments)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comisión</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.commission)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Neto host</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.hostNet)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movimientos</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredRows.length}</p>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Evolución 12 meses</h3>
              <p className="text-sm text-slate-500">Bruto, neto y comisiones.</p>
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
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Resumen por host</h2>
        <div className="mt-5 space-y-3 text-sm">
          {hostSummary.map(({ host, total, paid, due }) => (
            <div key={host.hostId} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{host.hostName}</p>
                <p className="text-xs text-slate-500">{host.hostEmail}</p>
                <div className="mt-2 text-xs text-slate-600">
                  {host.bankAccount ? (
                    <p>
                      {host.bankAccount.bankName || 'Banco'} · {host.bankAccount.cbuOrAlias || 'CBU/Alias'}
                    </p>
                  ) : (
                    <p className="text-amber-700">Sin datos bancarios</p>
                  )}
                </div>
              </div>
              <div className="text-right text-slate-600">
                <p>Total {formatMoney(total)}</p>
                <p>Pagado {formatMoney(paid)}</p>
                <p>Pendiente {formatMoney(due)}</p>
              </div>
              <Link
                className="text-xs font-semibold text-slate-900"
                href={`/dashboard/admin/finance/reports/${selectedPeriod}?hostId=${host.hostId}`}
              >
                Ver detalle
              </Link>
            </div>
          ))}
          {hostSummary.length === 0 && <p className="text-sm text-slate-500">Sin datos financieros.</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card">
          <h2 className="text-xl font-semibold text-slate-900">Transacciones programadas</h2>
          <div className="mt-4 space-y-3 text-sm">
            {pendingPayouts.map((r) => (
              <div key={r.id} className="surface-muted flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{r.listingTitle}</p>
                  <p className="text-xs text-slate-500">{r.guestName}</p>
                </div>
                <div className="text-right">
                  <p>{formatMoney(r.hostNet)}</p>
                  <Badge className={reservationStatusBadgeClass(r.status)}>{reservationStatusLabel(r.status)}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>
                  Marcar pagado
                </Button>
              </div>
            ))}
            {pendingPayouts.length === 0 && <p className="text-sm text-slate-500">Sin pendientes.</p>}
          </div>
        </div>
        <div className="surface-card">
          <h2 className="text-xl font-semibold text-slate-900">Transacciones pagadas</h2>
          <div className="mt-4 space-y-3 text-sm">
            {paidRows.map((p) => (
              <div key={p.id} className="surface-muted flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Reserva {p.reservationId.slice(0, 6)}</p>
                  <p className="text-xs text-slate-500">{p.createdAt}</p>
                </div>
                <p>{formatMoney(p.amount, p.currency)}</p>
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
            <p className="text-sm text-slate-500">Detalle mensual y exportación.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {periods.map((p) => (
            <div key={p} className="surface-muted space-y-2">
              <p className="text-sm font-semibold text-slate-900">{getPeriodLabel(p)}</p>
              <p className="text-sm text-slate-600">Bruto {formatMoney(buildPeriodTotals(rows.filter((r) => r.period === p), [p])[0].gross)}</p>
              <Link href={`/dashboard/admin/finance/reports/${p}`} className="text-xs font-semibold text-slate-900">
                Ver informe
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
