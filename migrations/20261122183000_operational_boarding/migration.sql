-- Add explicit gate-agent states. No existing flight is advanced automatically.
ALTER TYPE "FlightInstanceStatusType" ADD VALUE IF NOT EXISTS 'boarding';
ALTER TYPE "FlightInstanceStatusType" ADD VALUE IF NOT EXISTS 'boarding_closed';
