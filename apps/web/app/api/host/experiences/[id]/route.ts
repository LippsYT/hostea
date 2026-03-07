import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ExperienceActivityType } from '@prisma/client';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/permissions';
import { ensureExperienceHostRole } from '@/lib/server-roles';

const canManageExperiences = (roles: string[]) =>
  roles.includes('ADMIN') || roles.includes('HOST') || roles.includes('EXPERIENCE_HOST');

const photoSchema = z.object({
  url: z.string().url(),
  isCover: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

const updateSchema = z.object({
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

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED'])
});

const resolveSession = async () => {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const roles = ((session.user as any).roles || []) as string[];

  if (!canManageExperiences(roles)) {
    const promoted = await ensureExperienceHostRole(userId);
    if (!promoted) {
      return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) };
    }
  }

  return { userId, roles };
};

const assertOwnership = async (id: string, userId: string, roles: string[]) => {
  const experience = await prisma.experience.findUnique({
    where: { id },
    select: { id: true, hostId: true }
  });
  if (!experience) {
    return NextResponse.json({ error: 'Experiencia no encontrada' }, { status: 404 });
  }
  if (experience.hostId !== userId && !roles.includes('ADMIN')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }
  return null;
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const auth = await resolveSession();
    if ('error' in auth) return auth.error;

    const ownershipError = await assertOwnership(params.id, auth.userId, auth.roles);
    if (ownershipError) return ownershipError;

    const parsed = updateSchema.safeParse(await req.json());
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

    const experience = await prisma.experience.update({
      where: { id: params.id },
      data: {
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
          deleteMany: {},
          create: photos
        }
      },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } }
      }
    });

    return NextResponse.json({ experience });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const auth = await resolveSession();
    if ('error' in auth) return auth.error;

    const ownershipError = await assertOwnership(params.id, auth.userId, auth.roles);
    if (ownershipError) return ownershipError;

    const parsed = statusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    }

    const experience = await prisma.experience.update({
      where: { id: params.id },
      data: { status: parsed.data.status }
    });

    return NextResponse.json({ experience });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    assertCsrf(req);
    const auth = await resolveSession();
    if ('error' in auth) return auth.error;

    const ownershipError = await assertOwnership(params.id, auth.userId, auth.roles);
    if (ownershipError) return ownershipError;

    const experience = await prisma.experience.update({
      where: { id: params.id },
      data: { status: 'DELETED' }
    });

    return NextResponse.json({ experience });
  } catch (error: any) {
    if (error?.message === 'CSRF token invalido') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
  }
}
