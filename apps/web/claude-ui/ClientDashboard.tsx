'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  Home,
  TrendingUp,
  CreditCard,
  MessageSquare,
  Star,
  CalendarDays,
  Package
} from 'lucide-react';

interface Reservation {
  id: string;
  propertyName: string;
  propertyImage: string | null;
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  totalPrice: number;
  hostName?: string;
}

interface ClientDashboardProps {
  reservations: Reservation[];
  stats: {
    totalReservations: number;
    upcomingReservations: number;
    totalSpent: number;
  };
}

export default function ClientDashboard({ reservations, stats }: ClientDashboardProps) {
  const upcomingReservations = reservations.filter((r) => r.status === 'upcoming');
  const activeReservations = reservations.filter((r) => r.status === 'active');
  const pastReservations = reservations.filter((r) => r.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/30">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Tus reservas
          </h1>
          <p className="text-lg text-slate-600">
            Gestiona tus estadías y próximos viajes
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-slate-200 bg-white/80 p-6 backdrop-blur transition-all duration-300 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Total de reservas</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalReservations}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Todas las reservas</span>
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white/80 p-6 backdrop-blur transition-all duration-300 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Próximas estadías</p>
                <p className="text-3xl font-bold text-slate-900">{stats.upcomingReservations}</p>
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Confirmadas</span>
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <Clock className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white/80 p-6 backdrop-blur transition-all duration-300 hover:shadow-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">Total invertido</p>
                <p className="text-3xl font-bold text-slate-900">
                  ${stats.totalSpent.toLocaleString()}
                </p>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>En todas tus reservas</span>
                </div>
              </div>
              <div className="rounded-xl bg-violet-50 p-3">
                <TrendingUp className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="h-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 shadow-sm">
            <TabsTrigger
              value="upcoming"
              className="rounded-xl px-6 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Clock className="mr-2 h-4 w-4" />
              Próximas ({upcomingReservations.length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="rounded-xl px-6 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Home className="mr-2 h-4 w-4" />
              En curso ({activeReservations.length})
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="rounded-xl px-6 py-2.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Pasadas ({pastReservations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6 space-y-4">
            {upcomingReservations.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-12 w-12" />}
                title="No tienes reservas próximas"
                description="Explora nuevos destinos y crea tu próxima aventura"
                actionLabel="Explorar propiedades"
              />
            ) : (
              <div className="grid gap-4">
                {upcomingReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6 space-y-4">
            {activeReservations.length === 0 ? (
              <EmptyState
                icon={<Home className="h-12 w-12" />}
                title="No tienes estadías activas"
                description="Cuando llegue tu fecha de check-in, aparecerá aquí"
              />
            ) : (
              <div className="grid gap-4">
                {activeReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6 space-y-4">
            {pastReservations.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-12 w-12" />}
                title="Aún no tienes reservas completadas"
                description="Tus estadías pasadas aparecerán aquí"
              />
            ) : (
              <div className="grid gap-4">
                {pastReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} isPast />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReservationCard({ reservation, isPast = false }: { reservation: Reservation; isPast?: boolean }) {
  const statusConfig = {
    upcoming: { label: 'Próxima', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
    active: { label: 'En curso', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    completed: { label: 'Completada', color: 'bg-gray-500/10 text-gray-700 border-gray-200' },
    cancelled: { label: 'Cancelada', color: 'bg-red-500/10 text-red-700 border-red-200' }
  }[reservation.status];

  return (
    <Card className="group overflow-hidden border-slate-200 bg-white transition-all duration-300 hover:shadow-xl">
      <div className="flex flex-col md:flex-row">
        <div className="relative h-48 overflow-hidden bg-slate-100 md:h-auto md:w-64">
          {reservation.propertyImage ? (
            <img
              src={reservation.propertyImage}
              alt={reservation.propertyName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-slate-100" />
          )}
          <Badge className={`absolute left-4 top-4 border shadow-sm ${statusConfig.color}`}>
            {statusConfig.label}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col justify-between p-6">
          <div className="space-y-4">
            <div>
              <h3 className="mb-1.5 text-xl font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                {reservation.propertyName}
              </h3>
              <div className="flex items-center text-sm text-slate-600">
                <MapPin className="mr-1.5 h-4 w-4" />
                {reservation.location}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-2 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-blue-50 p-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-slate-500">Check-in</p>
                  <p className="text-sm font-semibold text-slate-900">{reservation.checkIn}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-violet-50 p-2">
                  <Calendar className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-slate-500">Check-out</p>
                  <p className="text-sm font-semibold text-slate-900">{reservation.checkOut}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-emerald-50 p-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-slate-500">Huéspedes</p>
                  <p className="text-sm font-semibold text-slate-900">{reservation.guests}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="mb-0.5 text-sm text-slate-500">Total pagado</p>
              <p className="text-2xl font-bold text-slate-900">
                ${reservation.totalPrice.toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              {isPast && (
                <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50">
                  <Star className="mr-1.5 h-4 w-4" />
                  Dejar reseña
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50">
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Contactar host
              </Button>
              <Button size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800">
                Ver detalles
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
}) {
  return (
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center space-y-4">
        <div className="rounded-2xl bg-white p-4 text-slate-400 shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="text-slate-600">{description}</p>
        </div>
        {actionLabel && (
          <Button className="mt-4 rounded-xl bg-slate-900 hover:bg-slate-800">
            {actionLabel}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
