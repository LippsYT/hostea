import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PushDebug } from '@/components/push-debug';

export default async function PushDebugPage() {
  const session = await getServerSession(authOptions);
  const roles = (((session?.user as any)?.roles || []) as string[]);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-5">
        <p className="section-subtitle">Herramientas internas</p>
        <h1 className="section-title">/debug/push</h1>
      </div>
      <PushDebug roles={roles} />
    </div>
  );
}
