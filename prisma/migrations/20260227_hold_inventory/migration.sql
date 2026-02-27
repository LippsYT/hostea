-- Listing inventory per ad
ALTER TABLE "Listing"
ADD COLUMN IF NOT EXISTS "inventoryQty" INTEGER NOT NULL DEFAULT 1;

-- Temporary checkout holds (awaiting payment)
CREATE TABLE IF NOT EXISTS "CalendarHold" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'CHECKOUT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarHold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarHold_reservationId_key"
ON "CalendarHold"("reservationId");

CREATE INDEX IF NOT EXISTS "CalendarHold_listingId_startDate_endDate_expiresAt_idx"
ON "CalendarHold"("listingId", "startDate", "endDate", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarHold_listingId_fkey'
  ) THEN
    ALTER TABLE "CalendarHold"
    ADD CONSTRAINT "CalendarHold_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CalendarHold_reservationId_fkey'
  ) THEN
    ALTER TABLE "CalendarHold"
    ADD CONSTRAINT "CalendarHold_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
