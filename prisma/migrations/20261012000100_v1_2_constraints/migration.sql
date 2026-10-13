-- V1.2 bütünlük kısıtları (Prisma şemasında ifade edilemeyenler)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Geçerli zaman aralığı kısıtları (end > start)
ALTER TABLE "Appointment"  ADD CONSTRAINT check_appointment_time_range CHECK ("endTime" > "startTime");
ALTER TABLE "TimeBlock"    ADD CONSTRAINT check_timeblock_time_range   CHECK ("endTime" > "startTime");
ALTER TABLE "WorkingShift" ADD CONSTRAINT check_shift_time_range       CHECK ("endTime" > "startTime");

-- 1b. Vardiya format ve gün kısıtları (sıfır dolgulu "HH:MM" sayesinde string karşılaştırma doğru çalışır)
ALTER TABLE "WorkingShift" ADD CONSTRAINT check_shift_time_format
  CHECK ("startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "WorkingShift" ADD CONSTRAINT check_shift_day_of_week
  CHECK ("dayOfWeek" BETWEEN 0 AND 6);

-- 2. Aktif randevular için fiziksel çakışma engeli (GiST)
--    tstzrange varsayılanı '[)' → 10:00–10:30 ile 10:30–11:00 bitişik randevular çakışmaz.
ALTER TABLE "Appointment"
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    "staffId" WITH =,
    tstzrange("startTime", "endTime") WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
