-- CreateEnum
CREATE TYPE "DocumentVerificationStatusType" AS ENUM ('verified', 'rejected', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "ManualPaymentEvidencePurposeType" AS ENUM ('capture', 'refund');

-- CreateEnum
CREATE TYPE "ManualPaymentEvidenceStatusType" AS ENUM ('submitted', 'approved', 'rejected', 'consumed');

-- CreateEnum
CREATE TYPE "StationAssignmentStatusType" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "MachineCredentialStatusType" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "OutboxEventStatusType" AS ENUM ('pending', 'processing', 'delivered', 'failed', 'dead_lettered');

-- AlterTable
ALTER TABLE "Bag" ADD COLUMN     "bookingSegment" TEXT,
ADD COLUMN     "checkIn" TEXT,
ADD COLUMN     "entitlementDocument" TEXT,
ADD COLUMN     "ticketCoupon" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "accessTokenHash" TEXT,
ADD COLUMN     "accessTokenVersion" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "BookingSegment" ADD COLUMN     "inventoryBucket" TEXT;

-- AlterTable
ALTER TABLE "SeatAssignment" ADD COLUMN     "occupancyKey" TEXT;

-- AlterTable
ALTER TABLE "TicketCoupon" ADD COLUMN     "checkedInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "dedupeKey" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DocumentVerification" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "verificationKey" TEXT NOT NULL DEFAULT '',
    "passenger" TEXT,
    "travelDocument" TEXT,
    "bookingSegment" TEXT,
    "status" "DocumentVerificationStatusType" DEFAULT 'verified',
    "evidenceVersion" TEXT NOT NULL DEFAULT '',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualPaymentEvidence" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "evidenceKey" TEXT NOT NULL DEFAULT '',
    "purpose" "ManualPaymentEvidencePurposeType" NOT NULL,
    "booking" TEXT,
    "payment" TEXT,
    "externalReference" TEXT NOT NULL DEFAULT '',
    "ledgerSource" TEXT NOT NULL DEFAULT '',
    "evidenceDigest" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "status" "ManualPaymentEvidenceStatusType" DEFAULT 'submitted',
    "submittedBy" TEXT,
    "approvedBy" TEXT,
    "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualPaymentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationAssignment" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "assignmentKey" TEXT NOT NULL DEFAULT '',
    "user" TEXT,
    "airport" TEXT,
    "status" "StationAssignmentStatusType" DEFAULT 'active',
    "canCheckIn" BOOLEAN NOT NULL DEFAULT false,
    "canAcceptBags" BOOLEAN NOT NULL DEFAULT false,
    "canBoard" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineCredential" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "keyId" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL DEFAULT '',
    "tokenPreview" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "scopes" JSONB DEFAULT '[]',
    "status" "MachineCredentialStatusType" DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "payload" JSONB DEFAULT '{}',
    "status" "OutboxEventStatusType" DEFAULT 'pending',
    "attemptCount" INTEGER DEFAULT 0,
    "availableAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "leasedAt" TIMESTAMP(3),
    "leaseOwner" TEXT NOT NULL DEFAULT '',
    "lastError" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "count" INTEGER DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- Backfill lifecycle ownership/accounting keys before enforcing uniqueness.
UPDATE "BookingSegment" segment
SET "inventoryBucket" = item."inventoryBucket"
FROM "OfferItem" item
WHERE segment."sourceOfferItem" = item."id" AND segment."inventoryBucket" IS NULL;

UPDATE "WebhookEvent"
SET "dedupeKey" = 'legacy:' || "id"
WHERE "dedupeKey" = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SeatAssignment" assignment
    JOIN "BookingSegment" segment ON segment."id" = assignment."bookingSegment"
    WHERE assignment."status" IN ('held', 'assigned', 'confirmed', 'boarded')
      AND assignment."seat" IS NOT NULL AND segment."flightInstance" IS NOT NULL
    GROUP BY segment."flightInstance", assignment."seat"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce seat occupancy uniqueness: duplicate active flight-seat assignments exist';
  END IF;
END $$;

UPDATE "SeatAssignment" assignment
SET "occupancyKey" = segment."flightInstance" || ':' || assignment."seat"
FROM "BookingSegment" segment
WHERE segment."id" = assignment."bookingSegment"
  AND assignment."status" IN ('held', 'assigned', 'confirmed', 'boarded')
  AND assignment."seat" IS NOT NULL AND segment."flightInstance" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVerification_verificationKey_key" ON "DocumentVerification"("verificationKey");

-- CreateIndex
CREATE INDEX "DocumentVerification_carrier_idx" ON "DocumentVerification"("carrier");

-- CreateIndex
CREATE INDEX "DocumentVerification_passenger_idx" ON "DocumentVerification"("passenger");

-- CreateIndex
CREATE INDEX "DocumentVerification_travelDocument_idx" ON "DocumentVerification"("travelDocument");

-- CreateIndex
CREATE INDEX "DocumentVerification_bookingSegment_idx" ON "DocumentVerification"("bookingSegment");

-- CreateIndex
CREATE INDEX "DocumentVerification_verifiedBy_idx" ON "DocumentVerification"("verifiedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPaymentEvidence_evidenceKey_key" ON "ManualPaymentEvidence"("evidenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "ManualPaymentEvidence_externalReference_key" ON "ManualPaymentEvidence"("externalReference");

-- CreateIndex
CREATE INDEX "ManualPaymentEvidence_carrier_idx" ON "ManualPaymentEvidence"("carrier");

-- CreateIndex
CREATE INDEX "ManualPaymentEvidence_booking_idx" ON "ManualPaymentEvidence"("booking");

-- CreateIndex
CREATE INDEX "ManualPaymentEvidence_payment_idx" ON "ManualPaymentEvidence"("payment");

-- CreateIndex
CREATE INDEX "ManualPaymentEvidence_evidenceDigest_idx" ON "ManualPaymentEvidence"("evidenceDigest");

-- CreateIndex
CREATE INDEX "ManualPaymentEvidence_submittedBy_idx" ON "ManualPaymentEvidence"("submittedBy");

-- CreateIndex
CREATE INDEX "ManualPaymentEvidence_approvedBy_idx" ON "ManualPaymentEvidence"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "StationAssignment_assignmentKey_key" ON "StationAssignment"("assignmentKey");

-- CreateIndex
CREATE INDEX "StationAssignment_carrier_idx" ON "StationAssignment"("carrier");

-- CreateIndex
CREATE INDEX "StationAssignment_user_idx" ON "StationAssignment"("user");

-- CreateIndex
CREATE INDEX "StationAssignment_airport_idx" ON "StationAssignment"("airport");

-- CreateIndex
CREATE UNIQUE INDEX "MachineCredential_keyId_key" ON "MachineCredential"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "MachineCredential_tokenHash_key" ON "MachineCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "MachineCredential_carrier_idx" ON "MachineCredential"("carrier");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventKey_key" ON "OutboxEvent"("eventKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_carrier_idx" ON "OutboxEvent"("carrier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "Bag_bookingSegment_idx" ON "Bag"("bookingSegment");

-- CreateIndex
CREATE INDEX "Bag_checkIn_idx" ON "Bag"("checkIn");

-- CreateIndex
CREATE INDEX "Bag_ticketCoupon_idx" ON "Bag"("ticketCoupon");

-- CreateIndex
CREATE INDEX "Bag_entitlementDocument_idx" ON "Bag"("entitlementDocument");

-- CreateIndex
CREATE INDEX "Booking_accessTokenHash_idx" ON "Booking"("accessTokenHash");

-- CreateIndex
CREATE INDEX "BookingSegment_inventoryBucket_idx" ON "BookingSegment"("inventoryBucket");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAssignment_occupancyKey_key" ON "SeatAssignment"("occupancyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_travelDocument_fkey" FOREIGN KEY ("travelDocument") REFERENCES "TravelDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_inventoryBucket_fkey" FOREIGN KEY ("inventoryBucket") REFERENCES "InventoryBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentEvidence" ADD CONSTRAINT "ManualPaymentEvidence_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentEvidence" ADD CONSTRAINT "ManualPaymentEvidence_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentEvidence" ADD CONSTRAINT "ManualPaymentEvidence_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentEvidence" ADD CONSTRAINT "ManualPaymentEvidence_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPaymentEvidence" ADD CONSTRAINT "ManualPaymentEvidence_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_checkIn_fkey" FOREIGN KEY ("checkIn") REFERENCES "CheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_ticketCoupon_fkey" FOREIGN KEY ("ticketCoupon") REFERENCES "TicketCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_entitlementDocument_fkey" FOREIGN KEY ("entitlementDocument") REFERENCES "ElectronicMiscDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationAssignment" ADD CONSTRAINT "StationAssignment_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationAssignment" ADD CONSTRAINT "StationAssignment_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationAssignment" ADD CONSTRAINT "StationAssignment_airport_fkey" FOREIGN KEY ("airport") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineCredential" ADD CONSTRAINT "MachineCredential_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

