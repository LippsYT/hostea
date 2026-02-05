'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ListingItem = {
  id: string;
  title: string;
  neighborhood: string | null;
  status: string | null;
};

const statusLabel = (status?: string | null) => {
  switch (status) {
    case 'ACTIVE':
      return 'Activa';
    case 'PAUSED':
      return 'Pausada';
    case 'DELETED':
      return 'Eliminada';
    default:
      return 'Desconocida';
  }
};

const statusClass = (status?: string | null) => {
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

export const HostListingList = ({ initial }: { initial: ListingItem[] }) => {
  const [items, setItems] = useState<ListingItem[]>(initial || []);
  const [csrf, setCsrf] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const updateStatus = async (id: string, status: 'ACTIVE' | 'PAUSED' | 'DELETED') => {
    setBusyId(id);
    const res = await fetch(`/api/host/listings/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || 'No se pudo actualizar el listing.');
      setBusyId(null);
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: data.listing.status } : item)));
    setBusyId(null);
  };

  const onDelete = async (id: string) => {
    const ok = confirm('¿Eliminar este listing? Esta acción lo desactiva en el sitio.');
    if (!ok) return;
    await updateStatus(id, 'DELETED');
  };

  return (
    <div className="grid gap-3">
      {items.map((listing) => (
        <div key={listing.id} className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">{listing.title}</p>
              <p className="text-sm text-slate-500">{listing.neighborhood || 'Sin barrio'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(listing.status)}`}>
                {statusLabel(listing.status)}
              </span>
              <Link href={`/dashboard/host/listings/${listing.id}`} className="pill-link">
                Editar
              </Link>
              <Link href={`/listings/${listing.id}`} className="pill-link">
                Ver
              </Link>
              {listing.status !== 'DELETED' && (
                <button
                  className="pill-link"
                  disabled={busyId === listing.id}
                  onClick={() =>
                    updateStatus(listing.id, listing.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')
                  }
                >
                  {listing.status === 'PAUSED' ? 'Reactivar' : 'Pausar'}
                </button>
              )}
              {listing.status !== 'DELETED' && (
                <button className="pill-link text-rose-600" disabled={busyId === listing.id} onClick={() => onDelete(listing.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-500">Aun no publicaste propiedades.</p>}
    </div>
  );
};
