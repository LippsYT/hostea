import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertCsrf } from '@/lib/csrf';
import { requireSession } from '@/lib/permissions';
import { sendPushToHost } from '@/lib/push-notifications';
import { createThreadWithParticipants, uniqueParticipantIds } from '@/lib/message-thread-utils';
import { getSmartPricingParamsFromSettings } from '@/lib/pricing-settings';
import { calculateExperienceCheckoutQuote } from '@/lib/experience-checkout-pricing';
import {
  getHostMessagingConfig,
  renderHostTemplate,
  resolveAutomationTemplate
} from '@/lib/host-messaging-config';

const schema = z.object({
  date: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  timeLabel: z.string().optional(),
  adults: z.coerce.number().int().min(1).max(30),
  children: z.coerce.number().int().min(0).max(30),
  infants: z.coerce.number().int().min(0).max(30)
}).superRefine((value, ctx) => {
  if (!value.date && !value.checkIn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['date'],
      message: 'Fecha requerida'
    });
  }
});

const ACTIVE_BOOKING_STATUSES = ['CONFIRMED', 'PENDING_APPROVAL', 'AWAITING_PAYMENT'];

const getTodayIso = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any)?.id as string;
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
    }

    const experience = await prisma.experience.findFirst({
      where: { id: params.id, status: 'ACTIVE' }
    });
    if (!experience) {
      return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
    }
    if (experience.hostId === userId) {
      return NextResponse.json({ error: 'No puedes reservar tu propia experiencia' }, { status: 400 });
    }

    const data = parsed.data;
    const requestedDate = data.date || data.checkIn || '';
    if (requestedDate < getTodayIso()) {
      return NextResponse.json({ error: 'No puedes reservar fechas pasadas' }, { status: 400 });
    }
    const bookingDate = new Date(requestedDate);
    if (Number.isNaN(bookingDate.getTime())) {
      return NextResponse.json({ error: 'Fecha invalida' }, { status: 400 });
    }

    const totalGuests = data.adults + data.children + data.infants;
    if (totalGuests > experience.capacity) {
      return NextResponse.json(
        { error: `La actividad admite hasta ${experience.capacity} personas.` },
        { status: 400 }
      );
    }

    const occupied = await prisma.experienceBooking.aggregate({
      where: {
        experienceId: experience.id,
        date: bookingDate,
        timeLabel: data.timeLabel || undefined,
        status: { in: ACTIVE_BOOKING_STATUSES }
      },
      _sum: {
        adults: true,
        children: true,
        infants: true
      }
    });

    const occupiedCount =
      Number(occupied._sum.adults || 0) +
      Number(occupied._sum.children || 0) +
      Number(occupied._sum.infants || 0);

    if (experience.activityType === 'SHARED' && occupiedCount + totalGuests > experience.capacity) {
      return NextResponse.json(
        { error: 'No hay cupos suficientes para la fecha y horario elegidos.' },
        { status: 400 }
      );
    }

    const pricingParams = await getSmartPricingParamsFromSettings();
    const quote = calculateExperienceCheckoutQuote({
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      adultPrice: Number(experience.pricePerPerson),
      childPrice: Number(experience.childPrice ?? experience.pricePerPerson),
      infantPrice: Number(experience.infantPrice ?? 0),
      pricingParams
    });

    const status = experience.activityType === 'PRIVATE' ? 'PENDING_APPROVAL' : 'CONFIRMED';
    const booking = await prisma.experienceBooking.create({
      data: {
        experienceId: experience.id,
        userId,
        date: bookingDate,
        timeLabel: data.timeLabel || null,
        adults: data.adults,
        children: data.children,
        infants: data.infants,
        total: quote.total,
        currency: 'USD',
        status
      }
    });

    const threadSubject = `ACTIVITY:${experience.id}`;
    let thread = await prisma.messageThread.findFirst({
      where: {
        reservationId: null,
        createdById: userId,
        subject: threadSubject,
        participants: { some: { userId: experience.hostId } }
      }
    });

    if (!thread) {
      thread = await createThreadWithParticipants(prisma, {
        status: 'INQUIRY',
        subject: threadSubject,
        createdById: userId,
        participantIds: uniqueParticipantIds([userId, experience.hostId])
      });
    }

    const messageBody =
      status === 'PENDING_APPROVAL'
        ? `Solicitud de actividad enviada para ${experience.title} (${requestedDate})${data.timeLabel ? `, horario ${data.timeLabel}` : ''}. Participantes: ${totalGuests}.`
        : `Reserva de actividad confirmada para ${experience.title} (${requestedDate})${data.timeLabel ? `, horario ${data.timeLabel}` : ''}. Participantes: ${totalGuests}.`;

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        body: messageBody
      }
    });

    const hostConfig = await getHostMessagingConfig(experience.hostId);
    const inquiryTemplate = resolveAutomationTemplate(hostConfig, 'inquiry');
    if (inquiryTemplate) {
      const autoBody = renderHostTemplate(inquiryTemplate.body, {
        guest_name: (session.user as any)?.name || (session.user as any)?.email || 'Huesped',
        property_name: experience.title,
        check_in: requestedDate,
        check_out: '',
        booking_code: ''
      });
      const already = await prisma.message.findFirst({
        where: {
          threadId: thread.id,
          senderId: experience.hostId,
          body: autoBody
        }
      });
      if (!already) {
        await prisma.message.create({
          data: {
            threadId: thread.id,
            senderId: experience.hostId,
            body: autoBody
          }
        });
      }
    }

    try {
      await sendPushToHost(experience.hostId, {
        title: status === 'PENDING_APPROVAL' ? 'Nueva solicitud de actividad' : 'Nueva reserva de actividad',
        body: `${experience.title} · ${totalGuests} participante${totalGuests === 1 ? '' : 's'}`,
        url: `/dashboard/host/messages?threadId=${thread.id}`,
        type: status === 'PENDING_APPROVAL' ? 'NEW_INQUIRY' : 'NEW_RESERVATION'
      });
    } catch {
      // La reserva no debe fallar por problemas de push.
    }

    return NextResponse.json({ bookingId: booking.id, status, threadId: thread.id });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
