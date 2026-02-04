import { prisma } from '@/lib/db';

const renderTemplate = (template: string, vars: Record<string, string>) => {
  return Object.keys(vars).reduce((acc, key) => acc.replaceAll(`{${key}}`, vars[key]), template);
};

const getTemplates = async (hostId: string) => {
  const row = await prisma.settings.findUnique({ where: { key: `hostMessageTemplates:${hostId}` } });
  return row?.value as {
    enabled?: boolean;
    instantMessageOnConfirm?: string;
    welcomeMessage?: string;
  } | null;
};

export const ensureThreadWithParticipants = async (reservationId: string, guestId: string, hostId: string) => {
  const existing = await prisma.messageThread.findUnique({
    where: { reservationId },
    include: { participants: true }
  });
  if (existing) return existing;

  return prisma.messageThread.create({
    data: {
      reservationId,
      status: 'RESERVATION',
      createdById: hostId,
      participants: {
        create: [{ userId: hostId }, { userId: guestId }]
      }
    }
  });
};

export const sendAutoMessagesOnConfirm = async (reservationId: string) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      listing: true,
      user: { include: { profile: true } }
    }
  });
  if (!reservation) return;
  const hostId = reservation.listing.hostId;
  const templates = await getTemplates(hostId);
  if (!templates?.enabled) return;

  const host = await prisma.user.findUnique({
    where: { id: hostId },
    include: { profile: true }
  });

  const vars = {
    guest_name: reservation.user.profile?.name || reservation.user.email || 'Huésped',
    checkin_date: reservation.checkIn.toISOString().slice(0, 10),
    checkout_date: reservation.checkOut.toISOString().slice(0, 10),
    listing_title: reservation.listing.title,
    host_name: host?.profile?.name || host?.email || 'Anfitrión'
  };

  const thread = await ensureThreadWithParticipants(reservation.id, reservation.userId, hostId);

  const messagesToSend = [
    templates.instantMessageOnConfirm,
    templates.welcomeMessage
  ].filter(Boolean) as string[];

  for (const raw of messagesToSend) {
    const body = renderTemplate(raw, vars);
    const exists = await prisma.message.findFirst({
      where: { threadId: thread.id, senderId: hostId, body }
    });
    if (!exists) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          senderId: hostId,
          body
        }
      });
    }
  }
};
