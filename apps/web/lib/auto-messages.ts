import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createThreadWithParticipants, uniqueParticipantIds } from '@/lib/message-thread-utils';
import {
  getHostMessagingConfig,
  hasAutoMessageAudit,
  markAutoMessageAudit,
  renderHostTemplate
} from '@/lib/host-messaging-config';

type ReservationWithContext = Awaited<ReturnType<typeof fetchReservationContext>>;

type AutoMessageEvent = 'reservation_confirmed' | 'pre_checkin' | 'welcome' | 'check_out';

const eventActionMap: Record<AutoMessageEvent, string> = {
  reservation_confirmed: 'AUTO_MESSAGE_RESERVATION_CONFIRMED',
  pre_checkin: 'AUTO_MESSAGE_PRE_CHECKIN',
  welcome: 'AUTO_MESSAGE_WELCOME',
  check_out: 'AUTO_MESSAGE_CHECK_OUT'
};

const startOfDay = (value: Date) => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
};

const plusDays = (value: Date, days: number) => {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
};

const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const fetchReservationContext = async (reservationId: string) =>
  prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      listing: true,
      user: { include: { profile: true } },
      thread: true
    }
  });

const ensureThreadWithParticipants = async (
  reservationId: string,
  guestId: string,
  hostId: string,
  subject: string
) => {
  const existing = await prisma.messageThread.findUnique({
    where: { reservationId }
  });
  if (existing) return existing;
  return createThreadWithParticipants(prisma, {
    reservationId,
    status: 'RESERVATION',
    subject,
    createdById: hostId,
    participantIds: uniqueParticipantIds([hostId, guestId])
  });
};

const resolveTemplate = (
  reservation: NonNullable<ReservationWithContext>,
  event: AutoMessageEvent,
  config: Awaited<ReturnType<typeof getHostMessagingConfig>>
) => {
  switch (event) {
    case 'reservation_confirmed':
      return config.templates.reservationConfirmed;
    case 'pre_checkin':
      return config.templates.preCheckIn;
    case 'welcome':
      return config.templates.welcome;
    case 'check_out':
      return config.templates.checkOut;
    default:
      return config.templates.reservationConfirmed;
  }
};

const buildTemplateVariables = (reservation: NonNullable<ReservationWithContext>) => ({
  guest_name: reservation.user.profile?.name || reservation.user.email || 'Huesped',
  property_name: reservation.listing.title,
  check_in: reservation.checkIn.toISOString().slice(0, 10),
  check_out: reservation.checkOut.toISOString().slice(0, 10)
});

const sendAutoMessageForReservation = async (
  reservation: NonNullable<ReservationWithContext>,
  event: AutoMessageEvent
) => {
  const hostId = reservation.listing.hostId;
  const config = await getHostMessagingConfig(hostId);
  if (!config.enabled) return;

  const action = eventActionMap[event];
  const alreadySent = await hasAutoMessageAudit(reservation.id, action);
  if (alreadySent) return;

  const body = renderHostTemplate(
    resolveTemplate(reservation, event, config),
    buildTemplateVariables(reservation)
  ).trim();
  if (!body) return;

  const thread = await ensureThreadWithParticipants(
    reservation.id,
    reservation.userId,
    hostId,
    reservation.listing.title
  );

  await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: hostId,
      body
    }
  });

  await markAutoMessageAudit(
    reservation.id,
    hostId,
    action,
    { event, threadId: thread.id },
    prisma
  );
};

let lastLifecycleSweepAt = 0;

export const sendAutoMessagesOnConfirm = async (reservationId: string) => {
  const reservation = await fetchReservationContext(reservationId);
  if (!reservation) return;
  await sendAutoMessageForReservation(reservation, 'reservation_confirmed');
};

export const sendScheduledHostLifecycleMessages = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastLifecycleSweepAt < 5 * 60 * 1000) {
    return;
  }
  lastLifecycleSweepAt = now;

  const today = startOfDay(new Date());
  const tomorrow = plusDays(today, 1);
  const dayAfterTomorrow = plusDays(today, 2);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.COMPLETED
        ]
      },
      OR: [
        { checkIn: { gte: today, lt: dayAfterTomorrow } },
        { checkOut: { gte: today, lt: plusDays(today, 1) } }
      ]
    },
    include: {
      listing: true,
      user: { include: { profile: true } },
      thread: true
    }
  });

  for (const reservation of reservations) {
    if (sameDay(reservation.checkIn, tomorrow)) {
      await sendAutoMessageForReservation(reservation, 'pre_checkin');
    }
    if (sameDay(reservation.checkIn, today)) {
      await sendAutoMessageForReservation(reservation, 'welcome');
    }
    if (sameDay(reservation.checkOut, today)) {
      await sendAutoMessageForReservation(reservation, 'check_out');
    }
  }
};
