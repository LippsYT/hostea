import Link from 'next/link';
import type { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { PaymentStatus, ReservationStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { confirmReservationPayment } from '@/lib/reservation-payment-confirmation';

type SearchParams = {
  reservationId?: string | string[];
  experienceBookingId?: string | string[];
  session_id?: string | string[];
};

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatMoney = (value: number) => `USD ${value.toFixed(2)}`;
const formatDate = (value: Date) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(value);

const CONFIRMED_RESERVATION_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.COMPLETED
]);

const isReservationConfirmed = (
  reservationStatus: ReservationStatus,
  paymentStatus: PaymentStatus | null | undefined
) =>
  CONFIRMED_RESERVATION_STATUSES.has(reservationStatus) &&
  paymentStatus === PaymentStatus.SUCCEEDED;

const isStripeSessionPaid = (session: any) =>
  session?.payment_status === 'paid' || session?.status === 'complete';

const SuccessShell = ({
  badge,
  title,
  subtitle,
  children,
  actions
}: {
  badge: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
  actions: ReactNode;
}) => (
  <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12">
    <div className="w-full rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{badge}</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>

      {children ? <div className="mt-6">{children}</div> : null}

      <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
    </div>
  </div>
);

export default async function SuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const sessionId = getParam(searchParams.session_id);
  const experienceBookingId = getParam(searchParams.experienceBookingId);
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  let stripeSession: any = null;
  let resolvedReservationId = getParam(searchParams.reservationId);

  if (sessionId) {
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
      if (!resolvedReservationId) {
        resolvedReservationId = stripeSession?.metadata?.reservationId || undefined;
      }
    } catch (error) {
      console.error('success-page-session-fetch-error', { sessionId, error });
    }
  }

  if (!userId) {
    if (resolvedReservationId && stripeSession && isStripeSessionPaid(stripeSession)) {
      await confirmReservationPayment({
        reservationId: resolvedReservationId,
        stripeSessionId: stripeSession.id || null,
        stripePaymentIntentId:
          typeof stripeSession.payment_intent === 'string' ? stripeSession.payment_intent : null
      });
    }

    return (
      <SuccessShell
        badge="Pago exitoso"
        title="Tu pago fue recibido"
        subtitle="Inicia sesion para ver el detalle de la reserva y descargar la confirmacion."
        actions={
          <>
            <Link href="/auth/sign-in" className="brand-gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white">
              Iniciar sesion
            </Link>
            <Link href="/" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
              Volver al inicio
            </Link>
          </>
        }
      />
    );
  }

  if (resolvedReservationId) {
    let reservation = await prisma.reservation.findFirst({
      where: { id: resolvedReservationId, userId },
      include: { listing: true, payment: true }
    });

    if (
      reservation &&
      stripeSession &&
      isStripeSessionPaid(stripeSession) &&
      !isReservationConfirmed(reservation.status, reservation.payment?.status)
    ) {
      const metadataReservationId = stripeSession?.metadata?.reservationId || reservation.id;
      if (metadataReservationId === reservation.id) {
        await confirmReservationPayment({
          reservationId: reservation.id,
          stripeSessionId: stripeSession.id || null,
          stripePaymentIntentId:
            typeof stripeSession.payment_intent === 'string' ? stripeSession.payment_intent : null
        });

        reservation = await prisma.reservation.findFirst({
          where: { id: resolvedReservationId, userId },
          include: { listing: true, payment: true }
        });
      }
    }

    if (!reservation) {
      return (
        <SuccessShell
          badge="Pago procesado"
          title="No encontramos la reserva"
          subtitle="La referencia no pertenece a tu cuenta o aun se esta sincronizando."
          actions={
            <>
              <Link href="/dashboard/client" className="brand-gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white">
                Ir a mis reservas
              </Link>
              <Link href="/" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Volver al inicio
              </Link>
            </>
          }
        />
      );
    }

    const paymentOk = reservation.payment?.status === PaymentStatus.SUCCEEDED;
    const confirmed = isReservationConfirmed(reservation.status, reservation.payment?.status);

    return (
      <SuccessShell
        badge={confirmed ? 'Reserva confirmada' : 'Pago en verificacion'}
        title={reservation.listing.title}
        subtitle={
          confirmed
            ? 'Tu pago quedo acreditado y la reserva esta confirmada.'
            : 'El pago fue recibido y estamos finalizando la confirmacion.'
        }
        actions={
          <>
            <Link href={`/dashboard/client?reservationId=${reservation.id}`} className="brand-gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white">
              Ver mi reserva
            </Link>
            <Link href="/dashboard/client" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
              Ir a mis reservas
            </Link>
            <Link href="/" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
              Volver al inicio
            </Link>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Referencia</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {reservation.reservationNumber || reservation.id}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Check-in</p>
            <p className="text-sm text-slate-900">{formatDate(reservation.checkIn)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Check-out</p>
            <p className="text-sm text-slate-900">{formatDate(reservation.checkOut)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle</p>
            <p className="mt-1 text-sm text-slate-900">
              Huespedes: <span className="font-semibold">{reservation.guestsCount}</span>
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Total pagado</p>
            <p className="text-2xl font-semibold text-slate-900">{formatMoney(Number(reservation.total))}</p>
            <p className="mt-3 text-sm text-slate-600">
              Estado del pago:{' '}
              <span className={`font-semibold ${paymentOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                {reservation.payment?.status || 'PENDIENTE'}
              </span>
            </p>
          </div>
        </div>
      </SuccessShell>
    );
  }

  if (experienceBookingId) {
    const booking = await prisma.experienceBooking.findFirst({
      where: { id: experienceBookingId, userId },
      include: { experience: true }
    });

    if (!booking) {
      return (
        <SuccessShell
          badge="Pago procesado"
          title="No encontramos la reserva de experiencia"
          subtitle="La referencia no pertenece a tu cuenta o aun se esta sincronizando."
          actions={
            <>
              <Link href="/dashboard/client" className="brand-gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white">
                Ir a mis reservas
              </Link>
              <Link href="/" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Volver al inicio
              </Link>
            </>
          }
        />
      );
    }

    return (
      <SuccessShell
        badge="Reserva confirmada"
        title={booking.experience.title}
        subtitle="Tu experiencia fue confirmada y ya esta lista en tu panel."
        actions={
          <>
            <Link href="/dashboard/client" className="brand-gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white">
              Ver mi reserva
            </Link>
            <Link href="/dashboard/client" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
              Ir a mis reservas
            </Link>
            <Link href="/" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
              Volver al inicio
            </Link>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</p>
            <p className="text-sm text-slate-900">{formatDate(booking.date)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Horario</p>
            <p className="text-sm text-slate-900">{booking.timeLabel || 'A confirmar'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Participantes</p>
            <p className="text-sm text-slate-900">
              {booking.adults + booking.children + booking.infants}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Total pagado</p>
            <p className="text-2xl font-semibold text-slate-900">{formatMoney(Number(booking.total))}</p>
          </div>
        </div>
      </SuccessShell>
    );
  }

  return (
    <SuccessShell
      badge="Pago recibido"
      title="Operacion completada"
      subtitle="Si no ves la reserva inmediatamente, recarga la pagina en unos segundos."
      actions={
        <>
          <Link href="/dashboard/client" className="brand-gradient-bg rounded-full px-5 py-2 text-sm font-semibold text-white">
            Ir a mis reservas
          </Link>
          <Link href="/" className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
            Volver al inicio
          </Link>
        </>
      }
    />
  );
}
