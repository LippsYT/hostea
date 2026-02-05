'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type UserRow = { id: string; email: string; name: string; role: string };
type ListingRow = { id: string; title: string; status: string; hostEmail: string };
type KycRow = { id: string; userEmail: string; status: string };
type ReservationRow = { id: string; listingTitle: string; userEmail: string; status: string; total: number };
type AuditRow = { id: string; action: string; entity: string; entityId: string; actorEmail: string; createdAt: string };

export const AdminDashboard = ({
  users,
  listings,
  kycs,
  reservations,
  audit
}: {
  users: UserRow[];
  listings: ListingRow[];
  kycs: KycRow[];
  reservations: ReservationRow[];
  audit: AuditRow[];
}) => {
  const [csrf, setCsrf] = useState('');
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  useEffect(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => (map[u.id] = u.role));
    setRoleMap(map);
  }, [users]);

  useEffect(() => {
    const map: Record<string, string> = {};
    listings.forEach((l) => (map[l.id] = l.status));
    setStatusMap(map);
  }, [listings]);

  const updateRole = async (userId: string) => {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ userId, role: roleMap[userId] })
    });
  };

  const updateListing = async (listingId: string) => {
    await fetch('/api/admin/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ listingId, status: statusMap[listingId] })
    });
  };

  const updateKyc = async (id: string, status: string) => {
    await fetch(`/api/admin/kyc/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ status })
    });
  };

  const cancelReservation = async (id: string) => {
    await fetch(`/api/reservations/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }
    });
  };

  return (
    <div className="space-y-10">
      <section className="surface-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Usuarios</h2>
            <p className="text-sm text-slate-500">Roles, accesos y permisos del equipo.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {users.length} usuarios
          </span>
        </div>
        <div className="mt-5 divide-y divide-slate-200/70">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{u.name || u.email}</p>
                <p className="text-slate-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
                  value={roleMap[u.id]}
                  onChange={(e) => setRoleMap((prev) => ({ ...prev, [u.id]: e.target.value }))}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="HOST">HOST</option>
                  <option value="CLIENT">CLIENT</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="SUPPORT">SUPPORT</option>
                  <option value="FINANCE">FINANCE</option>
                </select>
                <Button size="sm" onClick={() => updateRole(u.id)}>Guardar</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Listings</h2>
            <p className="text-sm text-slate-500">Revisión de publicaciones y estado.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {listings.length} activos
          </span>
        </div>
        <div className="mt-5 space-y-3">
          {listings.map((l) => (
            <div key={l.id} className="surface-muted flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{l.title}</p>
                <p className="text-slate-500">Host: {l.hostEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-wide"
                  value={statusMap[l.id]}
                  onChange={(e) => setStatusMap((prev) => ({ ...prev, [l.id]: e.target.value }))}
                >
                  <option value="ACTIVE">ACTIVO</option>
                  <option value="PAUSED">PAUSADO</option>
                  <option value="DELETED">ELIMINADO</option>
                </select>
                <Button size="sm" onClick={() => updateListing(l.id)}>Actualizar</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card">
          <h2 className="text-xl font-semibold text-slate-900">KYC</h2>
          <p className="text-sm text-slate-500">Verificaciones pendientes y aprobaciones.</p>
          <div className="mt-5 space-y-3">
            {kycs.map((k) => (
              <div key={k.id} className="surface-muted flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{k.userEmail}</p>
                  <p className="text-slate-500">{k.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateKyc(k.id, 'APPROVED')}>Aprobar</Button>
                  <Button size="sm" variant="outline" onClick={() => updateKyc(k.id, 'REJECTED')}>Rechazar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <h2 className="text-xl font-semibold text-slate-900">Reservas</h2>
          <p className="text-sm text-slate-500">Ultimos movimientos y cancelaciones.</p>
          <div className="mt-5 space-y-3">
            {reservations.map((r) => (
              <div key={r.id} className="surface-muted flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{r.listingTitle}</p>
                  <p className="text-slate-500">
                    {r.userEmail} - {r.status} - USD {r.total}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => cancelReservation(r.id)}>Cancelar</Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Auditoria</h2>
        <p className="text-sm text-slate-500">Eventos recientes del sistema.</p>
        <div className="mt-5 space-y-2 text-sm">
          {audit.map((a) => (
            <div key={a.id} className="surface-muted">
              <p className="font-semibold text-slate-900">{a.action} - {a.entity}</p>
              <p className="text-slate-500">{a.actorEmail} - {new Date(a.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
