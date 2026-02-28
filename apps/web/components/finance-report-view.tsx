import { PrintButton } from '@/components/print-button';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import { formatMoney } from '@/lib/finance-report';
import { Badge } from '@/components/ui/badge';

export type FinanceReportRow = {
  id: string;
  reservationId: string;
  reservationNumber?: string | null;
  guestName: string;
  listingTitle: string;
  status: string;
  checkIn: string;
  checkOut: string;
  baseAmount: number;
  adminCharges: number;
  serviceFee: number;
  hostNet: number;
  currency: string;
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
  host,
  totals,
  stats,
  rows,
  listings
}: {
  title: string;
  periodLabel: string;
  host?: { name: string; email: string } | null;
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
          <p className="mt-1 text-sm text-slate-500">Hostea - Liquidacion de pagos</p>
        </div>
        <PrintButton />
      </div>

      {host && (
        <div className="surface-card">
          <h2 className="text-lg font-semibold text-slate-900">Datos del anfitrion</h2>
          <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p>
              <span className="font-semibold text-slate-900">Nombre:</span> {host.name}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Email:</span> {host.email}
            </p>
          </div>
        </div>
      )}

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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tarifa de servicio</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.commission, totals.currency)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total neto a pagar</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totals.hostNet, totals.currency)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Noches reservadas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.nights}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estadias</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.stays}</p>
        </div>
        <div className="surface-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio de noches</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.avgNights.toFixed(1)}</p>
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Detalle por reserva</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Reserva</th>
                <th className="px-3 py-2">Fechas</th>
                <th className="px-3 py-2">Precio base</th>
                <th className="px-3 py-2">Cargos administrativos</th>
                <th className="px-3 py-2">Tarifa de servicio</th>
                <th className="px-3 py-2">Neto pagado al host</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold text-slate-900">{row.reservationId.slice(0, 8)}</p>
                    {row.reservationNumber ? (
                      <p className="text-xs text-slate-500">{row.reservationNumber}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">{row.guestName}</p>
                    <p className="text-xs text-slate-500">{row.listingTitle}</p>
                    <Badge className={`mt-2 ${reservationStatusBadgeClass(row.status)}`}>
                      {reservationStatusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {row.checkIn} - {row.checkOut}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{formatMoney(row.baseAmount, row.currency)}</td>
                  <td className="px-3 py-3 text-slate-700">-{formatMoney(row.adminCharges, row.currency)}</td>
                  <td className="px-3 py-3 text-slate-700">-{formatMoney(row.serviceFee, row.currency)}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(row.hostNet, row.currency)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-sm text-slate-500">
                    No hay movimientos en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Alojamientos</h2>
        <div className="mt-4 space-y-3 text-sm">
          {listings.map((listing) => (
            <div key={listing.listingTitle} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">{listing.listingTitle}</p>
              <div className="text-right text-slate-600">
                <p>Bruto {formatMoney(listing.gross, listing.currency)}</p>
                <p className="text-xs">Ajustes {formatMoney(listing.adjustments, listing.currency)}</p>
                <p className="text-xs">Tarifa de servicio {formatMoney(listing.commission, listing.currency)}</p>
                <p className="text-xs">Neto {formatMoney(listing.hostNet, listing.currency)}</p>
              </div>
            </div>
          ))}
          {listings.length === 0 && <p className="text-sm text-slate-500">Sin datos por alojamiento.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Nota legal: Hostea actua como plataforma intermediaria de pagos. Esta liquidacion es informativa y no reemplaza
        obligaciones fiscales o regulatorias del anfitrion.
      </div>
    </div>
  );
};
