import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ChatClient } from '@/components/chat-client';
import { HostMessageActions } from '@/components/host-message-actions';
import Link from 'next/link';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import { Badge } from '@/components/ui/badge';
import { expireAwaitingPaymentReservations } from '@/lib/reservation-request-flow';
import { getReservationWorkflowStatus } from '@/lib/reservation-workflow';

type ThreadState = 'consulta' | 'oferta' | 'reserva' | 'cerrada';

const threadStateLabel: Record<ThreadState, string> = {
  consulta: 'Consulta',
  oferta: 'Oferta',
  reserva: 'Reserva',
  cerrada: 'Cerrada'
};

const threadStateClass: Record<ThreadState, string> = {
  consulta: 'border-slate-200 bg-slate-100 text-slate-700',
  oferta: 'border-amber-200 bg-amber-50 text-amber-700',
  reserva: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cerrada: 'border-rose-200 bg-rose-50 text-rose-700'
};

const getThreadState = (thread: any): ThreadState => {
  if (thread.reservation) return 'reserva';
  if (thread.status === 'OFFER' || thread.status === 'PREAPPROVED') return 'oferta';
  if (thread.status === 'REJECTED') return 'cerrada';
  return 'consulta';
};

const getInquiryListingId = (subject?: string | null) =>
  subject && subject.startsWith('LISTING:') ? subject.replace('LISTING:', '').trim() : null;

