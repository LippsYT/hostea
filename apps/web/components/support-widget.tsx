'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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

const inferPriority = (message: string) => {
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

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const priority = useMemo(() => inferPriority(message), [message]);

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
    if (!res.ok) {
      setFeedback('No se pudo crear el ticket.');
      return;
    }
    setSubject('');
    setMessage('');
    setReference('');
    setFeedback('Ticket creado. Soporte recibio tu caso.');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 sm:left-auto sm:right-6">
      {open ? (
        <div className="mb-3 ml-auto w-full max-w-md rounded-3xl border border-neutral-100 bg-white p-4 shadow-soft">
          <h4 className="text-sm font-semibold text-slate-900">Soporte HOSTEA</h4>
          <p className="mt-1 text-xs text-slate-500">
            Abre un caso conectado a reservas, pagos o actividades.
          </p>
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Prioridad detectada: <span className="font-semibold text-slate-900">{priority}</span>
            </div>
            <Button className="w-full" onClick={submit}>
              Enviar ticket
            </Button>
          </div>
        </div>
      ) : null}
      {feedback ? (
        <div className="mb-3 ml-auto max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {feedback}
        </div>
      ) : null}
      <Button onClick={() => setOpen((current) => !current)}>{open ? 'Cerrar soporte' : 'Ayuda / soporte'}</Button>
    </div>
  );
}
