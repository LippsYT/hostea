'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Phone,
  Mail,
  ChevronRight,
  Filter,
  DollarSign,
  Home
} from 'lucide-react';

interface Reservation {
  id: string;
  propertyName: string;
  propertyImage: string;
  guestName: string;
  guestAvatar?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: 'pending' | 'confirmed' | 'checkedin' | 'completed' | 'cancelled';
  totalPrice: number;
  nights: number;
  specialRequests?: string;
}

interface HostReservationsProps {
  reservations: Reservation[];
}

export default function HostReservations({ reservations }: HostReservationsProps) {
  const pendingReservations = reservations.filter(r => r.status === 'pending');
  const confirmedReservations = reservations.filter(r => r.status === 'confirmed');
  const activeReservations = reservations.filter(r => r.status === 'checkedin');
  const completedReservations = reservations.filter(r => r.status === 'completed');
  const cancelledReservations = reservations.filter(r => r.status === 'cancelled');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Reservas
            </h1>
            <p className="text-slate-600 text-lg">
              Gestiona todas tus reservas en un solo lugar
            </p>
          </div>
          <Button variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-50">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>

        {/* Alert for pending */}
        {pendingReservations.length > 0 && (
          <Card className="p-4 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  Tienes {pendingReservations.length} {pendingReservations.length === 1 ? 'reserva pendiente' : 'reservas pendientes'} de aprobar
                </p>
                <p className="text-sm text-amber-700">Responde pronto para no perder la reserva</p>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                Ver pendientes
              </Button>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="confirmed" className="space-y-6">
          <TabsList className="bg-slate-100/80 p-1.5 h-auto rounded-2xl border border-slate-200 shadow-sm flex-wrap">
            {pendingReservations.length > 0 && (
              <TabsTrigger 
                value="pending" 
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Pendientes ({pendingReservations.length})
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="confirmed" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmadas ({confirmedReservations.length})
            </TabsTrigger>
            <TabsTrigger 
              value="active" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
            >
              <Home className="w-4 h-4 mr-2" />
              En curso ({activeReservations.length})
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
            >
              <Clock className="w-4 h-4 mr-2" />
              Completadas ({completedReservations.length})
            </TabsTrigger>
            {cancelledReservations.length > 0 && (
              <TabsTrigger 
                value="cancelled" 
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Canceladas ({cancelledReservations.length})
              </TabsTrigger>
            )}
          </TabsList>

          {pendingReservations.length > 0 && (
            <TabsContent value="pending" className="space-y-4 mt-6">
              <div className="grid gap-4">
                {pendingReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} isPending />
                ))}
              </div>
            </TabsContent>
          )}

          <TabsContent value="confirmed" className="space-y-4 mt-6">
            {confirmedReservations.length === 0 ? (
              <EmptyState 
                icon={<CheckCircle2 className="w-12 h-12" />}
                title="No tienes reservas confirmadas"
                description="Las reservas confirmadas aparecerán aquí"
              />
            ) : (
              <div className="grid gap-4">
                {confirmedReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4 mt-6">
            {activeReservations.length === 0 ? (
              <EmptyState 
                icon={<Home className="w-12 h-12" />}
                title="No hay huéspedes activos"
                description="Las reservas en curso aparecerán aquí"
              />
            ) : (
              <div className="grid gap-4">
                {activeReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} isActive />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-6">
            {completedReservations.length === 0 ? (
              <EmptyState 
                icon={<Clock className="w-12 h-12" />}
                title="No tienes reservas completadas"
                description="El historial de reservas aparecerá aquí"
              />
            ) : (
              <div className="grid gap-4">
                {completedReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} isCompleted />
                ))}
              </div>
            )}
          </TabsContent>

          {cancelledReservations.length > 0 && (
            <TabsContent value="cancelled" className="space-y-4 mt-6">
              <div className="grid gap-4">
                {cancelledReservations.map((reservation) => (
                  <ReservationCard key={reservation.id} reservation={reservation} isCancelled />
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function ReservationCard({ 
  reservation, 
  isPending = false,
  isActive = false,
  isCompleted = false,
  isCancelled = false
}: { 
  reservation: Reservation;
  isPending?: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
  isCancelled?: boolean;
}) {
  const statusConfig = {
    pending: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
    confirmed: { label: 'Confirmada', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
    checkedin: { label: 'En curso', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    completed: { label: 'Completada', color: 'bg-slate-500/10 text-slate-700 border-slate-200' },
    cancelled: { label: 'Cancelada', color: 'bg-red-500/10 text-red-700 border-red-200' },
  }[reservation.status];

  return (
    <Card className="overflow-hidden border-slate-200 hover:shadow-xl transition-all duration-300 bg-white group">
      <div className="flex flex-col lg:flex-row">
        {/* Image */}
        <div className="lg:w-72 h-48 lg:h-auto relative overflow-hidden bg-slate-100">
          <img 
            src={reservation.propertyImage} 
            alt={reservation.propertyName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <Badge className={`absolute top-4 left-4 ${statusConfig.color} border shadow-sm`}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-1.5">
                {reservation.propertyName}
              </h3>
              <div className="flex items-center gap-3">
                {reservation.guestAvatar ? (
                  <img 
                    src={reservation.guestAvatar} 
                    alt={reservation.guestName}
                    className="w-8 h-8 rounded-full border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">{reservation.guestName}</p>
                  <p className="text-sm text-slate-500">{reservation.guests} {reservation.guests === 1 ? 'huésped' : 'huéspedes'}</p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg mt-0.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Check-in</p>
                  <p className="text-sm font-semibold text-slate-900">{reservation.checkIn}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-violet-50 rounded-lg mt-0.5">
                  <Calendar className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Check-out</p>
                  <p className="text-sm font-semibold text-slate-900">{reservation.checkOut}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg mt-0.5">
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Duración</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {reservation.nights} {reservation.nights === 1 ? 'noche' : 'noches'}
                  </p>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            {reservation.specialRequests && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-medium text-blue-900 mb-1">Solicitudes especiales</p>
                <p className="text-sm text-blue-800">{reservation.specialRequests}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
            <div>
              <p className="text-sm text-slate-500 mb-0.5">Total a recibir</p>
              <p className="text-2xl font-bold text-slate-900">
                ${reservation.totalPrice.toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isPending && (
                <>
                  <Button variant="outline" size="sm" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">
                    Rechazar
                  </Button>
                  <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                    Aprobar
                  </Button>
                </>
              )}
              {!isPending && !isCancelled && (
                <>
                  <Button variant="outline" size="icon" className="rounded-xl border-slate-200 hover:bg-slate-50">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-xl border-slate-200 hover:bg-slate-50">
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50">
                    <MessageSquare className="w-4 h-4 mr-1.5" />
                    Mensaje
                  </Button>
                </>
              )}
              <Button size="sm" className="rounded-xl bg-slate-900 hover:bg-slate-800">
                Ver detalles
                <ChevronRight className="w-4 h-4 ml-1" />
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
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
}) {
  return (
    <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
      <div className="flex flex-col items-center max-w-md mx-auto space-y-4">
        <div className="p-4 bg-white rounded-2xl text-slate-400 shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="text-slate-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}
