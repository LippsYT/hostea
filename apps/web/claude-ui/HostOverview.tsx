'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  Calendar,
  Users,
  Star,
  ArrowRight,
  Activity,
  Target,
  Award,
  Percent
} from 'lucide-react';

interface HostOverviewProps {
  stats: {
    totalEarnings: number;
    earningsGrowth: number;
    totalProperties: number;
    activeReservations: number;
    upcomingReservations: number;
    occupancyRate: number;
    averageRating: number;
    totalReviews: number;
  };
  recentActivity?: {
    newReservations: number;
    pendingCheckIns: number;
    pendingCheckOuts: number;
  };
}

export default function HostOverview({ stats, recentActivity }: HostOverviewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Panel de Host</h1>
            <p className="text-lg text-slate-600">Gestiona tus propiedades y reservas</p>
          </div>
          <Button className="rounded-xl bg-slate-900 shadow-lg hover:bg-slate-800">
            <Home className="mr-2 h-4 w-4" />
            Nueva propiedad
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-xl transition-all duration-300 hover:shadow-2xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur">
                  <DollarSign className="h-5 w-5" />
                </div>
                {stats.earningsGrowth >= 0 ? (
                  <Badge className="border-white/30 bg-white/20 text-white">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    +{stats.earningsGrowth}%
                  </Badge>
                ) : (
                  <Badge className="border-white/30 bg-white/20 text-white">
                    <TrendingDown className="mr-1 h-3 w-3" />
                    {stats.earningsGrowth}%
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-100">Ganancias totales</p>
                <p className="mt-1 text-3xl font-bold">${stats.totalEarnings.toLocaleString()}</p>
              </div>
              <p className="text-xs text-emerald-100">Este mes vs anterior</p>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <Home className="h-5 w-5 text-blue-600" />
                </div>
                <Badge className="border-blue-200 bg-blue-50 text-blue-700">Activas</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Propiedades</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.totalProperties}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-between px-0 text-blue-600 hover:text-blue-700"
              >
                <span className="text-xs font-medium">Ver todas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-violet-50 p-2.5">
                  <Calendar className="h-5 w-5 text-violet-600" />
                </div>
                <Badge className="border-violet-200 bg-violet-50 text-violet-700">En curso</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Reservas activas</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{stats.activeReservations}</p>
              </div>
              <div className="text-xs text-slate-500">+{stats.upcomingReservations} próximas</div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <Star className="h-5 w-5 text-amber-500" />
                </div>
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">Top rated</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Rating promedio</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{stats.averageRating}</p>
                  <p className="text-sm text-slate-500">/ 5.0</p>
                </div>
              </div>
              <div className="text-xs text-slate-500">{stats.totalReviews} reseñas</div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-slate-200 bg-white/70 p-6 backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-3 shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-sm font-medium text-slate-600">Tasa de ocupación</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-slate-900">{stats.occupancyRate}%</p>
                  {stats.occupancyRate >= 70 && (
                    <Badge className="border-emerald-200 bg-emerald-500/10 text-emerald-700">
                      Excelente
                    </Badge>
                  )}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                    style={{ width: `${stats.occupancyRate}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {recentActivity && (
            <>
              <Card className="border-slate-200 bg-white/70 p-6 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 p-3 shadow-lg">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-sm font-medium text-slate-600">Nuevas reservas</p>
                    <p className="mb-2 text-2xl font-bold text-slate-900">{recentActivity.newReservations}</p>
                    <p className="text-xs text-slate-500">En las últimas 24 horas</p>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-200 bg-white/70 p-6 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-3 shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-sm font-medium text-slate-600">Actividad pendiente</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div>
                        <p className="text-lg font-bold text-slate-900">{recentActivity.pendingCheckIns}</p>
                        <p className="text-xs text-slate-500">Check-ins</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div>
                        <p className="text-lg font-bold text-slate-900">{recentActivity.pendingCheckOuts}</p>
                        <p className="text-xs text-slate-500">Check-outs</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-2xl">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="space-y-2">
              <div className="mb-2 flex items-center gap-2">
                <Award className="h-6 w-6 text-amber-400" />
                <Badge className="border-white/30 bg-white/20 text-white">Recomendado</Badge>
              </div>
              <h3 className="text-2xl font-bold">Optimiza tus ganancias</h3>
              <p className="max-w-2xl text-slate-300">
                Ajusta precios dinámicos, mejora tus descripciones y aumenta tu ocupación hasta un 30%
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" className="rounded-xl bg-white text-slate-900 hover:bg-slate-100">
                <Percent className="mr-2 h-4 w-4" />
                Ajustar precios
              </Button>
              <Button variant="outline" className="rounded-xl border-white/30 text-white hover:bg-white/10">
                Ver análisis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
