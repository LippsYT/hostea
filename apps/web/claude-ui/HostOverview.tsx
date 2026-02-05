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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Panel de Host
            </h1>
            <p className="text-slate-600 text-lg">
              Gestiona tus propiedades y reservas
            </p>
          </div>
          <Button className="rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg">
            <Home className="w-4 h-4 mr-2" />
            Nueva propiedad
          </Button>
        </div>

        {/* Main KPI Cards - Destacados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 border-slate-200 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur">
                  <DollarSign className="w-5 h-5" />
                </div>
                {stats.earningsGrowth >= 0 ? (
                  <Badge className="bg-white/20 text-white border-white/30">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +{stats.earningsGrowth}%
                  </Badge>
                ) : (
                  <Badge className="bg-white/20 text-white border-white/30">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    {stats.earningsGrowth}%
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-100">Ganancias totales</p>
                <p className="text-3xl font-bold mt-1">
                  ${stats.totalEarnings.toLocaleString()}
                </p>
              </div>
              <p className="text-xs text-emerald-100">Este mes vs anterior</p>
            </div>
          </Card>

          <Card className="p-6 border-slate-200 bg-white shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Home className="w-5 h-5 text-blue-600" />
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                  Activas
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Propiedades</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {stats.totalProperties}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-auto text-blue-600 hover:text-blue-700">
                <span className="text-xs font-medium">Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>

          <Card className="p-6 border-slate-200 bg-white shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-violet-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-violet-600" />
                </div>
                <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                  En curso
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Reservas activas</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {stats.activeReservations}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                +{stats.upcomingReservations} próximas
              </div>
            </div>
          </Card>

          <Card className="p-6 border-slate-200 bg-white shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                  Top rated
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Rating promedio</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-bold text-slate-900">
                    {stats.averageRating}
                  </p>
                  <p className="text-sm text-slate-500">/ 5.0</p>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {stats.totalReviews} reseñas
              </div>
            </div>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-6 border-slate-200 bg-white/70 backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-600 mb-1">Tasa de ocupación</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-slate-900">{stats.occupancyRate}%</p>
                  {stats.occupancyRate >= 70 && (
                    <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">
                      Excelente
                    </Badge>
                  )}
                </div>
                <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${stats.occupancyRate}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {recentActivity && (
            <>
              <Card className="p-6 border-slate-200 bg-white/70 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600 mb-1">Nuevas reservas</p>
                    <p className="text-2xl font-bold text-slate-900 mb-2">
                      {recentActivity.newReservations}
                    </p>
                    <p className="text-xs text-slate-500">En las últimas 24 horas</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-slate-200 bg-white/70 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600 mb-1">Actividad pendiente</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div>
                        <p className="text-lg font-bold text-slate-900">{recentActivity.pendingCheckIns}</p>
                        <p className="text-xs text-slate-500">Check-ins</p>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
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

        {/* Quick Actions */}
        <Card className="p-8 border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-2xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-6 h-6 text-amber-400" />
                <Badge className="bg-white/20 text-white border-white/30">
                  Recomendado
                </Badge>
              </div>
              <h3 className="text-2xl font-bold">Optimiza tus ganancias</h3>
              <p className="text-slate-300 max-w-2xl">
                Ajusta precios dinámicos, mejora tus descripciones y aumenta tu ocupación hasta un 30%
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" className="rounded-xl bg-white text-slate-900 hover:bg-slate-100">
                <Percent className="w-4 h-4 mr-2" />
                Ajustar precios
              </Button>
              <Button variant="outline" className="rounded-xl border-white/30 text-white hover:bg-white/10">
                Ver análisis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
