import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ChatClient } from '@/components/chat-client';
import { HostMessageActions } from '@/components/host-message-actions';
import Link from 'next/link';

const statusLabel = (thread: any) => {
  if (thread.reservation) {
    return `Reserva · ${thread.reservation.status}`;
  }
  if (thread.status === 'OFFER') return 'Oferta enviada';
  if (thread.status === 'PREAPPROVED') return 'Preaprobado';
  if (thread.status === 'REJECTED') return 'Rechazado';
  return 'Consulta';
};

export default async function HostMessagesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const userName = (session?.user as any)?.name || (session?.user as any)?.email || 'Usuario';

  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId } } },
    include: {
      reservation: { include: { listing: true, user: true } },
      participants: { include: { user: { include: { profile: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });
  const selected = typeof searchParams.threadId === 'string' ? searchParams.threadId : threads[0]?.id;
  const selectedThread = threads.find((t) => t.id === selected);

  const guest = selectedThread?.participants.find((p) => p.userId !== userId);
  const guestName = guest?.user.profile?.name || guest?.user.email || 'Huesped';

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Mensajeria</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr_360px]">
        <aside className="surface-card p-4">
          <h2 className="text-lg font-semibold text-slate-900">Conversaciones</h2>
          <div className="mt-4 space-y-2">
            {threads.map((thread) => {
              const other = thread.participants.find((p) => p.userId !== userId);
              const otherName = other?.user.profile?.name || other?.user.email || 'Huesped';
              return (
                <Link key={thread.id} href={`?threadId=${thread.id}`} className="block rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 hover:bg-slate-100">
                  <p className="font-semibold text-slate-900">{thread.reservation?.listing.title || otherName}</p>
                  <p className="text-xs text-slate-500">{statusLabel(thread)}</p>
                </Link>
              );
            })}
            {threads.length === 0 && <p className="text-sm text-slate-500">Sin mensajes.</p>}
          </div>
        </aside>
        <div className="surface-card">
          <ChatClient initialThreadId={selected} currentUserId={userId} currentUserName={userName} />
        </div>
        <aside className="surface-card space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Estado</h2>
            <p className="mt-2 text-sm text-slate-600">{selectedThread ? statusLabel(selectedThread) : 'Selecciona una conversacion'}</p>
            {selectedThread?.offerTotal && (
              <p className="mt-2 text-xs text-slate-500">
                Oferta: USD {Number(selectedThread.offerTotal).toFixed(2)}{selectedThread.offerExpiresAt ? ` · vence ${selectedThread.offerExpiresAt.toISOString().slice(0, 10)}` : ''}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">Acciones</h3>
            <HostMessageActions threadId={selected} />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">Reserva</h3>
            {selectedThread?.reservation ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{selectedThread.reservation.listing.title}</p>
                <p>{selectedThread.reservation.checkIn.toISOString().slice(0, 10)} - {selectedThread.reservation.checkOut.toISOString().slice(0, 10)}</p>
                <p>{selectedThread.reservation.guestsCount} huespedes</p>
                <p>Estado: {selectedThread.reservation.status}</p>
                <p>Total: USD {Number(selectedThread.reservation.total).toFixed(2)}</p>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">
                Consulta sin reserva. {guestName}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
