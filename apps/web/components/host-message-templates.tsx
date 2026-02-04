'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Templates = {
  enabled: boolean;
  instantMessageOnConfirm: string;
  welcomeMessage: string;
};

const defaultTemplates: Templates = {
  enabled: true,
  instantMessageOnConfirm: '¡Hola {guest_name}! Tu reserva en {listing_title} quedó confirmada. Cualquier duda, escribime.',
  welcomeMessage: '¡Bienvenido/a {guest_name}! Te esperamos el {checkin_date}.'
};

export const HostMessageTemplates = () => {
  const [csrf, setCsrf] = useState('');
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Templates>(defaultTemplates);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
    fetch('/api/host/message-templates')
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates({ ...defaultTemplates, ...data.templates });
        }
      })
      .catch(() => undefined);
  }, []);

  const onSave = async () => {
    setSaving(true);
    const res = await fetch('/api/host/message-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(templates)
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      alert(data.error || 'No se pudo guardar');
      return;
    }
  };

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Mensajes automáticos</h3>
          <p className="text-xs text-slate-500">Se envían cuando una reserva se confirma.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={templates.enabled}
            onChange={(e) => setTemplates((t) => ({ ...t, enabled: e.target.checked }))}
          />
          Activar
        </label>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensaje instantáneo (confirmación)</p>
          <Textarea
            rows={3}
            value={templates.instantMessageOnConfirm}
            onChange={(e) => setTemplates((t) => ({ ...t, instantMessageOnConfirm: e.target.value }))}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensaje de bienvenida</p>
          <Textarea
            rows={3}
            value={templates.welcomeMessage}
            onChange={(e) => setTemplates((t) => ({ ...t, welcomeMessage: e.target.value }))}
          />
        </div>
        <p className="text-xs text-slate-500">
          Variables: {`{guest_name}`} · {`{checkin_date}`} · {`{checkout_date}`} · {`{listing_title}`} · {`{host_name}`}
        </p>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
};
