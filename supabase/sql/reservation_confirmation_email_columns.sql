-- Hostea: estado de email de confirmacion por reserva
-- Ejecutar una sola vez en Supabase SQL Editor.

ALTER TABLE public."Reservation"
  ADD COLUMN IF NOT EXISTS confirmation_email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_error text;

CREATE INDEX IF NOT EXISTS reservation_confirmation_email_sent_idx
  ON public."Reservation"(confirmation_email_sent, confirmation_email_sent_at);
