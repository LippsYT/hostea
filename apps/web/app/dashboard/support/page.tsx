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
  const tickets = await prisma.ticket.findMany({
    include: { messages: true, createdBy: true },
    orderBy: { createdAt: 'desc' }
  });

  const safeTickets = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    requester: t.createdBy.email,
    lastMessage: t.messages[0]?.body || ''
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="section-subtitle">Moderacion y Soporte</p>
        <h1 className="section-title">Bandeja de soporte</h1>
      </div>
      <SupportInbox tickets={safeTickets} />
    </div>
  );
}
