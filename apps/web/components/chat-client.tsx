'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

let socket: ReturnType<typeof io> | null = null;

type Message = {
  id: string;
  body: string;
  createdAt: string;
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

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  useEffect(() => {
    socket = io({ path: '/socket.io' });
    socket.on('message:new', (message: Message) => {
      setMessages((prev) => [...prev, message]);
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
    if (!threadId || !body) return;
    const res = await fetch(`/api/messages/${threadId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ body })
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
    <div className="flex h-[520px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-3xl border border-slate-200/70 bg-white/80 p-4">
        {grouped.map((msg) => {
          const mine = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`${mine ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'} max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm`}>
                {!mine && <p className="mb-1 text-[11px] font-semibold text-slate-500">{msg.senderName}</p>}
                <p>{msg.body}</p>
              </div>
            </div>
          );
        })}
        {typingName && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{typingName} esta escribiendo</span>
            <span className="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/90 p-3">
        <div className="flex gap-2">
          <Input value={body} onChange={(e) => onChangeBody(e.target.value)} placeholder="Escribe un mensaje" />
          <Button onClick={send}>Enviar</Button>
        </div>
      </div>
    </div>
  );
};
