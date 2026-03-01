import { PaymentStatus, PrismaClient, ReservationStatus } from '@prisma/client';
import { calcBreakdown } from '@/lib/intelligent-pricing';
import { ensureReservationNumber } from '@/lib/reservation-number';

export type AdminPrintSettingsShape = {
  autoPrintEnabled: boolean;
  autoPrintOnlyPaid: boolean;
  printerName: string | null;
  copies: number;
};

export type PrintJobPayload = {
  reservationCode: string;
  reservationId: string;
  hostId: string;
  propertyName: string;
  hostName: string;
  hostEmail: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  currency: string;
  totalClient: number;
  netHost: number;
  hosteaFee: number;
  adminCharges: number;
  paymentStatus: string;
  createdAt: string;
};

const DEFAULT_SETTINGS: AdminPrintSettingsShape = {
  autoPrintEnabled: false,
  autoPrintOnlyPaid: true,
  printerName: null,
  copies: 1
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const diffNights = (checkIn: Date, checkOut: Date) => {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

export const getAdminPrintSettings = async (
  db: PrismaClient | any
): Promise<AdminPrintSettingsShape> => {
  const row = await db.adminSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  return {
    autoPrintEnabled: row.autoPrintEnabled,
    autoPrintOnlyPaid: row.autoPrintOnlyPaid,
    printerName: row.printerName || null,
    copies: Math.max(1, Number(row.copies) || 1)
  };
};

export const updateAdminPrintSettings = async (
  db: PrismaClient | any,
  input: Partial<AdminPrintSettingsShape>
) => {
  return db.adminSettings.upsert({
    where: { id: 1 },
    update: {
      autoPrintEnabled: input.autoPrintEnabled,
      autoPrintOnlyPaid: input.autoPrintOnlyPaid,
      printerName: input.printerName?.trim() || null,
      copies: input.copies ? Math.max(1, Math.min(10, Number(input.copies) || 1)) : undefined
    },
    create: {
      id: 1,
      autoPrintEnabled: input.autoPrintEnabled ?? DEFAULT_SETTINGS.autoPrintEnabled,
      autoPrintOnlyPaid: input.autoPrintOnlyPaid ?? DEFAULT_SETTINGS.autoPrintOnlyPaid,
      printerName: input.printerName?.trim() || null,
      copies: input.copies ? Math.max(1, Math.min(10, Number(input.copies) || 1)) : 1
    }
  });
};

export const buildReservationPrintPayload = async (
  db: PrismaClient | any,
  reservationId: string
): Promise<PrintJobPayload | null> => {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: {
      listing: { include: { host: { include: { profile: true } } } },
      user: { include: { profile: true } },
      payment: true
    }
  });

  if (!reservation) return null;

  const reservationCode =
    (await ensureReservationNumber(db, reservation.id, reservation.createdAt)) || reservation.id;
  const totalClient = roundMoney(Number(reservation.total) || 0);
  const split = calcBreakdown(totalClient);

  return {
    reservationCode,
    reservationId: reservation.id,
    hostId: reservation.listing.hostId,
    propertyName: reservation.listing.title,
    hostName: reservation.listing.host.profile?.name || reservation.listing.host.email,
    hostEmail: reservation.listing.host.email,
    guestName: reservation.user.profile?.name || reservation.user.email,
    guestEmail: reservation.user.email,
    checkIn: reservation.checkIn.toISOString().slice(0, 10),
    checkOut: reservation.checkOut.toISOString().slice(0, 10),
    nights: diffNights(reservation.checkIn, reservation.checkOut),
    guestsCount: reservation.guestsCount,
    currency: reservation.currency || 'USD',
    totalClient,
    netHost: split.hostNet,
    hosteaFee: split.platformFee,
    adminCharges: split.stripeFee,
    paymentStatus:
      reservation.payment?.status ||
      (reservation.status === ReservationStatus.CONFIRMED
        ? PaymentStatus.SUCCEEDED
        : PaymentStatus.REQUIRES_ACTION),
    createdAt: reservation.createdAt.toISOString()
  };
};

export const createPrintJob = async (
  db: PrismaClient | any,
  input: {
    reservationId?: string | null;
    hostId?: string | null;
    payload: Record<string, unknown>;
    type?: string;
  }
) => {
  return db.printJob.create({
    data: {
      reservationId: input.reservationId || null,
      hostId: input.hostId || null,
      status: 'pending',
      attempts: 0,
      error: null,
      payload: input.payload as any,
      type: input.type || 'reservation'
    }
  });
};

export const enqueueReservationPrintJob = async (
  db: PrismaClient | any,
  reservationId: string,
  trigger: 'created' | 'paid',
  force = false
) => {
  const settings = await getAdminPrintSettings(db);
  if (!settings.autoPrintEnabled && !force) return null;
  if (settings.autoPrintOnlyPaid && trigger !== 'paid' && !force) return null;

  const payload = await buildReservationPrintPayload(db, reservationId);
  if (!payload) return null;

  if (settings.autoPrintOnlyPaid && payload.paymentStatus !== PaymentStatus.SUCCEEDED && !force) {
    return null;
  }

  if (trigger === 'paid') {
    const existing = await db.printJob.findFirst({
      where: {
        reservationId,
        type: 'reservation',
        status: { in: ['pending', 'printed'] }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (existing && existing.status === 'printed' && !force) return existing;
  }

  return createPrintJob(db, {
    reservationId,
    hostId: payload.hostId,
    payload: {
      ...payload,
      trigger
    },
    type: 'reservation'
  });
};
