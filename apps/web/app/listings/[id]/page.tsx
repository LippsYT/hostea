import Image from 'next/image';
import { prisma } from '@/lib/db';
import { BookingForm } from '@/components/booking-form';
import { Badge } from '@/components/ui/badge';
import { Ban, Clock, Home, MapPin, PawPrint, ShieldCheck, Sparkles } from 'lucide-react';
import { ListingHeader } from '@/components/listing-header';

export default async function ListingDetail({ params }: { params: { id: string } }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      amenities: { include: { amenity: true } },
      host: { include: { profile: true } },
      reviews: true,
      roomTypes: true
    }
  });

  if (!listing) {
    return <div className="p-10">Listing no encontrado</div>;
  }

  const primaryPhoto = listing.photos[0];
  const gallery = listing.photos.slice(1, 5);
  const rating = listing.reviews.length
    ? (listing.reviews.reduce((acc, r) => acc + r.rating, 0) / listing.reviews.length).toFixed(1)
    : 'Nuevo';

  const hasAmenity = (name: string) => listing.amenities.some((a) => a.amenity.name.toLowerCase().includes(name.toLowerCase()));

  const highlights = [
    {
      icon: Sparkles,
      title: 'Diseno premium',
      description: 'Espacios curados, iluminacion moderna y confort total.'
    },
    {
      icon: ShieldCheck,
      title: 'Reserva segura',
      description: listing.instantBook ? 'Reserva inmediata confirmada.' : 'Confirmacion del host en pocas horas.'
    },
    {
      icon: Home,
      title: hasAmenity('cocina') ? 'Cocina equipada' : 'Espacios amplios',
      description: hasAmenity('cocina') ? 'Ideal para estadias largas y workation.' : 'Ambientes luminosos con distribucion comoda.'
    }
  ];

  const houseRules = [
    { icon: Clock, label: 'Check-in desde 15:00 · Check-out 11:00' },
    { icon: Ban, label: 'No fumar dentro de la propiedad' },
    { icon: PawPrint, label: 'Mascotas bajo consulta' }
  ];

  const fullAddress = `${listing.address}, ${listing.neighborhood}, ${listing.city}`;
  const mapQuery = encodeURIComponent(fullAddress);
  const mapUrl = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;
  const normalizedTaxRate =
    Number(listing.taxRate) > 1 ? Number(listing.taxRate) / 100 : Number(listing.taxRate);

  return (
    <div className="bg-white">
      <ListingHeader />
      <div className="px-6 pb-24 pt-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="section-subtitle">{listing.neighborhood}, {listing.city}</p>
            <h1 className="text-3xl font-semibold text-slate-900">{listing.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>Rating {rating}</span>
              <span>·</span>
              <span>{listing.type === 'HOTEL' ? 'Hotel' : 'Departamento'}</span>
              <span>·</span>
              <span>{listing.capacity} huespedes</span>
              <span>·</span>
              <span>{listing.beds} camas</span>
              <span>·</span>
              <span>{listing.baths} banos</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                {primaryPhoto ? (
                  <div className="relative h-64 overflow-hidden rounded-3xl md:h-80">
                    <Image src={primaryPhoto.url} alt={listing.title} fill className="object-cover" priority />
                  </div>
                ) : (
                  <div className="h-64 rounded-3xl bg-slate-100" />
                )}
                <div className="grid gap-4">
                  {gallery.map((photo) => (
                    <div key={photo.id} className="relative h-32 overflow-hidden rounded-3xl">
                      <Image src={photo.url} alt={listing.title} fill className="object-cover" />
                    </div>
                  ))}
                  {gallery.length === 0 && <div className="h-32 rounded-3xl bg-slate-100" />}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {highlights.map((item) => (
                  <div key={item.title} className="surface-card">
                    <item.icon className="h-5 w-5 text-slate-700" />
                    <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-xs text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="surface-card">
                <h2 className="text-xl font-semibold text-slate-900">Descripcion</h2>
                <p className="mt-3 text-sm text-slate-600">{listing.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.amenities.map((a) => (
                    <Badge key={a.amenityId}>{a.amenity.name}</Badge>
                  ))}
                  {listing.amenities.length === 0 && <span className="text-sm text-slate-500">Sin amenities cargados.</span>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="surface-card">
                  <h3 className="text-lg font-semibold text-slate-900">Anfitrion</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {listing.host.profile?.name || listing.host.email}
                  </p>
                  <p className="text-xs text-slate-500">Respuesta rapida · Verificado</p>
                </div>
                <div className="surface-card">
                  <h3 className="text-lg font-semibold text-slate-900">Politicas</h3>
                  <p className="mt-2 text-sm text-slate-600">Cancelacion: {listing.cancelPolicy}</p>
                  <p className="text-sm text-slate-600">Reserva inmediata: {listing.instantBook ? 'Si' : 'No'}</p>
                </div>
              </div>

              <div className="surface-card">
                <h3 className="text-lg font-semibold text-slate-900">Reglas de la casa</h3>
                <div className="mt-4 space-y-2">
                  {houseRules.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-3 text-sm text-slate-600">
                      <rule.icon className="h-4 w-4 text-slate-500" />
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">Las reglas pueden variar segun el anfitrion.</p>
              </div>

              <div className="surface-card">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Ubicacion</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <span>{fullAddress}</span>
                  </div>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/70">
                  <iframe
                    title="map"
                    src={mapUrl}
                    className="h-56 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>

              <div className="surface-card">
                <h3 className="text-lg font-semibold text-slate-900">Resenas</h3>
                {listing.reviews.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Aun no hay resenas.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {listing.reviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="surface-muted">
                        <p className="font-semibold text-slate-900">Rating {review.rating}</p>
                        <p className="text-sm text-slate-600">{review.comment || 'Excelente experiencia.'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-24 h-fit">
              <div className="surface-card">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-semibold">USD {Number(listing.pricePerNight).toFixed(0)}</span>
                  <span className="text-sm text-slate-500">por noche</span>
                </div>
                <div className="mt-5">
                  <BookingForm
                    listingId={listing.id}
                    pricePerNight={Number(listing.pricePerNight)}
                    cleaningFee={Number(listing.cleaningFee)}
                    serviceFee={0}
                    taxRate={normalizedTaxRate}
                  />
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Cancelacion segun politica {listing.cancelPolicy}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
