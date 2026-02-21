import { ReservationStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseIcsEvents } from '@/lib/ical';

type SyncResult = {
  feedId: string;
  ok: boolean;
  created: number;
  removed: number;
  skipped: number;
  error?: string;
};

const overlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

const sanitizeProvider = (provider?: string | null) => {
  const value = (provider || 'ICAL').trim().toUpperCase();
  return value.length > 0 ? value.slice(0, 20) : 'ICAL';
};

const feedBlockReason = (provider: string, uid: string, startDate: Date, endDate: Date) =>
  `EXTERNAL:${provider}:${uid}:${startDate.toISOString().slice(0, 10)}:${endDate
    .toISOString()
    .slice(0, 10)}`;

const systemActor = async (hostId: string) => {
  const host = await prisma.user.findUnique({ where: { id: hostId }, select: { id: true } });
  return host?.id || null;
};

export const syncIcalFeedById = async (feedId: string): Promise<SyncResult> => {
  const feed = await prisma.listingIcalFeed.findUnique({
    where: { id: feedId },
    include: { listing: true }
  });
  if (!feed) {
    return { feedId, ok: false, created: 0, removed: 0, skipped: 0, error: 'Feed no encontrado' };
  }
  if (!feed.isActive) {
    return { feedId, ok: true, created: 0, removed: 0, skipped: 0 };
  }

  try {
    const response = await fetch(feed.url, {
      method: 'GET',
      headers: { Accept: 'text/calendar,text/plain,*/*' }
    });
    if (!response.ok) {
      throw new Error(`No se pudo descargar iCal (${response.status})`);
    }
    const text = await response.text();
    const events = parseIcsEvents(text);
    const provider = sanitizeProvider(feed.provider);
    const feedCreatedBy = `ICAL:${feed.id}`;
    const now = new Date();

    const existingBlocks = await prisma.calendarBlock.findMany({
      where: { listingId: feed.listingId, createdBy: feedCreatedBy }
    });
    const existingByReason = new Map(existingBlocks.map((block) => [block.reason || '', block]));
    const seenReasons = new Set<string>();
    let created = 0;
    let skipped = 0;

    const reservationRanges = await prisma.reservation.findMany({
      where: {
        listingId: feed.listingId,
        OR: [
          { status: ReservationStatus.CONFIRMED },
          { status: ReservationStatus.CHECKED_IN },
          { status: ReservationStatus.COMPLETED },
          {
            status: ReservationStatus.PENDING_PAYMENT,
            holdExpiresAt: { gt: now }
          }
        ]
      },
      select: { id: true, checkIn: true, checkOut: true, createdAt: true }
    });

    const externalBlocksFromOtherSources = await prisma.calendarBlock.findMany({
      where: {
        listingId: feed.listingId,
        createdBy: { startsWith: 'ICAL:' },
        NOT: { createdBy: feedCreatedBy }
      },
      select: { id: true, startDate: true, endDate: true, createdAt: true, createdBy: true }
    });

    const actorId = await systemActor(feed.listing.hostId);

    for (const event of events) {
      const reason = feedBlockReason(provider, event.uid, event.startDate, event.endDate);
      seenReasons.add(reason);

      if (existingByReason.has(reason)) continue;

      const reservationConflict = reservationRanges.find((reservation) =>
        overlap(event.startDate, event.endDate, reservation.checkIn, reservation.checkOut)
      );

      if (reservationConflict) {
        skipped += 1;
        if (actorId) {
          await prisma.auditLog.create({
            data: {
              actorId,
              action: 'ICAL_CONFLICT_RESERVATION_PRIORITY',
              entity: 'Listing',
              entityId: feed.listingId,
              meta: {
                feedId: feed.id,
                reservationId: reservationConflict.id,
                startDate: event.startDate,
                endDate: event.endDate
              }
            }
          });
        }
        continue;
      }

      const olderExternalConflict = externalBlocksFromOtherSources.find((block) =>
        overlap(event.startDate, event.endDate, block.startDate, block.endDate)
      );

      if (olderExternalConflict) {
        skipped += 1;
        if (actorId) {
          await prisma.auditLog.create({
            data: {
              actorId,
              action: 'ICAL_CONFLICT_OLDER_EXTERNAL_PRIORITY',
              entity: 'Listing',
              entityId: feed.listingId,
              meta: {
                feedId: feed.id,
                olderBlockId: olderExternalConflict.id,
                olderCreatedBy: olderExternalConflict.createdBy,
                startDate: event.startDate,
                endDate: event.endDate
              }
            }
          });
        }
        continue;
      }

      await prisma.calendarBlock.create({
        data: {
          listingId: feed.listingId,
          startDate: event.startDate,
          endDate: event.endDate,
          reason,
          createdBy: feedCreatedBy
        }
      });
      created += 1;
    }

    const staleBlocks = existingBlocks.filter((block) => !seenReasons.has(block.reason || ''));
    if (staleBlocks.length > 0) {
      await prisma.calendarBlock.deleteMany({
        where: { id: { in: staleBlocks.map((block) => block.id) } }
      });
    }

    await prisma.listingIcalFeed.update({
      where: { id: feed.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'SYNCED',
        lastSyncError: null
      }
    });

    return {
      feedId: feed.id,
      ok: true,
      created,
      removed: staleBlocks.length,
      skipped
    };
  } catch (error: any) {
    await prisma.listingIcalFeed.update({
      where: { id: feed.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'ERROR',
        lastSyncError: error?.message || 'No se pudo sincronizar'
      }
    });
    return {
      feedId: feed.id,
      ok: false,
      created: 0,
      removed: 0,
      skipped: 0,
      error: error?.message || 'No se pudo sincronizar'
    };
  }
};

export const syncListingIcalFeeds = async (listingId: string) => {
  const feeds = await prisma.listingIcalFeed.findMany({
    where: { listingId, isActive: true },
    select: { id: true }
  });
  const results: SyncResult[] = [];
  for (const feed of feeds) {
    const result = await syncIcalFeedById(feed.id);
    results.push(result);
  }
  return results;
};

export const syncAllIcalFeeds = async () => {
  const feeds = await prisma.listingIcalFeed.findMany({
    where: { isActive: true },
    select: { id: true }
  });
  const results: SyncResult[] = [];
  for (const feed of feeds) {
    const result = await syncIcalFeedById(feed.id);
    results.push(result);
  }
  return results;
};
