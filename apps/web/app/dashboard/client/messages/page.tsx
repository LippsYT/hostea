import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ChatClient } from '@/components/chat-client';
import Link from 'next/link';

export default async function ClientMessagesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const userName = (session?.user as any)?.name || (session?.user as any)?.email || 'Usuario';

  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId } } },
    include: {
      reservation: { include: { listing: true, user: true } },
      participants: { include: { user: { include: { profile: true } } } }
    }
  });
  const selected = typeof searchParams.threadId === 'string' ? searchParams.threadId : threads[0]?.id;
  const selectedThread = threads.find((t) => t.id === selected);

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Cliente</p>
        <h1 className="section-title">Mensajeria</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr_320px]">
        <aside className="surface-card p-4">
          <h2 className="text-lg font-semibold text-slate-900">Conversaciones</h2>
          <div className="mt-4 space-y-2">
            {threads.map((thread) => (
              <Link key={thread.id} href={`?threadId=${thread.id}`} className="block rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 hover:bg-slate-100">
                <p className="font-semibold text-slate-900">{thread.reservation?.listing.title || 'Soporte'}</p>
                <p className="text-xs text-slate-500">{thread.reservation?.checkIn?.toISOString().slice(0, 10) || ''}</p>
              </Link>
            ))}
            {threads.length === 0 && <p className="text-sm text-slate-500">Sin mensajes.</p>}
          </div>
        </aside>
        <div className="surface-card">
          <ChatClient initialThreadId={selected} currentUserId={userId} currentUserName={userName} />
        </div>
        <aside className="surface-card">
          <h2 className="text-lg font-semibold text-slate-900">Reserva</h2>
          {selectedThread?.reservation ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{selectedThread.reservation.listing.title}</p>
              <p>{selectedThread.reservation.checkIn.toISOString().slice(0, 10)} - {selectedThread.reservation.checkOut.toISOString().slice(0, 10)}</p>
              <p>{selectedThread.reservation.guestsCount} huespedes</p>
              <p>Estado: {selectedThread.reservation.status}</p>
              <p>Total: USD {Number(selectedThread.reservation.total).toFixed(2)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Selecciona una conversacion con reserva.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
