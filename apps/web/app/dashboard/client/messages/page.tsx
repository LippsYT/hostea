import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ChatClient } from '@/components/chat-client';
import Link from 'next/link';
import { reservationStatusLabel } from '@/lib/reservation-status';
import { ClientOfferActions } from '@/components/client-offer-actions';
import { ClientReservationPaymentActions } from '@/components/client-reservation-payment-actions';
import { expireAwaitingPaymentReservations } from '@/lib/reservation-request-flow';
import { getReservationWorkflowStatus } from '@/lib/reservation-workflow';
import { backfillReservationNumbers } from '@/lib/reservation-number';
import { Home, Ticket } from 'lucide-react';

const getThreadContext = (
  thread: any,
  inquiryListingMap: Map<string, string>
): { type: 'listing' | 'activity'; title: string; label: string } => {
  const listingTitle =
    thread.reservation?.listing?.title ||
    inquiryListingMap.get(thread.subject?.replace('LISTING:', '').trim() || '');
  if (listingTitle) {
    return { type: 'listing', title: listingTitle, label: 'Alojamiento' };
  }
  if (thread.subject?.startsWith('ACTIVITY:')) {
    return {
      type: 'activity',
      title: `Actividad ${thread.subject.replace('ACTIVITY:', '').trim()}`,
      label: 'Actividad'
    };
  }
  return { type: 'listing', title: 'Consulta de reserva', label: 'Alojamiento' };
};

