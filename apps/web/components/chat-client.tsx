'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emitInAppNotificationSound } from '@/lib/in-app-notification-sound';

let socket: ReturnType<typeof io> | null = null;

type Message = {
  id: string;
  body: string;
  createdAt: string;
  seenAt?: string | null;
  senderId: string;
  senderName: string;
};

export const ChatClient = ({
  initialThreadId,
  currentUserId,
  currentUserName
}: {
  initialThreadId?: string;
  currentUserId: string;
  currentUserName: string;
}) => {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [csrf, setCsrf] = useState('');
  const [typingName, setTypingName] = useState('');
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

  if (!threadId) {
    return <div className="text-sm text-slate-500">Selecciona una conversacion.</div>;
  }

  return (
    <div className="flex h-[620px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-3xl border border-slate-200/70 bg-white/80 p-4">
        {grouped.map((msg) => {
          const mine = msg.senderId === currentUserId;
          const createdAt = new Date(msg.createdAt);
          const timeLabel = Number.isNaN(createdAt.getTime())
            ? ''
            : createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`${mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'} max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm`}>
                {!mine && <p className="mb-1 text-[11px] font-semibold text-slate-500">{msg.senderName}</p>}
                <p>{msg.body}</p>
                <div className={`mt-1 flex items-center gap-2 text-[11px] ${mine ? 'text-slate-300' : 'text-slate-500'}`}>
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
      <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/90 p-3">
        <div className="flex gap-2">
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
    </div>
  );
};
