'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type TicketRow = {
  id: string;
  subject: string;
  status: string;
  requester: string;
  lastMessage: string;
};

export const SupportInbox = ({ tickets }: { tickets: TicketRow[] }) => {
  const [csrf, setCsrf] = useState('');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const sendReply = async (id: string) => {
    await fetch(`/api/tickets/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ message: replyMap[id] })
    });
    setReplyMap((prev) => ({ ...prev, [id]: '' }));
    alert('Respuesta enviada');
  };

  return (
    <div className="space-y-4">
      {tickets.map((t) => (
        <div key={t.id} className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{t.subject}</p>
              <p className="text-sm text-slate-500">{t.requester} - {t.status}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{t.status}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{t.lastMessage}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Input
              placeholder="Responder"
              value={replyMap[t.id] || ''}
              onChange={(e) => setReplyMap((prev) => ({ ...prev, [t.id]: e.target.value }))}
            />
            <Button onClick={() => sendReply(t.id)}>Enviar</Button>
          </div>
        </div>
      ))}
      {tickets.length === 0 && <p className="text-sm text-slate-500">Sin tickets.</p>}
    </div>
  );
};