export default async function ClientMessagesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const userName = (session?.user as any)?.name || (session?.user as any)?.email || 'Usuario';

  await expireAwaitingPaymentReservations();
  await backfillReservationNumbers(prisma, 150);

  await prisma.offer.updateMany({
    where: { guestId: userId, status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' }
  });

  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId } } },
    include: {
      reservation: { include: { listing: true, user: true, payment: true } },
      participants: { include: { user: { include: { profile: true } } } },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { sender: { include: { profile: true } } }
      },
      _count: {
        select: {
          messages: {
            where: {
              senderId: { not: userId },
              seenAt: null
            }
          }
        }
      },
      offers: {
        where: { guestId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  const inquiryListingIds = Array.from(
    new Set(
      threads
        .map((thread) =>
          thread.subject?.startsWith('LISTING:') ? thread.subject.replace('LISTING:', '').trim() : null
        )
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

  const query =
    typeof searchParams.q === 'string' ? searchParams.q.trim().toLowerCase() : '';
  const typeFilter =
    searchParams.type === 'activity' || searchParams.type === 'listing'
      ? (searchParams.type as 'activity' | 'listing')
      : 'all';

  const filteredThreads = threads.filter((thread) => {
    const context = getThreadContext(thread, inquiryListingMap);
    if (typeFilter !== 'all' && context.type !== typeFilter) return false;
    if (!query) return true;
    const hostParticipant = thread.participants.find((p) => p.userId !== userId);
    const hostName = hostParticipant?.user.profile?.name || '';
    const hostEmail = hostParticipant?.user.email || '';
    const hostPhone = hostParticipant?.user.profile?.phone || '';
    const reservationNumber = thread.reservation?.reservationNumber || '';
    const dateText = thread.reservation
      ? `${thread.reservation.checkIn.toISOString().slice(0, 10)} ${thread.reservation.checkOut
          .toISOString()
          .slice(0, 10)}`
      : '';
    return [hostName, hostEmail, hostPhone, context.title, context.label, reservationNumber, dateText]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const selected =
    typeof searchParams.threadId === 'string' ? searchParams.threadId : filteredThreads[0]?.id;
  const selectedThread = filteredThreads.find((t) => t.id === selected) || filteredThreads[0];
  const selectedThreadId = selectedThread?.id || '';
  const latestOffer = selectedThread?.offers?.[0] || null;
  const reservationWorkflowStatus = selectedThread?.reservation
      ? getReservationWorkflowStatus({
        status: selectedThread.reservation.status,
        paymentExpiresAt: selectedThread.reservation.paymentExpiresAt,
        holdExpiresAt: selectedThread.reservation.holdExpiresAt,
        paymentStatus: selectedThread.reservation.payment?.status || null
      })
    : null;
  const visibleOffer = latestOffer
    ? latestOffer.status === 'REJECTED'
      ? latestOffer
      : latestOffer.expiresAt.getTime() > Date.now()
        ? latestOffer
        : null
    : null;

  const selectedContext = selectedThread
    ? getThreadContext(selectedThread, inquiryListingMap)
    : { type: 'listing' as const, title: 'Alojamiento', label: 'Alojamiento' };
  const selectedListingTitle = selectedContext.title;
  const selectedHostParticipant = selectedThread?.participants.find((p) => p.userId !== userId);
  const selectedHostName =
    selectedHostParticipant?.user.profile?.name ||
    selectedHostParticipant?.user.email ||
    'Anfitrion';

  return (
    <div className="flex min-h-0 flex-col gap-6 lg:h-[calc(100dvh-10rem)] lg:overflow-hidden">
      <div>
        <p className="section-subtitle">Panel Cliente</p>
        <h1 className="section-title">Mensajeria</h1>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:h-full lg:gap-6 lg:overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="surface-card flex min-h-0 flex-col p-4 lg:h-full lg:overflow-hidden">
          <h2 className="text-lg font-semibold text-slate-900">Conversaciones</h2>
          <p className="mt-1 text-xs text-slate-500">Busca por anfitrion, propiedad o numero de reserva.</p>
          <form className="mt-3" method="get">
            {selectedThread?.id ? <input type="hidden" name="threadId" value={selectedThread.id} /> : null}
            {typeFilter !== 'all' ? <input type="hidden" name="type" value={typeFilter} /> : null}
            <input
              name="q"
              defaultValue={query}
              placeholder="Buscar conversaciones"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
            />
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'listing', label: 'Alojamientos' },
              { key: 'activity', label: 'Actividades' }
            ].map((item) => {
              const params = new URLSearchParams();
              if (query) params.set('q', query);
              if (item.key !== 'all') params.set('type', item.key);
              return (
                <Link
                  key={item.key}
                  href={`?${params.toString()}`}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    typeFilter === item.key
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {filteredThreads.map((thread) => {
              const hostParticipant = thread.participants.find((p) => p.userId !== userId);
              const hostName =
                hostParticipant?.user.profile?.name || hostParticipant?.user.email || 'Anfitrion';
              const listingTitle =
                getThreadContext(thread, inquiryListingMap).title;
              const context = getThreadContext(thread, inquiryListingMap);
              const lastMessage = thread.messages[0];
              const unreadCount = thread._count?.messages || 0;
              const lastMessageDate = lastMessage?.createdAt
                ? new Date(lastMessage.createdAt).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit'
                  })
                : '';
              const reservationMeta = thread.reservation?.reservationNumber
                ? `Reserva ${thread.reservation.reservationNumber}`
                : thread.reservation
                  ? `${thread.reservation.checkIn.toISOString().slice(0, 10)} - ${thread.reservation.checkOut
                      .toISOString()
                      .slice(0, 10)}`
                  : 'Sin reserva asociada';

              return (
                <Link
                  key={thread.id}
                  href={`?threadId=${thread.id}`}
                  className="block rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {hostName.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="truncate font-semibold text-slate-900">{hostName}</p>
                    </div>
                    {lastMessageDate ? <span className="text-[11px] text-slate-400">{lastMessageDate}</span> : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{listingTitle}</p>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    {context.type === 'activity' ? <Ticket className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                    <span>{context.label}</span>
                  </div>
                  <p className="truncate text-[11px] text-slate-400">{reservationMeta}</p>
                  {lastMessage && (
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {lastMessage.sender.profile?.name || lastMessage.sender.email}: {lastMessage.body}
                    </p>
                  )}
                  {unreadCount > 0 && (
                    <span className="mt-2 inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                      No leido ({unreadCount})
                    </span>
                  )}
                </Link>
              );
            })}
            {filteredThreads.length === 0 && <p className="text-sm text-slate-500">Sin conversaciones para ese filtro.</p>}
          </div>
        </aside>
        <section className="surface-card flex min-h-[58vh] min-h-0 flex-col overflow-hidden p-0 lg:h-full">
          <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/95 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-slate-900">{selectedHostName}</p>
            <p className="text-xs text-slate-500">
              {selectedContext.label} · {selectedListingTitle}
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <ChatClient initialThreadId={selected} currentUserId={userId} currentUserName={userName} />
          </div>
          <div className="border-t border-slate-200/70 bg-white p-4 lg:hidden">
            <h2 className="text-base font-semibold text-slate-900">Reserva</h2>
            {selectedThread?.reservation ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{selectedThread.reservation.listing.title}</p>
                <p>{selectedThread.reservation.checkIn.toISOString().slice(0, 10)} - {selectedThread.reservation.checkOut.toISOString().slice(0, 10)}</p>
                <p>{selectedThread.reservation.guestsCount} huespedes</p>
                <p>Total: USD {Number(selectedThread.reservation.total).toFixed(2)}</p>
                {reservationWorkflowStatus === 'awaiting_payment' && (
                  <ClientReservationPaymentActions
                    reservationId={selectedThread.reservation.id}
                    paymentExpiresAt={
                      selectedThread.reservation.paymentExpiresAt?.toISOString() ||
                      selectedThread.reservation.holdExpiresAt?.toISOString() ||
                      null
                    }
                  />
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Sin reserva asociada.</p>
            )}
            {visibleOffer && (
              <div className="mt-3">
                <ClientOfferActions
                  threadId={selectedThreadId}
                  offerId={visibleOffer.id}
                  offerTotal={Number(visibleOffer.clientTotal)}
                  offerStatus={visibleOffer.status}
                  listingTitle={selectedListingTitle}
                  checkIn={visibleOffer.checkIn.toISOString().slice(0, 10)}
                  checkOut={visibleOffer.checkOut.toISOString().slice(0, 10)}
                  guestsCount={visibleOffer.guestsCount}
                />
              </div>
            )}
          </div>
        </section>
        <aside className="surface-card hidden h-full min-h-0 flex-col overflow-y-auto lg:flex">
          <h2 className="text-lg font-semibold text-slate-900">Reserva</h2>
          {selectedThread?.reservation ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{selectedThread.reservation.listing.title}</p>
              <p>{selectedThread.reservation.checkIn.toISOString().slice(0, 10)} - {selectedThread.reservation.checkOut.toISOString().slice(0, 10)}</p>
              <p>{selectedThread.reservation.guestsCount} huespedes</p>
              {selectedThread.reservation.reservationNumber ? (
                <p>Nro reserva: {selectedThread.reservation.reservationNumber}</p>
              ) : null}
              <p>
                Estado:{' '}
                {reservationStatusLabel(
                  reservationWorkflowStatus === 'pending_approval'
                    ? 'PENDING_APPROVAL'
                    : reservationWorkflowStatus === 'awaiting_payment'
                      ? 'AWAITING_PAYMENT'
                      : reservationWorkflowStatus === 'expired'
                        ? 'EXPIRED'
                        : reservationWorkflowStatus === 'rejected'
                          ? 'REJECTED'
                          : selectedThread.reservation.status
                )}
              </p>
              <p>Total: USD {Number(selectedThread.reservation.total).toFixed(2)}</p>
              {reservationWorkflowStatus === 'awaiting_payment' && (
                <ClientReservationPaymentActions
                  reservationId={selectedThread.reservation.id}
                  paymentExpiresAt={
                    selectedThread.reservation.paymentExpiresAt?.toISOString() ||
                    selectedThread.reservation.holdExpiresAt?.toISOString() ||
                    null
                  }
                />
              )}
              {visibleOffer && (
                <ClientOfferActions
                  threadId={selectedThreadId}
                  offerId={visibleOffer.id}
                  offerTotal={Number(visibleOffer.clientTotal)}
                  offerStatus={visibleOffer.status}
                  listingTitle={selectedListingTitle}
                  checkIn={visibleOffer.checkIn.toISOString().slice(0, 10)}
                  checkOut={visibleOffer.checkOut.toISOString().slice(0, 10)}
                  guestsCount={visibleOffer.guestsCount}
                />
              )}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-500">
              <p>Selecciona una conversacion para ver detalles.</p>
              {visibleOffer && (
                <ClientOfferActions
                  threadId={selectedThreadId}
                  offerId={visibleOffer.id}
                  offerTotal={Number(visibleOffer.clientTotal)}
                  offerStatus={visibleOffer.status}
                  listingTitle={selectedListingTitle}
                  checkIn={visibleOffer.checkIn.toISOString().slice(0, 10)}
                  checkOut={visibleOffer.checkOut.toISOString().slice(0, 10)}
                  guestsCount={visibleOffer.guestsCount}
                />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
