import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SupportInbox } from '@/components/support-inbox';

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.user as any)?.roles || [];
  if (!roles.includes('SUPPORT') && !roles.includes('MODERATOR') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }
  let tickets: Array<{
    id: string;
    caseSequence: number | null;
    subject: string;
    status: any;
    priority: any;
    summary?: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { email: string; profile?: { name?: string | null } | null };
    messages: Array<{
      id: string;
      body: string;
      createdAt: Date;
      sender: { email: string; profile?: { name?: string | null } | null };
    }>;
  }> = [];

  try {
    tickets = await prisma.ticket.findMany({
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { include: { profile: true } },
        messages: {
          include: { sender: { include: { profile: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    }) as any[];
  } catch {
    tickets = [];
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Moderacion y Soporte</p>
        <h1 className="section-title">Bandeja de soporte</h1>
      </div>
      <SupportInbox tickets={tickets} />
    </div>
  );
}
