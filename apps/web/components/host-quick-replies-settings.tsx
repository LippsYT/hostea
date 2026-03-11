'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { HostMessagingConfig, HostQuickReply } from '@/lib/host-messaging-config';
import { Plus, Search, Star, Trash2 } from 'lucide-react';

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

const createTemplate = (): HostQuickReply => ({
  id: `tpl-${Math.random().toString(36).slice(2, 10)}`,
  label: 'Nueva plantilla',
  body: '',
  category: 'General',
  favorite: false,
  enabled: true
});

export const HostQuickRepliesSettings = () => {
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const [config, setConfig] = useState<HostMessagingConfig>(defaultConfig);
  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf')
      .then(async (res) => res.json())
      .then((data) => setCsrf(data.token))
      .catch(() => undefined);

    fetch('/api/host/messages/config')
      .then(async (res) => res.json())
      .then((data) => {
        if (data.config) {
          setConfig(data.config);
          if (data.config.quickReplies?.length) {
            setSelectedId(data.config.quickReplies[0].id);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const filteredTemplates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return config.quickReplies;
    return config.quickReplies.filter((reply) =>
      `${reply.label} ${reply.category} ${reply.body}`.toLowerCase().includes(needle)
    );
  }, [config.quickReplies, search]);

  const selectedTemplate =
    config.quickReplies.find((reply) => reply.id === selectedId) || config.quickReplies[0] || null;

  useEffect(() => {
    if (!selectedTemplate) return;
    if (!selectedId) setSelectedId(selectedTemplate.id);
  }, [selectedTemplate, selectedId]);

  const updateTemplate = (templateId: string, updater: (current: HostQuickReply) => HostQuickReply) => {
    setConfig((prev) => ({
      ...prev,
      quickReplies: prev.quickReplies.map((item) =>
        item.id === templateId ? updater(item) : item
      )
    }));
  };

  const addTemplate = () => {
    const next = createTemplate();
    setConfig((prev) => ({ ...prev, quickReplies: [next, ...prev.quickReplies] }));
    setSelectedId(next.id);
  };

  const removeTemplate = (templateId: string) => {
    setConfig((prev) => {
      const replies = prev.quickReplies.filter((item) => item.id !== templateId);
      return { ...prev, quickReplies: replies };
    });
    setSelectedId((prev) => (prev === templateId ? '' : prev));
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        ...config,
        quickReplies: config.quickReplies.map((reply) => ({
          ...reply,
          label: reply.label.trim(),
          category: (reply.category || 'General').trim() || 'General',
          body: reply.body.trim()
        }))
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
        setFeedback({ tone: 'error', message: data.error || 'No se pudo guardar.' });
        return;
      }
      setConfig(data.config || payload);
      setFeedback({ tone: 'ok', message: 'Plantillas guardadas.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Plantillas de respuestas rapidas</h2>
          <p className="text-xs text-slate-500">
            Variables disponibles: {'{guest_name}'} {'{property_name}'} {'{check_in}'} {'{check_out}'} {'{booking_code}'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addTemplate}>
            <Plus className="mr-1 h-4 w-4" />
            Nueva plantilla
          </Button>
          <Button size="sm" onClick={save} disabled={loading || saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plantilla"
              className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  selectedTemplate?.id === template.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{template.label}</p>
                  {template.favorite ? <Star className="h-3.5 w-3.5 fill-current" /> : null}
                </div>
                <p className="mt-1 text-[11px] opacity-80">{template.category || 'General'}</p>
              </button>
            ))}
            {!filteredTemplates.length ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500">
                No hay plantillas para ese filtro.
              </p>
            ) : null}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200/70 bg-white p-4">
          {selectedTemplate ? (
            <div className="space-y-3">
              <Input
                value={selectedTemplate.label}
                placeholder="Nombre de plantilla"
                onChange={(e) =>
                  updateTemplate(selectedTemplate.id, (current) => ({
                    ...current,
                    label: e.target.value
                  }))
                }
              />
              <Input
                value={selectedTemplate.category}
                placeholder="Categoria"
                onChange={(e) =>
                  updateTemplate(selectedTemplate.id, (current) => ({
                    ...current,
                    category: e.target.value
                  }))
                }
              />
              <Textarea
                rows={9}
                value={selectedTemplate.body}
                placeholder="Escribe el contenido de la plantilla"
                onChange={(e) =>
                  updateTemplate(selectedTemplate.id, (current) => ({
                    ...current,
                    body: e.target.value
                  }))
                }
              />
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTemplate.enabled}
                    onChange={(e) =>
                      updateTemplate(selectedTemplate.id, (current) => ({
                        ...current,
                        enabled: e.target.checked
                      }))
                    }
                  />
                  Activa
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTemplate.favorite}
                    onChange={(e) =>
                      updateTemplate(selectedTemplate.id, (current) => ({
                        ...current,
                        favorite: e.target.checked
                      }))
                    }
                  />
                  Favorita
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"
                  onClick={() => removeTemplate(selectedTemplate.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar plantilla
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Crea o selecciona una plantilla para editarla.</p>
          )}
        </section>
      </div>
    </div>
  );
};
