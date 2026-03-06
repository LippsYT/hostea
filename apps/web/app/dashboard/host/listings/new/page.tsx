import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { HostListingForm } from '@/components/host-listing-form';

export default async function HostListingNewPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-subtitle">Panel Host</p>
          <h1 className="section-title">Crear propiedad</h1>
        </div>
        <Link href="/dashboard/host/listings" className="pill-link">
          Volver a Mis propiedades
        </Link>
      </div>
      <HostListingForm />
    </div>
  );
}