export default async function HostMessagesPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const userName = (session?.user as any)?.name || (session?.user as any)?.email || 'Usuario';

  await expireAwaitingPaymentReservations();

  await prisma.offer.updateMany({
    where: { hostId: userId, status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' }
  });

  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId } } },
    include: {
      reservation: { include: { listing: true, user: { include: { profile: true } }, payment: true } },
      participants: { include: { user: { include: { profile: true } } } },
      offers: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { sender: { include: { profile: true } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const inquiryListingIds = Array.from(
    new Set(
      threads
        .map((thread) => getInquiryListingId(thread.subject))
        .filter((id): id is string => Boolean(id))
    )
  );

  const inquiryListings = inquiryListingIds.length
    ? await prisma.listing.findMany({
        where: { id: { in: inquiryListingIds } },
        select: { id: true, title: true }
      })
    : [];

  const inquiryListingMap = new Map(inquiryListings.map((listing) => [listing.id, listing.title]));

  const selected =
    typeof searchParams.threadId === 'string' ? searchParams.threadId : threads[0]?.id;
  const selectedThread = threads.find((t) => t.id === selected);

  const selectedGuest = selectedThread?.participants.find((p) => p.userId !== userId);
  const selectedGuestName =
    selectedGuest?.user.profile?.name || selectedGuest?.user.email || 'Huesped';
  const selectedGuestPhone = selectedGuest?.user.profile?.phone || null;
  const reservationStatus = selectedThread?.reservation
    ? (() => {
        const workflow = getReservationWorkflowStatus({
          status: selectedThread.reservation.status,
          paymentExpiresAt: selectedThread.reservation.paymentExpiresAt,
          holdExpiresAt: selectedThread.reservation.holdExpiresAt,
          paymentStatus: selectedThread.reservation.payment?.status || null
        });
        if (workflow === 'pending_approval') return 'PENDING_APPROVAL';
        if (workflow === 'awaiting_payment') return 'AWAITING_PAYMENT';
        if (workflow === 'expired') return 'EXPIRED';
        if (workflow === 'rejected') return 'REJECTED';
        return selectedThread.reservation.status;
      })()
    : null;
  const selectedState = selectedThread ? getThreadState(selectedThread) : null;

  const selectedListingTitle = selectedThread
    ? selectedThread.reservation?.listing?.title ||
      inquiryListingMap.get(getInquiryListingId(selectedThread.subject) || '') ||
      'Consulta sin propiedad'
    : null;

  const selectedLastMessage = selectedThread?.messages?.[0];
  const selectedLatestOffer = selectedThread?.offers?.[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Mensajes</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="surface-card p-4">
          <h2 className="text-lg font-semibold text-slate-900">Conversaciones</h2>
          <p className="mt-1 text-xs text-slate-500">Cliente, propiedad y estado de cada chat.</p>
          <div className="mt-4 space-y-2">
            {threads.map((thread) => {
              const other = thread.participants.find((p) => p.userId !== userId);
              const otherName = other?.user.profile?.name || other?.user.email || 'Huesped';
              const state = getThreadState(thread);
              const listingTitle =
                thread.reservation?.listing?.title ||
                inquiryListingMap.get(getInquiryListingId(thread.subject) || '') ||
                'Consulta sin propiedad';
              const lastMessage = thread.messages[0];
              const isSelected = thread.id === selected;

              return (
                <Link
                  key={thread.id}
                  href={`?threadId=${thread.id}`}
                  className={`block rounded-2xl border p-3 text-sm transition ${
                    isSelected
                      ? 'border-slate-300 bg-white shadow-sm'
                      : 'border-slate-200/70 bg-slate-50/80 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{otherName}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${threadStateClass[state]}`}>
                      {threadStateLabel[state]}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{listingTitle}</p>
                  {lastMessage && (
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {lastMessage.sender.profile?.name || lastMessage.sender.email}: {lastMessage.body}
                    </p>
                  )}
                </Link>
              );
            })}
            {threads.length === 0 && <p className="text-sm text-slate-500">Sin mensajes.</p>}
          </div>
        </aside>

        <section className="surface-card p-4">
          {selectedThread ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedGuestName}</p>
                  <p className="text-xs text-slate-500">{selectedListingTitle}</p>
                </div>
                {selectedState && (
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${threadStateClass[selectedState]}`}>
                    {threadStateLabel[selectedState]}
                  </span>
                )}
              </div>
              <ChatClient
                initialThreadId={selected}
                currentUserId={userId}
                currentUserName={userName}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">Selecciona una conversacion.</p>
          )}
        </section>

        <aside className="surface-card sticky top-24 h-fit space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Acciones del host</h2>
            <p className="mt-1 text-xs text-slate-500">
              Invita a reservar, envia oferta personalizada o cierra la conversacion.
            </p>
          </div>
          <HostMessageActions
            threadId={selected}
            reservationStatus={reservationStatus}
            guestPhone={selectedGuestPhone}
            defaultCheckIn={selectedThread?.reservation?.checkIn?.toISOString().slice(0, 10) || null}
            defaultCheckOut={selectedThread?.reservation?.checkOut?.toISOString().slice(0, 10) || null}
            defaultGuestsCount={selectedThread?.reservation?.guestsCount || 1}
          />

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <h3 className="text-base font-semibold text-slate-900">Contexto de reserva</h3>
            {selectedThread?.reservation ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{selectedThread.reservation.listing.title}</p>
                <p>Huesped: {selectedGuestName}</p>
                <p>
                  {selectedThread.reservation.checkIn.toISOString().slice(0, 10)} -{' '}
                  {selectedThread.reservation.checkOut.toISOString().slice(0, 10)}
                </p>
                <p>{selectedThread.reservation.guestsCount} huespedes</p>
                <p>Total: USD {Number(selectedThread.reservation.total).toFixed(2)}</p>
                {reservationStatus === 'AWAITING_PAYMENT' &&
                  (selectedThread.reservation.paymentExpiresAt ||
                    selectedThread.reservation.holdExpiresAt) && (
                  <p className="text-xs text-indigo-700">
                    Pago vence:{' '}
                    {(
                      selectedThread.reservation.paymentExpiresAt ||
                      selectedThread.reservation.holdExpiresAt
                    )?.toLocaleString('es-AR')}
                  </p>
                )}
                <Badge className={reservationStatusBadgeClass(reservationStatus)}>
                  {reservationStatusLabel(reservationStatus)}
                </Badge>
              </div>
            ) : (
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                <p>Estado: consulta previa a reserva.</p>
                <p>Propiedad: {selectedListingTitle || 'Sin propiedad'}</p>
                <p>Cuando el cliente confirme, aqui se mostraran fechas, huespedes y precio.</p>
              </div>
            )}
          </div>

          {selectedLastMessage && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ultimo mensaje</p>
              <p className="mt-2 text-sm text-slate-700">{selectedLastMessage.body}</p>
            </div>
          )}
          {selectedLatestOffer && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-wide">Oferta activa</p>
              <p className="mt-1 font-semibold">USD {Number(selectedLatestOffer.clientTotal).toFixed(2)}</p>
              <p className="text-xs">
                {selectedLatestOffer.checkIn.toISOString().slice(0, 10)} -{' '}
                {selectedLatestOffer.checkOut.toISOString().slice(0, 10)}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
