import { NotificationKind } from '@prisma/client';
import { prisma } from '@/lib/db';

type NotificationInput = {
  userId: string;
  kind?: NotificationKind;
  title: string;
  body: string;
  link?: string | null;
};

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind ?? 'INFO',
      title: input.title,
      body: input.body,
      link: input.link ?? null
    }
  });
}

export async function createNotifications(inputs: NotificationInput[]) {
  if (inputs.length === 0) return;
  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      kind: input.kind ?? 'INFO',
      title: input.title,
      body: input.body,
      link: input.link ?? null
    }))
  });
}

export async function notifyAdmins({
  kind = 'INFO',
  title,
  body,
  link
}: {
  kind?: NotificationKind;
  title: string;
  body: string;
  link?: string | null;
}) {
  const admins = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: 'ADMIN'
          }
        }
      }
    },
    select: { id: true }
  });

  await createNotifications(
    admins.map((admin) => ({
      userId: admin.id,
      kind,
      title,
      body,
      link
    }))
  );
}
