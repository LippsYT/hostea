CREATE TABLE IF NOT EXISTS "admin_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "auto_print_enabled" BOOLEAN NOT NULL DEFAULT false,
  "auto_print_only_paid" BOOLEAN NOT NULL DEFAULT true,
  "printer_name" TEXT,
  "copies" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "admin_settings" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "print_jobs" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reservation_id" TEXT,
  "host_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "payload" JSONB NOT NULL,
  "printed_at" TIMESTAMP(3),
  "type" TEXT NOT NULL DEFAULT 'reservation',
  CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "print_jobs_status_created_at_idx"
ON "print_jobs"("status", "created_at");

CREATE INDEX IF NOT EXISTS "print_jobs_reservation_id_idx"
ON "print_jobs"("reservation_id");

CREATE INDEX IF NOT EXISTS "print_jobs_host_id_idx"
ON "print_jobs"("host_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'print_jobs_reservation_id_fkey'
  ) THEN
    ALTER TABLE "print_jobs"
      ADD CONSTRAINT "print_jobs_reservation_id_fkey"
      FOREIGN KEY ("reservation_id") REFERENCES "Reservation"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'print_jobs_host_id_fkey'
  ) THEN
    ALTER TABLE "print_jobs"
      ADD CONSTRAINT "print_jobs_host_id_fkey"
      FOREIGN KEY ("host_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
