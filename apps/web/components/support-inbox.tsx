'use client';

import { useEffect, useMemo, useState } from 'react';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TicketMessageRow = {
  id: string;
  body: string;
  createdAt: Date | string;
  sender: {
    email: string;
    profile?: { name?: string | null } | null;
  };
};

export type TicketRow = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdBy: {
    email: string;
    profile?: { name?: string | null } | null;
  };
  messages: TicketMessageRow[];
};

const priorityTone: Record<TicketPriority, string> = {
  LOW: 'border-slate-200 bg-slate-50 text-slate-700',
  MEDIUM: 'border-sky-200 bg-sky-50 text-sky-700',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
  URGENT: 'border-rose-200 bg-rose-50 text-rose-700'
};

const extractCategory = (subject: string) => {
  const match = subject.match(/^\[([^\]]+)\]/);
  return match?.[1] || 'General';
};

export function SupportInbox({ tickets }: { tickets: TicketRow[] }) {
  const [csrf, setCsrf] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [selectedId, setSelectedId] = useState<string>(tickets[0]?.id || '');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [statusMap, setStatusMap] = useState<Record<string, TicketStatus>>({});

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const filteredTickets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (!needle) return true;
      const requester = ticket.createdBy.profile?.name || ticket.createdBy.email;
      const category = extractCategory(ticket.subject);
      const messageBlob = ticket.messages.map((message) => message.body).join(' ');
      return [ticket.subject, requester, category, messageBlob].join(' ').toLowerCase().includes(needle);
    });
  }, [priorityFilter, query, statusFilter, tickets]);

  useEffect(() => {
    if (!filteredTickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(filteredTickets[0]?.id || '');
    }
  }, [filteredTickets, selectedId]);

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedId) || filteredTickets[0];

  const sendReply = async (id: string) => {
    const message = replyMap[id]?.trim() || '';
    const status = statusMap[id];
    if (!message && !status) return;
    await fetch(`/api/tickets/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ message, status })
    });
    window.location.reload();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="surface-card min-h-0 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Tickets</h2>
        <p className="mt-1 text-xs text-slate-500">
          Filtra por prioridad, estado, usuario o texto del caso.
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar ticket"
          className="mt-4"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(['all', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                statusFilter === status
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {status === 'all' ? 'Todos' : status}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['all', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => setPriorityFilter(priority)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                priorityFilter === priority
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {priority === 'all' ? 'Prioridad' : priority}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {filteredTickets.map((ticket) => {
            const requester = ticket.createdBy.profile?.name || ticket.createdBy.email;
            const lastMessage = ticket.messages[ticket.messages.length - 1];
            const category = extractCategory(ticket.subject);
            const selected = ticket.id === selectedTicket?.id;
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedId(ticket.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selected
                    ? 'border-slate-300 bg-white shadow-sm'
                    : 'border-slate-200/70 bg-slate-50/80 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{ticket.subject}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityTone[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{requester}</p>
                <p className="text-[11px] text-slate-400">
                  {category} · {ticket.status}
                </p>
                {lastMessage ? (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{lastMessage.body}</p>
                ) : null}
              </button>
            );
          })}
          {filteredTickets.length === 0 ? (
            <p className="text-sm text-slate-500">No hay tickets para ese filtro.</p>
          ) : null}
        </div>
      </aside>

      {selectedTicket ? (
        <section className="surface-card min-h-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {extractCategory(selectedTicket.subject)}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">{selectedTicket.subject}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedTicket.createdBy.profile?.name || selectedTicket.createdBy.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityTone[selectedTicket.priority]}`}>
                {selectedTicket.priority}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {selectedTicket.status}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">Timeline del caso</p>
            <div className="mt-4 space-y-3">
              {selectedTicket.messages.map((message) => {
                const sender = message.sender.profile?.name || message.sender.email;
                const createdAt = new Date(message.createdAt);
                return (
                  <div key={message.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{sender}</p>
                      <p className="text-xs text-slate-400">
                        {createdAt.toLocaleString('es-AR')}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{message.body}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_140px]">
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
              value={statusMap[selectedTicket.id] || selectedTicket.status}
              onChange={(event) =>
                setStatusMap((prev) => ({
                  ...prev,
                  [selectedTicket.id]: event.target.value as TicketStatus
                }))
              }
            >
              {(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Input
              placeholder="Responder o dejar seguimiento"
              value={replyMap[selectedTicket.id] || ''}
              onChange={(event) =>
                setReplyMap((prev) => ({ ...prev, [selectedTicket.id]: event.target.value }))
              }
            />
            <Button onClick={() => sendReply(selectedTicket.id)}>Actualizar</Button>
          </div>
        </section>
      ) : (
        <div className="surface-card text-sm text-slate-500">Sin tickets.</div>
      )}
    </div>
  );
}
