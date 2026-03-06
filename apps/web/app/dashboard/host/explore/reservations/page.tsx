import { requireExperienceHostAccess } from '@/lib/experience-access';
import { prisma } from '@/lib/db';

export default async function HostExploreReservationsPage() {
  const { userId } = await requireExperienceHostAccess();
  const bookings = await prisma.experienceBooking.findMany({
    where: { experience: { hostId: userId } },
    include: {
      experience: { select: { title: true, city: true } },
      user: { include: { profile: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Reservas de actividades</h1>
      </div>
      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-3">Actividad</th>
              <th className="pb-3">Cliente</th>
              <th className="pb-3">Fecha</th>
              <th className="pb-3">Pax</th>
              <th className="pb-3">Total</th>
              <th className="pb-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="py-3">
                  <p className="font-medium text-slate-900">{booking.experience.title}</p>
                  <p className="text-xs text-slate-500">{booking.experience.city}</p>
                </td>
                <td className="py-3 text-slate-700">
                  {booking.user.profile?.name || booking.user.email}
                </td>
                <td className="py-3 text-slate-700">
                  {booking.date.toISOString().slice(0, 10)} {booking.timeLabel ? `· ${booking.timeLabel}` : ''}
                </td>
                <td className="py-3 text-slate-700">
                  {booking.adults + booking.children + booking.infants}
                </td>
                <td className="py-3 font-semibold text-slate-900">
                  {booking.currency} {Number(booking.total).toFixed(2)}
                </td>
                <td className="py-3 text-slate-700">{booking.status}</td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td className="py-6 text-slate-500" colSpan={6}>
                  No hay reservas de experiencias todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
