-- Listing international location
ALTER TABLE "public"."Listing"
ADD COLUMN IF NOT EXISTS "region" TEXT;

-- Experience booking mode enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ExperienceBookingMode'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."ExperienceBookingMode" AS ENUM ('INSTANT', 'INQUIRY');
  END IF;
END $$;

-- Experience international location + booking semantics
ALTER TABLE "public"."Experience"
ADD COLUMN IF NOT EXISTS "country" TEXT,
ADD COLUMN IF NOT EXISTS "region" TEXT,
ADD COLUMN IF NOT EXISTS "exactAddress" TEXT,
ADD COLUMN IF NOT EXISTS "minimumAge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "infantMaxAge" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS "childMaxAge" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS "adultMinAge" INTEGER NOT NULL DEFAULT 13,
ADD COLUMN IF NOT EXISTS "bookingMode" "public"."ExperienceBookingMode" NOT NULL DEFAULT 'INSTANT';
