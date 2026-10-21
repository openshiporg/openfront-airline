-- Expand first: coupon obligations and immutable lineage are nullable while
-- historical coupon/servicing records are classified in the follow-up migration.
BEGIN;
CREATE TYPE "ServiceObligationStatusType" AS ENUM ('active', 'fulfilled', 'retired');
CREATE TYPE "TicketCouponLineageTransformationType" AS ENUM ('alternative', 'split', 'consolidation');
CREATE TYPE "TicketCouponLineageOperationTypeType" AS ENUM ('exchange', 'reaccommodation', 'servicing');

ALTER TABLE "BookingSegment"
  ADD COLUMN "includedBaggageSnapshot" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "TicketCoupon"
  ADD COLUMN "serviceObligation" TEXT,
  ADD COLUMN "serviceObligationVersion" INTEGER;

CREATE TABLE "ServiceObligation" (
  "id" TEXT NOT NULL,
  "carrier" TEXT,
  "booking" TEXT,
  "bookingPassenger" TEXT,
  "obligationKey" TEXT NOT NULL DEFAULT '',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "ServiceObligationStatusType" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketCouponLineage" (
  "id" TEXT NOT NULL,
  "carrier" TEXT,
  "bookingPassenger" TEXT,
  "lineageKey" TEXT NOT NULL DEFAULT '',
  "changeSetKey" TEXT NOT NULL DEFAULT '',
  "transformation" "TicketCouponLineageTransformationType" NOT NULL,
  "operationType" "TicketCouponLineageOperationTypeType" NOT NULL,
  "operationId" TEXT NOT NULL DEFAULT '',
  "parentCoupon" TEXT,
  "childCoupon" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketCouponLineage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceObligation_obligationKey_key" ON "ServiceObligation"("obligationKey");
CREATE INDEX "ServiceObligation_carrier_idx" ON "ServiceObligation"("carrier");
CREATE INDEX "ServiceObligation_booking_idx" ON "ServiceObligation"("booking");
CREATE INDEX "ServiceObligation_bookingPassenger_idx" ON "ServiceObligation"("bookingPassenger");
CREATE INDEX "TicketCouponLineage_carrier_idx" ON "TicketCouponLineage"("carrier");
CREATE INDEX "TicketCouponLineage_bookingPassenger_idx" ON "TicketCouponLineage"("bookingPassenger");
CREATE INDEX "TicketCouponLineage_changeSetKey_idx" ON "TicketCouponLineage"("changeSetKey");
CREATE INDEX "TicketCouponLineage_parentCoupon_idx" ON "TicketCouponLineage"("parentCoupon");
CREATE INDEX "TicketCouponLineage_childCoupon_idx" ON "TicketCouponLineage"("childCoupon");
CREATE INDEX "TicketCoupon_serviceObligation_idx" ON "TicketCoupon"("serviceObligation");

ALTER TABLE "ServiceObligation"
  ADD CONSTRAINT "ServiceObligation_carrier_fkey"
  FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "ServiceObligation_booking_fkey"
  FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "ServiceObligation_bookingPassenger_fkey"
  FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "TicketCouponLineage"
  ADD CONSTRAINT "TicketCouponLineage_carrier_fkey"
  FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "TicketCouponLineage_bookingPassenger_fkey"
  FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "TicketCouponLineage_parentCoupon_fkey"
  FOREIGN KEY ("parentCoupon") REFERENCES "TicketCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "TicketCouponLineage_childCoupon_fkey"
  FOREIGN KEY ("childCoupon") REFERENCES "TicketCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "TicketCoupon"
  ADD CONSTRAINT "TicketCoupon_serviceObligation_fkey"
  FOREIGN KEY ("serviceObligation") REFERENCES "ServiceObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

COMMIT;
