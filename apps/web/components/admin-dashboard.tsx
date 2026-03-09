'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified?: boolean;
  authStatus?: 'missing' | 'pending' | 'confirmed';
  authSupabaseUserId?: string | null;
};
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
  const [reservationTab, setReservationTab] = useState<'pending' | 'confirmed' | 'rejected'>('pending');
  const [confirmingMap, setConfirmingMap] = useState<Record<string, boolean>>({});
  const [confirmMessageMap, setConfirmMessageMap] = useState<Record<string, string>>({});
  const [authStatusMap, setAuthStatusMap] = useState<Record<string, 'missing' | 'pending' | 'confirmed'>>({});
  const [createConfirmedMap, setCreateConfirmedMap] = useState<Record<string, boolean>>({});

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
    const map: Record<string, 'missing' | 'pending' | 'confirmed'> = {};
    users.forEach((u) => {
      map[u.id] = u.authStatus || 'missing';
    });
    setAuthStatusMap(map);
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

  const confirmEmail = async (userId: string) => {
    setConfirmingMap((prev) => ({ ...prev, [userId]: true }));
    setConfirmMessageMap((prev) => ({ ...prev, [userId]: '' }));
    try {
      const res = await fetch('/api/admin/users/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo confirmar el email.');
      }
      setAuthStatusMap((prev) => ({ ...prev, [userId]: 'confirmed' }));
      setConfirmMessageMap((prev) => ({ ...prev, [userId]: 'Email confirmado.' }));
    } catch (error: any) {
      setConfirmMessageMap((prev) => ({
        ...prev,
        [userId]: error?.message || 'No se pudo confirmar el email.'
      }));
    } finally {
      setConfirmingMap((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const createAuthAccount = async (userId: string) => {
    setConfirmingMap((prev) => ({ ...prev, [userId]: true }));
    setConfirmMessageMap((prev) => ({ ...prev, [userId]: '' }));
    try {
      const res = await fetch('/api/admin/users/create-auth-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ userId, emailConfirm: Boolean(createConfirmedMap[userId]) })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo crear la cuenta en Supabase Auth.');
      }
      const status = data?.authStatus === 'confirmed' ? 'confirmed' : 'pending';
      setAuthStatusMap((prev) => ({ ...prev, [userId]: status }));
      setConfirmMessageMap((prev) => ({ ...prev, [userId]: 'Cuenta creada en Supabase Auth.' }));
    } catch (error: any) {
      setConfirmMessageMap((prev) => ({
        ...prev,
        [userId]: error?.message || 'No se pudo crear la cuenta en Supabase Auth.'
      }));
    } finally {
      setConfirmingMap((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const filteredReservations = reservations.filter((reservation) => {
    if (reservationTab === 'pending') {
      return ['PENDING_APPROVAL', 'AWAITING_PAYMENT', 'PENDING_PAYMENT'].includes(reservation.status);
    }
    if (reservationTab === 'confirmed') {
      return ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(reservation.status);
    }
    return ['REJECTED', 'EXPIRED', 'CANCELED', 'REFUNDED', 'DISPUTED'].includes(reservation.status);
  });

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
                <p
                  className={`text-xs ${
                    authStatusMap[u.id] === 'confirmed'
                      ? 'text-emerald-600'
                      : authStatusMap[u.id] === 'pending'
                        ? 'text-amber-600'
                        : 'text-slate-500'
                  }`}
                >
                  {authStatusMap[u.id] === 'confirmed'
                    ? 'Email confirmado'
                    : authStatusMap[u.id] === 'pending'
                      ? 'Email pendiente de confirmacion'
                      : 'Cuenta no creada en Supabase Auth'}
                </p>
                {confirmMessageMap[u.id] && (
                  <p className="text-xs text-slate-500">{confirmMessageMap[u.id]}</p>
                )}
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
                {authStatusMap[u.id] === 'missing' && (
                  <>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(createConfirmedMap[u.id])}
                        onChange={(e) =>
                          setCreateConfirmedMap((prev) => ({ ...prev, [u.id]: e.target.checked }))
                        }
                      />
                      Crear confirmada
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={confirmingMap[u.id]}
                      onClick={() => createAuthAccount(u.id)}
                    >
                      {confirmingMap[u.id] ? 'Creando...' : 'Crear cuenta'}
                    </Button>
                  </>
                )}
                {authStatusMap[u.id] === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={confirmingMap[u.id]}
                    onClick={() => confirmEmail(u.id)}
                  >
                    {confirmingMap[u.id] ? 'Confirmando...' : 'Confirmar email'}
                  </Button>
                )}
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
          <p className="text-sm text-slate-500">Gestion por estado.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`pill-link ${reservationTab === 'pending' ? 'pill-link-active' : ''}`}
              onClick={() => setReservationTab('pending')}
            >
              Pendientes
            </button>
            <button
              type="button"
              className={`pill-link ${reservationTab === 'confirmed' ? 'pill-link-active' : ''}`}
              onClick={() => setReservationTab('confirmed')}
            >
              Confirmadas
            </button>
            <button
              type="button"
              className={`pill-link ${reservationTab === 'rejected' ? 'pill-link-active' : ''}`}
              onClick={() => setReservationTab('rejected')}
            >
              Rechazadas
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {filteredReservations.map((r) => (
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
            {filteredReservations.length === 0 && (
              <p className="text-sm text-slate-500">No hay reservas en esta seccion.</p>
            )}
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
