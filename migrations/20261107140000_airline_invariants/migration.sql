-- Invariants the app relied on but only checked in application code (or not at all). Live data was checked for
-- violations of every rule below before this migration was written (0 rows each, 2026-11-07).
-- Prisma 6.5 cannot express partial indexes, CHECK constraints or triggers, so these live only here; their names
-- are registered in features/keystone/lib/migration-safety.ts and features/keystone/lib/constraint-errors.ts.

-- Uniqueness ---------------------------------------------------------------------------------------------------

-- A record locator names one reservation per carrier: agents and travelers look bookings up by it.
CREATE UNIQUE INDEX "Booking_carrier_recordLocator_key" ON "Booking"("carrier", "recordLocator") WHERE "recordLocator" <> '';

-- Inventory bucket and seat map keys are built from cabin and fare-brand codes, so a code must name one record.
CREATE UNIQUE INDEX "Cabin_carrier_code_key" ON "Cabin"("carrier", "code");
CREATE UNIQUE INDEX "FareBrand_carrier_code_key" ON "FareBrand"("carrier", "code");

-- One seat per designator on a seat map.
CREATE UNIQUE INDEX "Seat_seatMap_designator_key" ON "Seat"("seatMap", "designator");

-- One active station assignment per user and airport (the create form checked this before writing, racily).
CREATE UNIQUE INDEX "StationAssignment_one_active_per_user_airport" ON "StationAssignment"("user", "airport") WHERE "status" = 'active';

-- One airfare capture per booking; seat purchases are separate payments.
CREATE UNIQUE INDEX "Payment_one_fare_capture_per_booking" ON "Payment"("booking")
  WHERE "status" IN ('captured', 'partially_refunded', 'refunded') AND COALESCE("metadata"->>'purchaseKind', 'booking') <> 'seat';

-- A provider's payment reference is applied once.
CREATE UNIQUE INDEX "Payment_provider_reference_key" ON "Payment"("provider", "providerPaymentId") WHERE "providerPaymentId" <> '';

-- Money ---------------------------------------------------------------------------------------------------------

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amounts_valid" CHECK (
    "amount" > 0 AND COALESCE("authorizedAmount", 0) >= 0 AND COALESCE("capturedAmount", 0) >= 0 AND COALESCE("refundedAmount", 0) >= 0
    AND COALESCE("capturedAmount", 0) <= COALESCE("authorizedAmount", 0) AND COALESCE("refundedAmount", 0) <= COALESCE("capturedAmount", 0)
  ),
  ADD CONSTRAINT "Payment_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "Refund_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_amounts_balance" CHECK (
    "baseAmount" >= 0 AND "taxAmount" >= 0 AND "feeAmount" >= 0 AND "discountAmount" >= 0
    AND "totalAmount" = "baseAmount" + "taxAmount" + "feeAmount" - "discountAmount" AND "totalAmount" >= 0
  ),
  ADD CONSTRAINT "Booking_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Offer"
  ADD CONSTRAINT "Offer_amounts_balance" CHECK (
    "baseAmount" >= 0 AND "taxAmount" >= 0 AND "feeAmount" >= 0 AND "discountAmount" >= 0
    AND "totalAmount" = "baseAmount" + "taxAmount" + "feeAmount" - "discountAmount" AND "totalAmount" >= 0
  ),
  ADD CONSTRAINT "Offer_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "Seat"
  ADD CONSTRAINT "Seat_surcharge_non_negative" CHECK (COALESCE("surchargeAmount", 0) >= 0),
  ADD CONSTRAINT "Seat_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

-- Capacity: never sell, hold or block more than authorized, never authorize more than the cabin holds.
ALTER TABLE "InventoryBucket"
  ADD CONSTRAINT "InventoryBucket_counts_valid" CHECK (
    "capacity" >= 0 AND "authorized" >= 0 AND "sold" >= 0 AND "held" >= 0 AND "blocked" >= 0
    AND "authorized" <= "capacity" AND "sold" + "held" + "blocked" <= "authorized"
  ),
  ADD CONSTRAINT "InventoryBucket_amounts_non_negative" CHECK ("baseAmount" >= 0 AND "taxAmount" >= 0),
  ADD CONSTRAINT "InventoryBucket_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

ALTER TABLE "InventoryHold" ADD CONSTRAINT "InventoryHold_quantity_positive" CHECK ("quantity" > 0);

-- Time and network ----------------------------------------------------------------------------------------------

ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_arrives_after_departure" CHECK ("scheduledArrivalAt" > "scheduledDepartureAt");
ALTER TABLE "FlightSchedule" ADD CONSTRAINT "FlightSchedule_effective_range" CHECK ("effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "StationAssignment" ADD CONSTRAINT "StationAssignment_validity_range" CHECK ("validUntil" IS NULL OR "validFrom" IS NULL OR "validUntil" > "validFrom");
ALTER TABLE "Route" ADD CONSTRAINT "Route_distinct_endpoints" CHECK ("origin" IS NULL OR "destination" IS NULL OR "origin" <> "destination");

-- Refunds never exceed what the payment captured, and are in its currency -------------------------------------
-- The payment row is locked so two concurrent refunds are counted one after the other. Prisma drops the constraint
-- name from trigger errors, so the rule name leads the message.
CREATE FUNCTION airline_refund_within_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  paid RECORD;
  refunded BIGINT;
BEGIN
  IF NEW."payment" IS NULL THEN RETURN NULL; END IF;
  SELECT "capturedAmount", "currencyCode" INTO paid FROM "Payment" WHERE "id" = NEW."payment" FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NEW."currencyCode" <> paid."currencyCode" THEN
    RAISE EXCEPTION 'Refund_within_payment: refund currency % differs from payment currency %', NEW."currencyCode", paid."currencyCode" USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO refunded FROM "Refund"
    WHERE "payment" = NEW."payment" AND COALESCE("status"::text, 'requested') IN ('requested', 'approved', 'processing', 'succeeded');
  IF refunded > COALESCE(paid."capturedAmount", 0) THEN
    RAISE EXCEPTION 'Refund_within_payment: refunds % exceed captured %', refunded, paid."capturedAmount" USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Refund_within_payment"
  AFTER INSERT OR UPDATE OF "amount", "status", "payment", "currencyCode" ON "Refund"
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION airline_refund_within_payment();
