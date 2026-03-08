import { ReservationStatus } from '@prisma/client';

const pad = (value: number, length: number) => String(value).padStart(length, '0');

export const buildReservationNumber = (
  year: number,
  sequence: number
) => {
  return `HTA-${year}-${pad(sequence, 6)}`;
};

export const ensureReservationNumber = async (
  prisma: any,
  reservationId: string,
  createdAt: Date
) => {
  const current = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { reservationNumber: true, createdAt: true }
  });
  if (!current || current.reservationNumber) return current?.reservationNumber || null;

  const year = (createdAt || current.createdAt).getUTCFullYear();
  const prefix = `HTA-${year}-`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existingCount = await prisma.reservation.count({
      where: { reservationNumber: { startsWith: prefix } }
    });
    const nextNumber = buildReservationNumber(year, existingCount + 1 + attempt);
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
