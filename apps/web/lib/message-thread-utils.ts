import { Prisma, ThreadStatus, ThreadType } from '@prisma/client';
import { prisma } from '@/lib/db';

type DbClient = Prisma.TransactionClient | typeof prisma;

export const uniqueParticipantIds = (
  ids: Array<string | null | undefined>
): string[] => Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

type CreateThreadInput = {
  reservationId?: string | null;
  status: ThreadStatus;
  type?: ThreadType;
  subject?: string | null;
  createdById: string;
  participantIds: Array<string | null | undefined>;
};

export const createThreadWithParticipants = async (
  db: DbClient,
  input: CreateThreadInput
) => {
  const participantIds = uniqueParticipantIds(input.participantIds);
  const thread = await db.messageThread.create({
    data: {
      reservationId: input.reservationId ?? null,
      status: input.status,
      type: input.type ?? ThreadType.RESERVATION,
      subject: input.subject ?? null,
      createdById: input.createdById
    }
  });

  if (participantIds.length > 0) {
    await db.messageThreadParticipant.createMany({
      data: participantIds.map((userId) => ({ threadId: thread.id, userId })),
      skipDuplicates: true
    });
  }

  return thread;
};
