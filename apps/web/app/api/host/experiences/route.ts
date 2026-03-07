import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/permissions';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { ExperienceActivityType } from '@prisma/client';
import { ensureExperienceHostRole } from '@/lib/server-roles';

const photoSchema = z.object({
  url: z.string().url(),
  isCover: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  category: z.string().min(2),
  city: z.string().min(2),
  meetingPoint: z.string().min(3),
  durationMinutes: z.coerce.number().int().min(30).max(1440),
  language: z.string().min(2),
  pricePerPerson: z.coerce.number().positive(),
  childPrice: z.coerce.number().min(0).optional(),
  infantPrice: z.coerce.number().min(0).optional(),
  capacity: z.coerce.number().int().min(1).max(200),
  schedules: z.array(z.string().min(2)).min(1),
  includesText: z.string().max(4000).optional(),
  excludesText: z.string().max(4000).optional(),
  requirementsText: z.string().max(4000).optional(),
  activityType: z.nativeEnum(ExperienceActivityType).default(ExperienceActivityType.SHARED),
  photos: z.array(photoSchema).default([])
});

const canManageExperiences = (roles: string[]) =>
  roles.includes('ADMIN') || roles.includes('HOST') || roles.includes('EXPERIENCE_HOST');

export async function GET() {
  try {
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = ((session.user as any).roles || []) as string[];
    if (!canManageExperiences(roles)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const experiences = await prisma.experience.findMany({
      where: { hostId: userId },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        bookings: {
          select: { id: true, status: true, total: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return NextResponse.json({ experiences });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const session = await requireSession();
    const userId = (session.user as any).id as string;
    const roles = ((session.user as any).roles || []) as string[];

    if (!canManageExperiences(roles)) {
      const promoted = await ensureExperienceHostRole(userId);
      if (!promoted) {
        return NextResponse.json({ error: 'Sin permisos para publicar experiencias' }, { status: 403 });
      }
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const photos = data.photos
      .map((photo, index) => ({
        url: photo.url,
        sortOrder: typeof photo.sortOrder === 'number' ? photo.sortOrder : index,
        isCover: photo.isCover ?? false
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const coverIndex = photos.findIndex((photo) => photo.isCover);
    if (coverIndex === -1 && photos.length > 0) {
      photos[0].isCover = true;
    }

    const experience = await prisma.experience.create({
      data: {
        hostId: userId,
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category.trim(),
        city: data.city.trim(),
        meetingPoint: data.meetingPoint.trim(),
        durationMinutes: data.durationMinutes,
        language: data.language.trim(),
        pricePerPerson: data.pricePerPerson,
        childPrice: data.childPrice,
        infantPrice: data.infantPrice,
        capacity: data.capacity,
        scheduleText: data.schedules.join(' | '),
        includesText: data.includesText?.trim() || null,
        excludesText: data.excludesText?.trim() || null,
        requirementsText: data.requirementsText?.trim() || null,
        activityType: data.activityType,
        photos: {
          create: photos
        }
      },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } }
      }
    });

    await ensureExperienceHostRole(userId);
    return NextResponse.json({ experience });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
