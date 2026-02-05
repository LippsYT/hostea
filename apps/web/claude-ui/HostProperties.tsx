'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home,
  MapPin,
  Users,
  DollarSign,
  Star,
  TrendingUp,
  MoreVertical,
  Eye,
  Edit,
  PauseCircle,
  PlayCircle,
  Percent,
  Calendar,
  Bed,
  Bath,
  ChevronRight
} from 'lucide-react';

interface Property {
  id: string;
  name: string;
  image: string;
  location: string;
  type: string;
  status: 'active' | 'paused' | 'draft';
  price: number;
  rating: number;
  reviews: number;
  occupancyRate: number;
  nextReservation?: string;
  amenities: {
    bedrooms: number;
    bathrooms: number;
    guests: number;
  };
  earnings: {
    month: number;
    total: number;
  };
}

interface HostPropertiesProps {
  properties: Property[];
}

type TabKey = 'active' | 'paused' | 'draft';

export default function HostProperties({ properties }: HostPropertiesProps) {
  const [tab, setTab] = useState<TabKey>('active');

  const grouped = useMemo(() => ({
    active: properties.filter((p) => p.status === 'active'),
    paused: properties.filter((p) => p.status === 'paused'),
    draft: properties.filter((p) => p.status === 'draft')
  }), [properties]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'active', label: 'Activas', icon: <PlayCircle className="w-4 h-4" />, count: grouped.active.length },
    { key: 'paused', label: 'Pausadas', icon: <PauseCircle className="w-4 h-4" />, count: grouped.paused.length },
    { key: 'draft', label: 'Borradores', icon: <Edit className="w-4 h-4" />, count: grouped.draft.length }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Tus propiedades
            </h1>
            <p className="text-slate-600 text-lg">
              {properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'} en total
            </p>
          </div>
          <Button className="rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg">
            <Home className="w-4 h-4 mr-2" />
            Agregar propiedad
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all ${
                tab === item.key
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {item.icon}
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {tab === 'active' && (
            grouped.active.length === 0 ? (
              <EmptyState 
                icon={<PlayCircle className="w-12 h-12" />}
                title="No tienes propiedades activas"
                description="Activa una propiedad para empezar a recibir reservas"
              />
            ) : (
              <div className="grid gap-4">
                {grouped.active.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )
          )}

          {tab === 'paused' && (
            grouped.paused.length === 0 ? (
              <EmptyState 
                icon={<PauseCircle className="w-12 h-12" />}
                title="No tienes propiedades pausadas"
                description="Las propiedades pausadas no aparecerán en búsquedas"
              />
            ) : (
              <div className="grid gap-4">
                {grouped.paused.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )
          )}

          {tab === 'draft' && (
            grouped.draft.length === 0 ? (
              <EmptyState 
                icon={<Edit className="w-12 h-12" />}
                title="No tienes borradores"
                description="Completa la información para publicar tus propiedades"
              />
            ) : (
              <div className="grid gap-4">
                {grouped.draft.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const statusConfig = {
    active: { label: 'Activa', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
    paused: { label: 'Pausada', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
    draft: { label: 'Borrador', color: 'bg-slate-500/10 text-slate-700 border-slate-200' },
  }[property.status];

  return (
    <Card className="overflow-hidden border-slate-200 hover:shadow-xl transition-all duration-300 bg-white group">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-80 h-56 lg:h-auto relative overflow-hidden bg-slate-100">
          <img 
            src={property.image} 
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <Badge className={`absolute top-4 left-4 ${statusConfig.color} border shadow-sm`}>
            {statusConfig.label}
          </Badge>
          {property.rating > 0 && (
            <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-lg">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-sm text-slate-900">{property.rating}</span>
              <span className="text-xs text-slate-500">({property.reviews})</span>
            </div>
          )}
        </div>

        <div className="flex-1 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 mb-1.5 group-hover:text-blue-600 transition-colors">
                    {property.name}
                  </h3>
                  <div className="flex items-center text-slate-600 text-sm">
                    <MapPin className="w-4 h-4 mr-1.5" />
                    {property.location}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl p-0 hover:bg-slate-100">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                {property.type}
              </Badge>
            </div>

            <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Bed className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{property.amenities.bedrooms}</span>
                <span className="text-slate-400">hab.</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Bath className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{property.amenities.bathrooms}</span>
                <span className="text-slate-400">baños</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{property.amenities.guests}</span>
                <span className="text-slate-400">huéspedes</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Precio/noche</p>
                <p className="text-lg font-bold text-slate-900">
                  ${property.price}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Este mes</p>
                <p className="text-lg font-bold text-emerald-600">
                  ${property.earnings.month.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Ocupación</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-bold text-slate-900">{property.occupancyRate}%</p>
                  {property.occupancyRate >= 70 && (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              </div>
            </div>

            {property.nextReservation && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Calendar className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-blue-900">
                  <span className="font-medium">Próxima reserva:</span> {property.nextReservation}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50">
              <Eye className="w-4 h-4 mr-1.5" />
              Ver página
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50">
              <Edit className="w-4 h-4 mr-1.5" />
              Editar
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 hover:bg-slate-50">
              <Percent className="w-4 h-4 mr-1.5" />
              Precios
            </Button>
            <Button size="sm" className="ml-auto rounded-xl bg-slate-900 hover:bg-slate-800">
              Gestionar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
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
