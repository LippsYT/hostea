'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { HostAutomationKey, HostMessagingConfig } from '@/lib/host-messaging-config';

const defaultConfig: HostMessagingConfig = {
  quickReplies: [],
  automations: {
    inquiry: { enabled: true, templateId: null },
    reservation_confirmed: { enabled: true, templateId: null },
    pre_checkin: { enabled: true, templateId: null },
    post_checkout: { enabled: false, templateId: null }
  },
  suspicious: {
    keywords: ['pagar directo'],
    autoReplyEnabled: true,
    autoReplyMessage: 'Por seguridad, toda reserva y pago debe completarse dentro de Hostea.'
  }
};

const automationLabels: Record<HostAutomationKey, string> = {
  inquiry: 'Consulta',
  reservation_confirmed: 'Reserva confirmada',
  pre_checkin: 'Antes del check-in',
  post_checkout: 'Despues del check-out'
};

export const HostMessageAutomationsSettings = () => {
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
        if (data.config) setConfig(data.config);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const templateOptions = useMemo(
    () =>
      config.quickReplies
        .filter((reply) => reply.enabled)
        .map((reply) => ({ id: reply.id, label: reply.label })),
    [config.quickReplies]
  );

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/host/messages/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrf
        },
        body: JSON.stringify(config)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tone: 'error', message: data.error || 'No se pudo guardar.' });
        return;
      }
      setConfig(data.config || config);
      setFeedback({ tone: 'ok', message: 'Automatizaciones guardadas.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Automatizaciones de mensajes</h2>
          <p className="text-xs text-slate-500">
            Activa o desactiva cada evento y elige la plantilla a enviar.
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={loading || saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      {feedback ? (
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            feedback.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="space-y-3">
        {(Object.keys(config.automations) as HostAutomationKey[]).map((key) => (
          <div key={key} className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{automationLabels[key]}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={config.automations[key].enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      automations: {
                        ...prev.automations,
                        [key]: {
                          ...prev.automations[key],
                          enabled: e.target.checked
                        }
                      }
                    }))
                  }
                />
                Activa
              </label>
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Plantilla asociada
              </p>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                value={config.automations[key].templateId || ''}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    automations: {
                      ...prev.automations,
                      [key]: {
                        ...prev.automations[key],
                        templateId: e.target.value || null
                      }
                    }
                  }))
                }
              >
                <option value="">Sin plantilla</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
