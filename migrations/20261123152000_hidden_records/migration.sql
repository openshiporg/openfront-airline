-- Leftover QA bookings and travelers are hidden from desk lists, never deleted.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "Passenger" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
