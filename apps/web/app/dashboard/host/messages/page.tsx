import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';
import { ChatClient } from '@/components/chat-client';
import { HostMessageActions } from '@/components/host-message-actions';
import Link from 'next/link';
import { reservationStatusBadgeClass, reservationStatusLabel } from '@/lib/reservation-status';
import { Badge } from '@/components/ui/badge';
import { expireAwaitingPaymentReservations } from '@/lib/reservation-request-flow';
import { getReservationWorkflowStatus } from '@/lib/reservation-workflow';
import { backfillReservationNumbers } from '@/lib/reservation-number';
import { Home, Ticket } from 'lucide-react';

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

const getInquiryActivityId = (subject?: string | null) =>
  subject && subject.startsWith('ACTIVITY:') ? subject.replace('ACTIVITY:', '').trim() : null;

const getThreadContext = (
  thread: any,
  inquiryListingMap: Map<string, string>
): { type: 'listing' | 'activity'; title: string; label: string } => {
  const listingTitle =
    thread.reservation?.listing?.title ||
    inquiryListingMap.get(getInquiryListingId(thread.subject) || '');
  if (listingTitle) {
    return { type: 'listing', title: listingTitle, label: 'Alojamiento' };
  }
  const activityId = getInquiryActivityId(thread.subject);
  if (activityId) {
    return { type: 'activity', title: `Actividad ${activityId}`, label: 'Actividad' };
  }
  return { type: 'listing', title: 'Consulta sin propiedad', label: 'Alojamiento' };
};

export default async function HostMessagesPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const userName = (session?.user as any)?.name || (session?.user as any)?.email || 'Usuario';

  await expireAwaitingPaymentReservations();
  await backfillReservationNumbers(prisma, 150);

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
    const other = thread.participants.find((p) => p.userId !== userId);
    const otherName = other?.user.profile?.name || '';
    const otherEmail = other?.user.email || '';
    const otherPhone = other?.user.profile?.phone || '';
    const reservationNumber = thread.reservation?.reservationNumber || '';
    const dateText = thread.reservation
      ? `${thread.reservation.checkIn.toISOString().slice(0, 10)} ${thread.reservation.checkOut
          .toISOString()
          .slice(0, 10)}`
      : '';
    return [otherName, otherEmail, otherPhone, context.title, context.label, reservationNumber, dateText]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const selected =
    typeof searchParams.threadId === 'string' ? searchParams.threadId : filteredThreads[0]?.id;
  const selectedThread = filteredThreads.find((t) => t.id === selected) || filteredThreads[0];

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

  const selectedContext = selectedThread ? getThreadContext(selectedThread, inquiryListingMap) : null;
  const selectedListingTitle = selectedContext?.title || null;

  const selectedLastMessage = selectedThread?.messages?.[0];
  const selectedLatestOffer = selectedThread?.offers?.[0];

  return (
    <div className="flex min-h-0 flex-col gap-6 lg:h-[calc(100dvh-10rem)] lg:overflow-hidden">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Mensajes</h1>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:h-full lg:gap-6 lg:overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="surface-card flex min-h-0 flex-col p-4 lg:h-full lg:overflow-hidden">
          <h2 className="text-lg font-semibold text-slate-900">Conversaciones</h2>
          <p className="mt-1 text-xs text-slate-500">Cliente, propiedad, estado y no leidos.</p>
          <form className="mt-3" method="get">
            {selectedThread?.id ? <input type="hidden" name="threadId" value={selectedThread.id} /> : null}
            {typeFilter !== 'all' ? <input type="hidden" name="type" value={typeFilter} /> : null}
            <input
              name="q"
              defaultValue={query}
              placeholder="Buscar por cliente, propiedad, reserva o fecha"
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
              const other = thread.participants.find((p) => p.userId !== userId);
              const otherName = other?.user.profile?.name || other?.user.email || 'Huesped';
              const state = getThreadState(thread);
              const listingTitle =
                getThreadContext(thread, inquiryListingMap).title;
              const context = getThreadContext(thread, inquiryListingMap);
              const lastMessage = thread.messages[0];
              const isSelected = thread.id === selected;
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
                  : 'Sin reserva';

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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {otherName.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="truncate font-semibold text-slate-900">{otherName}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${threadStateClass[state]}`}>
                      {threadStateLabel[state]}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-slate-500">{listingTitle}</p>
                    {lastMessageDate ? <span className="text-[11px] text-slate-400">{lastMessageDate}</span> : null}
                  </div>
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
          {selectedThread ? (
            <>
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white/95 p-4 backdrop-blur">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedGuestName}</p>
                  <p className="text-xs text-slate-500">
                    {selectedContext?.label || 'Alojamiento'} · {selectedListingTitle}
                  </p>
                </div>
                {selectedState && (
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${threadStateClass[selectedState]}`}>
                    {threadStateLabel[selectedState]}
                  </span>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <ChatClient
                  initialThreadId={selected}
                  currentUserId={userId}
                  currentUserName={userName}
                />
              </div>
              <div className="border-t border-slate-200/70 bg-white p-4 lg:hidden">
                <HostMessageActions
                  threadId={selected}
                  reservationStatus={reservationStatus}
                  guestPhone={selectedGuestPhone}
                  defaultCheckIn={selectedThread?.reservation?.checkIn?.toISOString().slice(0, 10) || null}
                  defaultCheckOut={selectedThread?.reservation?.checkOut?.toISOString().slice(0, 10) || null}
                  defaultGuestsCount={selectedThread?.reservation?.guestsCount || 1}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-0 items-center justify-center p-4 text-sm text-slate-500">
              Selecciona una conversacion.
            </div>
          )}
        </section>

        <aside className="surface-card hidden h-full min-h-0 flex-col space-y-5 overflow-y-auto lg:flex">
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
                {selectedThread.reservation.reservationNumber ? (
                  <p>Nro reserva: {selectedThread.reservation.reservationNumber}</p>
                ) : null}
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
