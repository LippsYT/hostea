'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Home, MessageSquare, Package, Users } from 'lucide-react';

type Reservation = {
  id: string;
  listingId?: string;
  propertyName: string;
  propertyImage: string | null;
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  totalPrice: number;
};

type ClientDashboardProps = {
  reservations: Reservation[];
  stats: {
    totalReservations: number;
    upcomingReservations: number;
    totalSpent: number;
  };
};

const money = (value: number) => `USD ${Number(value || 0).toFixed(2)}`;
const toDisplayDate = (isoDate: string) => {
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
};

type Tab = 'upcoming' | 'active' | 'past';

export default function ClientDashboard({ reservations, stats }: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [csrf, setCsrf] = useState('');
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/security/csrf')
      .then(async (res) => {
        const data = await res.json();
        setCsrf(data?.token || '');
      })
      .catch(() => undefined);
  }, []);

  const grouped = useMemo(() => {
    return {
      upcoming: reservations.filter((r) => r.status === 'upcoming'),
      active: reservations.filter((r) => r.status === 'active'),
      past: reservations.filter((r) => r.status === 'completed' || r.status === 'cancelled')
    };
  }, [reservations]);

  const createOrOpenThread = async (reservationId: string) => {
    try {
      setLoadingThreadId(reservationId);
      let token = csrf;
      if (!token) {
        const csrfRes = await fetch('/api/security/csrf');
        const csrfData = await csrfRes.json();
        token = csrfData?.token || '';
        setCsrf(token);
      }
      const res = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ reservationId })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.thread?.id) {
        window.location.href = `/dashboard/client/messages?threadId=${data.thread.id}`;
        return;
      }
      alert(data?.error || 'No se pudo abrir el chat con el host.');
    } finally {
      setLoadingThreadId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900">Tus reservas</h1>
        <p className="text-sm text-slate-500">Gestiona tus estadias y proximos viajes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Reservas</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalReservations}</p>
          <p className="mt-1 text-xs text-slate-500">Total en tu cuenta</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.upcomingReservations}</p>
          <p className="mt-1 text-xs text-slate-500">Proximas o por confirmar</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total pagado</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{money(stats.totalSpent)}</p>
          <p className="mt-1 text-xs text-slate-500">Reservas confirmadas</p>
        </Card>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-2">
          <TabButton
            label={`Proximas (${grouped.upcoming.length})`}
            icon={<Clock className="h-4 w-4" />}
            active={activeTab === 'upcoming'}
            onClick={() => setActiveTab('upcoming')}
          />
          <TabButton
            label={`En curso (${grouped.active.length})`}
            icon={<Home className="h-4 w-4" />}
            active={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
          />
          <TabButton
            label={`Historial (${grouped.past.length})`}
            icon={<Calendar className="h-4 w-4" />}
            active={activeTab === 'past'}
            onClick={() => setActiveTab('past')}
          />
        </div>
      </div>

      {activeTab === 'upcoming' && (
        <ReservationList
          reservations={grouped.upcoming}
          emptyTitle="No tienes reservas proximas."
          emptyDescription="Cuando reserves un alojamiento, aparecera aqui."
          onContactHost={createOrOpenThread}
          loadingThreadId={loadingThreadId}
        />
      )}
      {activeTab === 'active' && (
        <ReservationList
          reservations={grouped.active}
          emptyTitle="No tienes estadias activas."
          emptyDescription="Las reservas en curso apareceran aqui."
          onContactHost={createOrOpenThread}
          loadingThreadId={loadingThreadId}
        />
      )}
      {activeTab === 'past' && (
        <ReservationList
          reservations={grouped.past}
          emptyTitle="Todavia no tienes historial."
          emptyDescription="Tus reservas finalizadas o canceladas apareceran aqui."
          onContactHost={createOrOpenThread}
          loadingThreadId={loadingThreadId}
        />
      )}
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ReservationList({
  reservations,
  emptyTitle,
  emptyDescription,
  onContactHost,
  loadingThreadId
}: {
  reservations: Reservation[];
  emptyTitle: string;
  emptyDescription: string;
  onContactHost: (reservationId: string) => Promise<void>;
  loadingThreadId: string | null;
}) {
  if (reservations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-base font-semibold text-slate-900">{emptyTitle}</p>
        <p className="mt-2 text-sm text-slate-500">{emptyDescription}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => (
        <Card key={reservation.id} className="overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[340px_1fr]">
            <div className="h-52 bg-slate-100 md:h-full">
              {reservation.propertyImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reservation.propertyImage}
                  alt={reservation.propertyName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold text-slate-900">{reservation.propertyName}</p>
                  <p className="text-sm text-slate-500">{reservation.location}</p>
                </div>
                <Badge className={statusBadgeClass(reservation.status)}>{statusLabel(reservation.status)}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <InfoItem icon={<Calendar className="h-4 w-4 text-slate-600" />} label="Check-in" value={toDisplayDate(reservation.checkIn)} />
                <InfoItem icon={<Calendar className="h-4 w-4 text-slate-600" />} label="Check-out" value={toDisplayDate(reservation.checkOut)} />
                <InfoItem icon={<Users className="h-4 w-4 text-slate-600" />} label="Huespedes" value={String(reservation.guests)} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total pagado</p>
                  <p className="text-2xl font-bold text-slate-900">{money(reservation.totalPrice)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onContactHost(reservation.id)}
                    disabled={loadingThreadId === reservation.id}
                  >
                    <MessageSquare className="mr-1 h-4 w-4" />
                    {loadingThreadId === reservation.id ? 'Abriendo...' : 'Contactar host'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (reservation.listingId) {
                        window.location.href = `/listings/${reservation.listingId}`;
                      }
                    }}
                  >
                    Ver detalle
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function statusLabel(status: Reservation['status']) {
  if (status === 'active') return 'En curso';
  if (status === 'completed') return 'Completada';
  if (status === 'cancelled') return 'Cancelada';
  return 'Proxima';
}

function statusBadgeClass(status: Reservation['status']) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'completed') return 'bg-slate-100 text-slate-700';
  if (status === 'cancelled') return 'bg-rose-100 text-rose-700';
  return 'bg-blue-100 text-blue-700';
}
