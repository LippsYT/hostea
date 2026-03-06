import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { HostCalendar } from '@/components/host-calendar';

export default async function HostCalendarPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  const userId = (session?.user as any)?.id as string;
  const listings = await prisma.listing.findMany({
    where: { hostId: userId },
    select: { id: true, title: true }
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Panel Host</p>
        <h1 className="section-title">Calendario de disponibilidad</h1>
      </div>
      <HostCalendar listings={listings} />
    </div>
  );
}
