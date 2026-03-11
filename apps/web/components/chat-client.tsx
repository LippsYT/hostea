'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emitInAppNotificationSound } from '@/lib/in-app-notification-sound';
import { MessageSquareQuote, Search, Star, X } from 'lucide-react';

let socket: ReturnType<typeof io> | null = null;

type Message = {
  id: string;
  body: string;
  createdAt: string;
  seenAt?: string | null;
  senderId: string;
  senderName: string;
};

type QuickReply = {
  id: string;
  label: string;
  body: string;
  category: string;
  favorite: boolean;
  enabled: boolean;
};

const fillTemplate = (template: string, variables?: Record<string, string>) => {
  if (!variables) return template;
  return Object.entries(variables).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, value || '');
  }, template);
};

export const ChatClient = ({
  initialThreadId,
  currentUserId,
  currentUserName,
  quickReplies,
  quickReplyVariables
}: {
  initialThreadId?: string;
  currentUserId: string;
  currentUserName: string;
  quickReplies?: QuickReply[];
  quickReplyVariables?: Record<string, string>;
}) => {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [csrf, setCsrf] = useState('');
  const [typingName, setTypingName] = useState('');
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [quickReplyCategory, setQuickReplyCategory] = useState('all');
  const [quickReplyOnlyFavorites, setQuickReplyOnlyFavorites] = useState(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  useEffect(() => {
    socket = io({ path: '/socket.io' });
    socket.on('message:new', (message: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (message.senderId !== currentUserId) {
        emitInAppNotificationSound('message');
      }
    });
    socket.on('typing', (payload: { name: string; userId: string; isTyping: boolean }) => {
      if (payload.userId === currentUserId) return;
      setTypingName(payload.isTyping ? payload.name : '');
    });
    return () => {
      socket?.disconnect();
    };
  }, [currentUserId]);

  useEffect(() => {
    setThreadId(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    if (!threadId) return;
    fetch(`/api/messages/${threadId}`).then(async (res) => {
      const data = await res.json();
      setMessages(data.messages || []);
    });
    socket?.emit('join-thread', threadId);
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typingName]);

  useEffect(() => {
    if (!quickReplyOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickReplyOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [quickReplyOpen]);

  const sendTyping = (isTyping: boolean) => {
    if (!threadId) return;
    socket?.emit('typing', { threadId, name: currentUserName, userId: currentUserId, isTyping });
  };

  const onChangeBody = (value: string) => {
    setBody(value);
    sendTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      sendTyping(false);
    }, 900);
  };

  const send = async () => {
    if (!threadId || !body.trim()) return;
    const res = await fetch(`/api/messages/${threadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ body: body.trim() })
    });
    const data = await res.json();
    if (data.message) {
      setBody('');
      sendTyping(false);
    }
  };

  const grouped = useMemo(() => messages, [messages]);
  const enabledQuickReplies = useMemo(
    () => (quickReplies || []).filter((reply) => reply.enabled),
    [quickReplies]
  );
  const quickReplyCategories = useMemo(
    () =>
      Array.from(
        new Set(enabledQuickReplies.map((reply) => reply.category?.trim() || 'General'))
      ),
    [enabledQuickReplies]
  );
  const visibleQuickReplies = useMemo(() => {
    const needle = quickReplySearch.trim().toLowerCase();
    return enabledQuickReplies.filter((reply) => {
      const byCategory =
        quickReplyCategory === 'all' || (reply.category || 'General') === quickReplyCategory;
      if (!byCategory) return false;
      if (quickReplyOnlyFavorites && !reply.favorite) return false;
      if (!needle) return true;
      return `${reply.label} ${reply.body} ${reply.category}`.toLowerCase().includes(needle);
    });
  }, [enabledQuickReplies, quickReplyCategory, quickReplyOnlyFavorites, quickReplySearch]);

  if (!threadId) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center text-sm text-slate-500">
        Selecciona una conversacion.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {grouped.map((msg) => {
          const mine = msg.senderId === currentUserId;
          const createdAt = new Date(msg.createdAt);
          const timeLabel = Number.isNaN(createdAt.getTime())
            ? ''
            : createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`${
                  mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'
                } max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm`}
              >
                {!mine && (
                  <p className="mb-1 text-[11px] font-semibold text-slate-500">{msg.senderName}</p>
                )}
                <p>{msg.body}</p>
                <div
                  className={`mt-1 flex items-center gap-2 text-[11px] ${
                    mine ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  <span>{timeLabel}</span>
                  {mine && <span>{msg.seenAt ? 'Leido' : 'Enviado'}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {typingName && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{typingName} esta escribiendo</span>
            <span className="typing-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200/70 bg-white/95 p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {enabledQuickReplies.length > 0 ? (
            <button
              type="button"
              onClick={() => setQuickReplyOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="Respuestas rapidas"
            >
              <MessageSquareQuote className="h-4 w-4" />
            </button>
          ) : null}
          <Input
            value={body}
            onChange={(e) => onChangeBody(e.target.value)}
            placeholder="Escribe un mensaje"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send}>Enviar</Button>
        </div>
      </div>

      {quickReplyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="flex h-[85vh] max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900">Respuestas rapidas</p>
                <p className="text-xs text-slate-500">
                  Elige una respuesta, se inserta en el input para que puedas editarla.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setQuickReplyOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={quickReplySearch}
                  onChange={(e) => setQuickReplySearch(e.target.value)}
                  placeholder="Buscar por etiqueta, categoria o contenido"
                  className="h-10 w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setQuickReplyCategory('all')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    quickReplyCategory === 'all'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Todas
                </button>
                {quickReplyCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setQuickReplyCategory(category)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      quickReplyCategory === category
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {category}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuickReplyOnlyFavorites((prev) => !prev)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                    quickReplyOnlyFavorites
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Star className="h-3 w-3" />
                  Favoritas
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 pb-6">
                {visibleQuickReplies.map((reply) => (
                  <button
                    key={reply.id}
                    type="button"
                    onClick={() => {
                      const rendered = fillTemplate(reply.body, quickReplyVariables);
                      setBody(rendered);
                      setQuickReplyOpen(false);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{reply.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                          {reply.category || 'General'}
                        </span>
                        {reply.favorite ? (
                          <span className="text-amber-500" title="Favorita">
                            <Star className="h-3.5 w-3.5 fill-current" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{reply.body}</p>
                  </button>
                ))}
                {!visibleQuickReplies.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No hay respuestas para ese filtro.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
