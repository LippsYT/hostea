import { Badge } from '@/components/ui/badge';
import { PrintButton } from '@/components/print-button';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import { formatMoney } from '@/lib/finance-report';

export type FinanceReportRow = {
  id: string;
  reservationId: string;
  guestName: string;
  listingTitle: string;
  status: string;
  date: string;
  total: number;
  commission: number;
  hostNet: number;
  currency: string;
  hostName?: string;
};

export type FinanceListingSummary = {
  listingTitle: string;
  gross: number;
  adjustments: number;
  commission: number;
  hostNet: number;
  currency: string;
};

export const FinanceReportView = ({
  title,
  periodLabel,
  totals,
  stats,
  rows,
  listings
}: {
  title: string;
  periodLabel: string;
  totals: { gross: number; adjustments: number; commission: number; hostNet: number; currency: string };
  stats: { nights: number; stays: number; avgNights: number };
  rows: FinanceReportRow[];
  listings: FinanceListingSummary[];
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-subtitle">{periodLabel}</p>
          <h1 className="section-title">{title}</h1>
        </div>
        <PrintButton />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingresos brutos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.gross, totals.currency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajustes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.adjustments, totals.currency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comisión plataforma</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.commission, totals.currency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total neto</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.hostNet, totals.currency)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Noches reservadas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.nights}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estadías</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.stays}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio noches</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.avgNights.toFixed(1)}</p>
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Detalle de transacciones</h2>
        <div className="mt-4 space-y-3 text-sm">
          {rows.map((r) => (
            <div key={r.id} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{r.guestName}</p>
                <p className="text-xs text-slate-500">
                  {r.listingTitle} · {r.date}
                </p>
                <Badge className={reservationStatusBadgeClass(r.status as any)}>{reservationStatusLabel(r.status as any)}</Badge>
                {r.hostName && <p className="text-xs text-slate-500">Host: {r.hostName}</p>}
              </div>
              <div className="text-right text-slate-600">
                <p>{formatMoney(r.total, r.currency)}</p>
                <p className="text-xs">Fee {formatMoney(r.commission, r.currency)}</p>
                <p className="text-xs">Neto {formatMoney(r.hostNet, r.currency)}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500">No hay movimientos en este período.</p>}
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Alojamientos</h2>
        <div className="mt-4 space-y-3 text-sm">
          {listings.map((l) => (
            <div key={l.listingTitle} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{l.listingTitle}</p>
              </div>
              <div className="text-right text-slate-600">
                <p>Bruto {formatMoney(l.gross, l.currency)}</p>
                <p className="text-xs">Ajustes {formatMoney(l.adjustments, l.currency)}</p>
                <p className="text-xs">Fee {formatMoney(l.commission, l.currency)}</p>
                <p className="text-xs">Neto {formatMoney(l.hostNet, l.currency)}</p>
              </div>
            </div>
          ))}
          {listings.length === 0 && <p className="text-sm text-slate-500">Sin datos por alojamiento.</p>}
        </div>
      </div>
    </div>
  );
};
