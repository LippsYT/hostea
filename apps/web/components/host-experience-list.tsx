'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ExperienceItem = {
  id: string;
  title: string;
  city: string;
  status: string;
  capacity: number;
  bookingsCount: number;
  pricePerPerson: number;
  photoUrl: string | null;
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'Activa';
    case 'PAUSED':
      return 'Pausada';
    case 'DELETED':
      return 'Eliminada';
    default:
      return 'Borrador';
  }
};

const statusClass = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PAUSED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'DELETED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const statusPriority = (status: string) => {
  if (status === 'ACTIVE') return 0;
  if (status === 'PAUSED') return 1;
  if (status === 'DELETED') return 2;
  return 3;
};

export const HostExperienceList = ({
  initial,
  notice
}: {
  initial: ExperienceItem[];
  notice?: string | null;
}) => {
  const [items, setItems] = useState(initial);
  const [csrf, setCsrf] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'DELETED'>('ALL');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const updateStatus = async (id: string, status: 'ACTIVE' | 'PAUSED') => {
    setBusyId(id);
    const res = await fetch(`/api/host/experiences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || 'No se pudo actualizar la actividad.');
      setBusyId(null);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: data.experience.status } : item))
    );
    setBusyId(null);
  };

  const onDelete = async (id: string) => {
    const ok = confirm('Eliminar esta actividad? Se ocultara del marketplace.');
    if (!ok) return;
    setBusyId(id);
    const res = await fetch(`/api/host/experiences/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf }
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || 'No se pudo eliminar la actividad.');
      setBusyId(null);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: data.experience.status } : item))
    );
    setBusyId(null);
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...items]
      .filter((item) => (statusFilter === 'ALL' ? true : item.status === statusFilter))
      .filter((item) => {
        if (!normalizedSearch) return true;
        return [item.title, item.city].join(' ').toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => statusPriority(a.status) - statusPriority(b.status));
  }, [items, search, statusFilter]);

  return (
    <div className="space-y-5">
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Actividades</h2>
            <p className="text-sm text-slate-500">Administra tus experiencias y su estado.</p>
          </div>
          <Link href="/dashboard/host/explore/new" className="pill-link">
            + Crear actividad
          </Link>
        </div>
      </div>

      <div className="surface-card">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-11 min-w-[220px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-900/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por titulo o ciudad"
          />
          {(['ALL', 'ACTIVE', 'PAUSED', 'DELETED'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === filter
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {filter === 'ALL' ? 'Todas' : statusLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((experience) => (
          <article
            key={experience.id}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft"
          >
            <div className="relative aspect-[16/10] bg-slate-100">
              {experience.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={experience.photoUrl} alt={experience.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-medium text-slate-500">
                  Sin imagen
                </div>
              )}
            </div>

            <div className="space-y-3 p-4">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(experience.status)}`}>
                {statusLabel(experience.status)}
              </span>

              <h3
                className="text-base font-semibold leading-6 text-slate-900"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {experience.title}
              </h3>

              <p className="text-sm text-slate-500">{experience.city || 'Sin ubicacion'}</p>

              <div className="flex items-center justify-between text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  Capacidad {experience.capacity}
                </span>
                <span className="font-semibold text-slate-900">
                  USD {experience.pricePerPerson.toFixed(2)}
                </span>
              </div>

              <div className="text-xs text-slate-500">Reservas: {experience.bookingsCount}</div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/host/explore/activities/${experience.id}`} className="pill-link">
                  Editar
                </Link>
                <Link href={`/explorar/${experience.id}`} className="pill-link">
                  Ver
                </Link>
                {experience.status !== 'DELETED' && (
                  <button
                    className="pill-link"
                    disabled={busyId === experience.id}
                    onClick={() =>
                      updateStatus(
                        experience.id,
                        experience.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED'
                      )
                    }
                  >
                    {experience.status === 'PAUSED' ? 'Activar' : 'Pausar'}
                  </button>
                )}
                {experience.status !== 'DELETED' && (
                  <button
                    className="pill-link text-rose-600"
                    disabled={busyId === experience.id}
                    onClick={() => onDelete(experience.id)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="surface-card text-sm text-slate-500">
          No hay actividades para ese filtro.
        </div>
      )}
    </div>
  );
};
