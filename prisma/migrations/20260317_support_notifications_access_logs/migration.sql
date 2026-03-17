BEGIN;

ALTER TYPE public."TicketStatus" RENAME TO "TicketStatus_old";

CREATE TYPE public."TicketStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'WAITING_FOR_USER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED'
);

ALTER TABLE public."Ticket"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE public."Ticket"
  ALTER COLUMN "status" TYPE public."TicketStatus"
  USING (
    CASE
      WHEN "status"::text = 'PENDING' THEN 'IN_REVIEW'
      ELSE "status"::text
    END
  )::public."TicketStatus";

DROP TYPE public."TicketStatus_old";

ALTER TABLE public."Ticket"
  ALTER COLUMN "status" SET DEFAULT 'OPEN';

CREATE TYPE public."NotificationKind" AS ENUM ('SUCCESS', 'ERROR', 'INFO', 'WARNING');

CREATE SEQUENCE public."Ticket_caseSequence_seq";

ALTER TABLE public."Ticket"
  ADD COLUMN "caseSequence" INTEGER,
  ADD COLUMN "summary" TEXT;

UPDATE public."Ticket"
SET "caseSequence" = nextval('public."Ticket_caseSequence_seq"')
WHERE "caseSequence" IS NULL;

ALTER TABLE public."Ticket"
  ALTER COLUMN "caseSequence" SET DEFAULT nextval('public."Ticket_caseSequence_seq"'),
  ALTER COLUMN "caseSequence" SET NOT NULL;

CREATE UNIQUE INDEX "Ticket_caseSequence_key" ON public."Ticket"("caseSequence");
CREATE INDEX "Ticket_createdById_status_updatedAt_idx" ON public."Ticket"("createdById", "status", "updatedAt");

ALTER TABLE public."Ticket"
  ADD CONSTRAINT "Ticket_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES public."User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE TABLE public."Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" public."NotificationKind" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON public."Notification"("userId", "readAt", "createdAt");

ALTER TABLE public."Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TABLE public."logs_accesos" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "logs_accesos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logs_accesos_createdAt_role_idx"
  ON public."logs_accesos"("createdAt", "role");

CREATE INDEX "logs_accesos_userId_createdAt_idx"
  ON public."logs_accesos"("userId", "createdAt");

ALTER TABLE public."logs_accesos"
  ADD CONSTRAINT "logs_accesos_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES public."User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

COMMIT;
