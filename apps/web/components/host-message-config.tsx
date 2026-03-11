'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { HostMessagingConfig, HostQuickReply } from '@/lib/host-messaging-config';

const defaultConfig: HostMessagingConfig = {
  enabled: true,
  templates: {
    inquiry:
      'Hola {guest_name}, gracias por tu consulta sobre {property_name}. Te respondo en breve.',
    reservationConfirmed:
      'Reserva confirmada para {property_name}. Check-in: {check_in}. Check-out: {check_out}.',
    preCheckIn:
      'Hola {guest_name}, te recordamos tu check-in en {property_name} para {check_in}.',
    welcome:
      'Bienvenido a {property_name}, {guest_name}. Cualquier duda me escribes por aqui.',
    checkOut:
      'Gracias por tu estadia en {property_name}. Tu check-out es {check_out}.'
  },
  quickReplies: [],
  suspicious: {
    keywords: ['pagar directo', 'efectivo', 'transferencia al alojamiento', 'por fuera', 'sin plataforma', 'whatsapp'],
    autoReplyEnabled: true,
    autoReplyMessage:
      'Por seguridad, toda reserva y pago debe completarse dentro de Hostea.'
  }
};

const createReply = (): HostQuickReply => ({
  id: `reply-${Math.random().toString(36).slice(2, 9)}`,
  label: '',
  body: ''
});

export const HostMessageConfig = () => {
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const [config, setConfig] = useState<HostMessagingConfig>(defaultConfig);

  useEffect(() => {
    fetch('/api/security/csrf')
      .then(async (res) => res.json())
      .then((data) => setCsrf(data.token))
      .catch(() => undefined);

    fetch('/api/host/messages/config')
      .then(async (res) => res.json())
      .then((data) => {
        if (data.config) {
          setConfig({
            ...defaultConfig,
            ...data.config,
            templates: { ...defaultConfig.templates, ...(data.config.templates || {}) },
            suspicious: { ...defaultConfig.suspicious, ...(data.config.suspicious || {}) },
            quickReplies: Array.isArray(data.config.quickReplies) ? data.config.quickReplies : []
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const safeReplies = useMemo(
    () => config.quickReplies.filter((reply) => reply.label.trim() && reply.body.trim()),
    [config.quickReplies]
  );

  const onSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        ...config,
        quickReplies: config.quickReplies.map((reply) => ({
          ...reply,
          label: reply.label.trim(),
          body: reply.body.trim()
        })),
        suspicious: {
          ...config.suspicious,
          keywords: config.suspicious.keywords
            .join(',')
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        }
      };

      const res = await fetch('/api/host/messages/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tone: 'error', message: data.error || 'No se pudo guardar' });
        return;
      }
      if (data.config) {
        setConfig(data.config);
      }
      setFeedback({ tone: 'ok', message: 'Configuracion guardada.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Automatizacion de mensajes</p>
          <p className="text-xs text-slate-500">
            Variables: {'{guest_name}'} {'{property_name}'} {'{check_in}'} {'{check_out}'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          Activar
        </label>
      </div>

      {feedback ? (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
            feedback.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consulta</p>
          <Textarea
            rows={2}
            disabled={loading}
            value={config.templates.inquiry}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                templates: { ...prev.templates, inquiry: e.target.value }
              }))
            }
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reserva confirmada</p>
          <Textarea
            rows={2}
            disabled={loading}
            value={config.templates.reservationConfirmed}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                templates: { ...prev.templates, reservationConfirmed: e.target.value }
              }))
            }
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre check-in</p>
          <Textarea
            rows={2}
            disabled={loading}
            value={config.templates.preCheckIn}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                templates: { ...prev.templates, preCheckIn: e.target.value }
              }))
            }
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bienvenida</p>
          <Textarea
            rows={2}
            disabled={loading}
            value={config.templates.welcome}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                templates: { ...prev.templates, welcome: e.target.value }
              }))
            }
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Check-out</p>
          <Textarea
            rows={2}
            disabled={loading}
            value={config.templates.checkOut}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                templates: { ...prev.templates, checkOut: e.target.value }
              }))
            }
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Respuestas rapidas</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setConfig((prev) => ({ ...prev, quickReplies: [...prev.quickReplies, createReply()] }))
            }
          >
            Agregar
          </Button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Se muestran en el composer del chat del host.</p>
        <div className="mt-3 space-y-2">
          {config.quickReplies.map((reply, index) => (
            <div key={reply.id} className="rounded-xl border border-slate-200 bg-white p-2">
              <div className="grid gap-2">
                <Input
                  value={reply.label}
                  placeholder={`Etiqueta ${index + 1}`}
                  onChange={(e) =>
                    setConfig((prev) => {
                      const next = [...prev.quickReplies];
                      next[index] = { ...next[index], label: e.target.value };
                      return { ...prev, quickReplies: next };
                    })
                  }
                />
                <Textarea
                  rows={2}
                  value={reply.body}
                  placeholder="Texto de respuesta"
                  onChange={(e) =>
                    setConfig((prev) => {
                      const next = [...prev.quickReplies];
                      next[index] = { ...next[index], body: e.target.value };
                      return { ...prev, quickReplies: next };
                    })
                  }
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-600"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      quickReplies: prev.quickReplies.filter((row) => row.id !== reply.id)
                    }))
                  }
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {!config.quickReplies.length ? (
            <p className="text-xs text-slate-500">Aun no agregaste respuestas rapidas.</p>
          ) : null}
        </div>
        {safeReplies.length ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Activas: {safeReplies.map((reply) => reply.label).join(', ')}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-900">Control de riesgo</p>
        <p className="mt-1 text-xs text-amber-800">
          Marcamos chats con frases de pago por fuera de la plataforma.
        </p>
        <div className="mt-2 space-y-2">
          <Input
            value={config.suspicious.keywords.join(', ')}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                suspicious: {
                  ...prev.suspicious,
                  keywords: e.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                }
              }))
            }
            placeholder="pagar directo, efectivo, por fuera"
          />
          <label className="flex items-center gap-2 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={config.suspicious.autoReplyEnabled}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  suspicious: {
                    ...prev.suspicious,
                    autoReplyEnabled: e.target.checked
                  }
                }))
              }
            />
            Enviar respuesta automatica al detectar riesgo
          </label>
          <Textarea
            rows={2}
            value={config.suspicious.autoReplyMessage}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                suspicious: {
                  ...prev.suspicious,
                  autoReplyMessage: e.target.value
                }
              }))
            }
          />
        </div>
      </div>

      <div className="mt-4">
        <Button size="sm" onClick={onSave} disabled={saving || loading}>
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </Button>
      </div>
    </div>
  );
};
