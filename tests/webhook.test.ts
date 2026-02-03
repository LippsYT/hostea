import { describe, expect, it, vi } from 'vitest';
import { handleStripeWebhook } from '../apps/web/lib/stripe-webhook-handler';

const mockPrisma = () => ({
  payment: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  reservation: {
    update: vi.fn(),
    findUnique: vi.fn()
  },
  calendarBlock: {
    create: vi.fn()
  },
  messageThread: {
    create: vi.fn().mockResolvedValue({ id: 'thread_1' })
  },
  message: {
    create: vi.fn()
  }
});

describe('stripe webhook', () => {
  it('procesa checkout.session.completed', async () => {
    const prisma = mockPrisma();
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res_1',
      listingId: 'listing_1',
      checkIn: new Date(),
      checkOut: new Date(),
      userId: 'user_1',
      listing: { hostId: 'host_1' }
    });

    const event = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { reservationId: 'res_1' }, payment_intent: 'pi_1' } }
    };

    await handleStripeWebhook(event, prisma as any);

    expect(prisma.payment.updateMany).toHaveBeenCalled();
    expect(prisma.reservation.update).toHaveBeenCalled();
    expect(prisma.calendarBlock.create).toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalled();
  });
});
