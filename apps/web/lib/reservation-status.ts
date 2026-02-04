import type { ReservationStatus } from '@prisma/client';

type StatusKey = ReservationStatus | string | undefined | null;

const LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pago pendiente',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Check-in',
  COMPLETED: 'Completada',
  CANCELED: 'Cancelada',
  REFUNDED: 'Reembolsada',
  DISPUTED: 'En disputa',
  PREAPPROVED: 'Preaprobada',
  REJECTED: 'Rechazada',
  INQUIRY: 'Consulta',
  RESERVATION: 'Reserva'
};

const BADGE_CLASS: Record<string, string> = {
  PENDING_PAYMENT: 'border-amber-200 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CHECKED_IN: 'border-blue-200 bg-blue-50 text-blue-700',
  COMPLETED: 'border-slate-200 bg-slate-50 text-slate-700',
  CANCELED: 'border-rose-200 bg-rose-50 text-rose-700',
  REFUNDED: 'border-rose-200 bg-rose-50 text-rose-700',
  DISPUTED: 'border-amber-200 bg-amber-50 text-amber-700',
  PREAPPROVED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  INQUIRY: 'border-slate-200 bg-slate-50 text-slate-700',
  RESERVATION: 'border-slate-200 bg-slate-50 text-slate-700'
};

export const reservationStatusLabel = (status: StatusKey) => {
  if (!status) return 'Estado desconocido';
  return LABELS[String(status)] || String(status);
};

export const reservationStatusBadgeClass = (status: StatusKey) => {
  if (!status) return 'border-slate-200 bg-slate-50 text-slate-700';
  return BADGE_CLASS[String(status)] || 'border-slate-200 bg-slate-50 text-slate-700';
};
