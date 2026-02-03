import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ClientProfile } from '@/components/client-profile';

export default async function ClientProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string;
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const lastKyc = await prisma.kycSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Panel Cliente</p>
        <h1 className="section-title">Perfil y verificacion</h1>
      </div>
      <ClientProfile
        initialName={profile?.name || ''}
        initialPhone={profile?.phone || ''}
        kycStatus={lastKyc?.status || null}
      />
    </div>
  );
}
