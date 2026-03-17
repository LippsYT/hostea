'use client';

import { useEffect, useMemo, useState } from 'react';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatSupportCaseNumber, ticketStatusLabel } from '@/lib/support';

const categories = [
  'Problema de acceso',
  'Problema con la reserva',
  'Cambio de fechas',
  'Cancelacion',
  'Reembolso',
  'Cobro duplicado',
  'Problema con actividad',
  'Anfitrion no responde',
  'Problema tecnico de la cuenta'
];

type TicketMessageRow = {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    email: string;
    profile?: { name?: string | null } | null;
  };
};

type TicketRow = {
  id: string;
  caseSequence: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessageRow[];
};

const priorityTone: Record<TicketPriority, string> = {
  LOW: 'border-slate-200 bg-slate-50 text-slate-700',
  MEDIUM: 'border-sky-200 bg-sky-50 text-sky-700',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
  URGENT: 'border-rose-200 bg-rose-50 text-rose-700'
};

const inferPriority = (message: string): TicketPriority => {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('no puedo entrar') ||
    normalized.includes('me cobraron dos veces') ||
    normalized.includes('la propiedad no existe')
  ) {
    return 'URGENT';
  }
  if (normalized.includes('hoy') || normalized.includes('manana')) {
    return 'HIGH';
  }
  return 'MEDIUM';
};

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [csrf, setCsrf] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [reference, setReference] = useState('');
  const [feedback, setFeedback] = useState('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [requiresLogin, setRequiresLogin] = useState(false);

  const loadTickets = async () => {
    const [csrfRes, ticketsRes] = await Promise.all([
      fetch('/api/security/csrf'),
      fetch('/api/tickets', { cache: 'no-store' })
    ]);

    if (csrfRes.ok) {
      const csrfData = await csrfRes.json();
      setCsrf(csrfData.token || '');
    }

    if (ticketsRes.status === 401) {
      setRequiresLogin(true);
      return;
    }

    if (!ticketsRes.ok) return;
    setRequiresLogin(false);
    const data = await ticketsRes.json();
    const nextTickets = (data.tickets || []) as TicketRow[];
    setTickets(nextTickets);
    setSelectedId((current) =>
      current && nextTickets.some((ticket) => ticket.id === current) ? current : nextTickets[0]?.id || ''
    );
  };

  useEffect(() => {
    loadTickets().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open || requiresLogin) return;
    loadTickets().catch(() => undefined);
    const timer = window.setInterval(() => {
      loadTickets().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [open, requiresLogin]);

  const priority = useMemo(() => inferPriority(message), [message]);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) || tickets[0] || null;

  const submit = async () => {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({
        subject,
        message,
        category,
        reference,
        priority
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setRequiresLogin(true);
      setFeedback('Inicia sesion para abrir un caso.');
      return;
    }
    if (!res.ok) {
      setFeedback(data?.error || 'No se pudo crear el ticket.');
      return;
    }
    setSubject('');
    setMessage('');
    setReference('');
    setTickets((current) => [data.ticket as TicketRow, ...current]);
    setSelectedId((data.ticket as TicketRow).id);
    setFeedback(`Caso ${formatSupportCaseNumber((data.ticket as TicketRow).caseSequence)} creado correctamente.`);
  };

  const sendReply = async (ticketId: string) => {
    const nextMessage = (replyMap[ticketId] || '').trim();
    if (!nextMessage) return;

    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ message: nextMessage })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFeedback(data?.error || 'No se pudo enviar la respuesta.');
      return;
    }

    const updated = data.ticket as TicketRow;
    setTickets((current) => current.map((ticket) => (ticket.id === ticketId ? updated : ticket)));
    setReplyMap((current) => ({ ...current, [ticketId]: '' }));
    setFeedback(`Respuesta enviada en ${formatSupportCaseNumber(updated.caseSequence)}.`);
  };

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 sm:left-auto sm:right-6">
      {open ? (
        <div className="mb-3 ml-auto w-full max-w-5xl rounded-3xl border border-neutral-100 bg-white p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Soporte HOSTEA</h4>
              <p className="mt-1 text-xs text-slate-500">
                Abre un caso y sigue las respuestas del operador en tiempo real.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cerrar soporte
            </Button>
          </div>

          {requiresLogin ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Inicia sesion para crear y seguir tickets.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-900">Nuevo caso</p>
                  <div className="mt-3 space-y-2">
                    <select
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Asunto"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    />
                    <Input
                      placeholder="Reserva, pago o referencia"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                    />
                    <Textarea
                      placeholder="Describe el problema. Si es urgente, indica que paso y desde cuando."
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      Prioridad detectada: <span className="font-semibold text-slate-900">{priority}</span>
                    </div>
                    <Button className="w-full" onClick={submit}>
                      Enviar ticket
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Mis casos</p>
                    <span className="text-xs text-slate-500">{tickets.length} activos</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedId(ticket.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          selectedTicket?.id === ticket.id
                            ? 'border-slate-300 bg-slate-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              {formatSupportCaseNumber(ticket.caseSequence)}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{ticket.subject}</p>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityTone[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{ticketStatusLabel(ticket.status)}</p>
                      </button>
                    ))}
                    {tickets.length === 0 ? (
                      <p className="text-sm text-slate-500">Todavia no abriste casos.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                {selectedTicket ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatSupportCaseNumber(selectedTicket.caseSequence)}
                        </p>
                        <h5 className="mt-1 text-lg font-semibold text-slate-900">{selectedTicket.subject}</h5>
                        <p className="mt-1 text-sm text-slate-500">{ticketStatusLabel(selectedTicket.status)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityTone[selectedTicket.priority]}`}>
                        {selectedTicket.priority}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      {selectedTicket.messages.map((ticketMessage) => {
                        const senderName = ticketMessage.sender.profile?.name || ticketMessage.sender.email;
                        return (
                          <div key={ticketMessage.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{senderName}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(ticketMessage.createdAt).toLocaleString('es-AR')}
                              </p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{ticketMessage.body}</p>
                          </div>
                        );
                      })}
                    </div>

                    {selectedTicket.summary ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Resumen final: {selectedTicket.summary}
                      </div>
                    ) : null}

                    {selectedTicket.status !== 'CLOSED' ? (
                      <div className="mt-4 flex gap-2">
                        <Input
                          placeholder="Responder al operador"
                          value={replyMap[selectedTicket.id] || ''}
                          onChange={(event) =>
                            setReplyMap((current) => ({
                              ...current,
                              [selectedTicket.id]: event.target.value
                            }))
                          }
                        />
                        <Button onClick={() => sendReply(selectedTicket.id)}>Enviar</Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Selecciona un caso para ver el historial.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
      {feedback ? (
        <div className="mb-3 ml-auto max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {feedback}
        </div>
      ) : null}
      <Button onClick={() => setOpen((current) => !current)}>
        {open ? 'Cerrar soporte' : 'Ayuda / soporte'}
      </Button>
    </div>
  );
}
