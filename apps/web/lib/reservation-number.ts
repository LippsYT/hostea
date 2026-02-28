import { ReservationStatus } from '@prisma/client';

const pad = (value: string, length: number) => value.padStart(length, '0').slice(-length);

const formatDate = (date: Date) => {
  const year = String(date.getUTCFullYear());
  const month = pad(String(date.getUTCMonth() + 1), 2);
  const day = pad(String(date.getUTCDate()), 2);
  return `${year}${month}${day}`;
};

const normalizeSuffix = (value: string) => {
  const alnum = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return pad(alnum.slice(-4) || '0000', 4);
};

const randomSuffix = () => {
  const value = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase();
  return pad(value, 4);
};

export const buildReservationNumber = (
  reservationId: string,
  createdAt: Date,
  fallback = false
) => {
  const suffix = fallback ? randomSuffix() : normalizeSuffix(reservationId);
  return `HST-${formatDate(createdAt)}-${suffix}`;
};

export const ensureReservationNumber = async (
  prisma: any,
  reservationId: string,
  createdAt: Date
) => {
  const current = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { reservationNumber: true }
  });
  if (!current || current.reservationNumber) return current?.reservationNumber || null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const nextNumber = buildReservationNumber(reservationId, createdAt, attempt > 0);
    try {
      const updated = await prisma.reservation.updateMany({
        where: { id: reservationId, reservationNumber: null },
        data: { reservationNumber: nextNumber }
      });
      if (updated.count > 0) {
        return nextNumber;
      }
      const check = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { reservationNumber: true }
      });
      if (check?.reservationNumber) return check.reservationNumber;
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }
  }

  return null;
};

export const backfillReservationNumbers = async (prisma: any, limit = 200) => {
  const rows = await prisma.reservation.findMany({
    where: {
      reservationNumber: null,
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.COMPLETED,
          ReservationStatus.REFUNDED,
          ReservationStatus.CANCELED
        ]
      }
    },
    select: { id: true, createdAt: true },
    take: limit,
    orderBy: { createdAt: 'asc' }
  });

  for (const reservation of rows) {
    await ensureReservationNumber(prisma, reservation.id, reservation.createdAt);
  }

  return rows.length;
};
