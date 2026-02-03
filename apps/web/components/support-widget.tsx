'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const SupportWidget = () => {
  const [open, setOpen] = useState(false);
  const [csrf, setCsrf] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const submit = async () => {
    await fetch('/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ subject, message })
    });
    setSubject('');
    setMessage('');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-3xl border border-neutral-100 bg-white p-4 shadow-soft">
          <h4 className="text-sm font-semibold">Soporte HOSTEA</h4>
          <div className="mt-3 space-y-2">
            <Input placeholder="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Textarea placeholder="Contanos el problema" value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button className="w-full" onClick={submit}>Enviar ticket</Button>
          </div>
        </div>
      )}
      <Button onClick={() => setOpen((o) => !o)}>{open ? 'Cerrar' : 'Soporte'}</Button>
    </div>
  );
};
