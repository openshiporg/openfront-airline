-- Backfill one independent ServiceObligation per historical coupon first. The
-- historical operation records then explicitly connect alternatives, splits,
-- and consolidations; no copied segment identifier is used as uniqueness scope.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "TicketCoupon" coupon
    LEFT JOIN "Ticket" ticket ON ticket."id" = coupon."ticket"
    LEFT JOIN "BookingSegment" segment ON segment."id" = coupon."bookingSegment"
    LEFT JOIN "BookingPassenger" booking_passenger ON booking_passenger."id" = ticket."bookingPassenger"
    WHERE coupon."ticket" IS NULL OR coupon."bookingSegment" IS NULL
      OR ticket."bookingPassenger" IS NULL OR ticket."booking" IS NULL OR ticket."carrier" IS NULL
      OR coupon."carrier" IS DISTINCT FROM ticket."carrier"
      OR ticket."booking" IS DISTINCT FROM segment."booking"
      OR booking_passenger."booking" IS DISTINCT FROM ticket."booking"
      OR booking_passenger."carrier" IS DISTINCT FROM ticket."carrier"
  ) THEN
    RAISE EXCEPTION 'A historical coupon lacks consistent ticket, passenger, booking, carrier, or segment ownership; reconcile before obligation migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Exchange" operation_record
    WHERE operation_record."status" = 'completed'
      AND ((SELECT COUNT(*) FROM "_BookingSegment_exchangesAsOriginal" l WHERE l."B" = operation_record."id") = 0
        OR (SELECT COUNT(*) FROM "_BookingSegment_exchangesAsReplacement" l WHERE l."B" = operation_record."id") = 0)
  ) OR EXISTS (
    SELECT 1 FROM "Reaccommodation" operation_record
    WHERE operation_record."status" = 'confirmed'
      AND ((SELECT COUNT(*) FROM "_BookingSegment_reaccommodationsAsOriginal" l WHERE l."B" = operation_record."id") = 0
        OR (SELECT COUNT(*) FROM "_BookingSegment_reaccommodationsAsReplacement" l WHERE l."B" = operation_record."id") = 0)
  ) THEN
    RAISE EXCEPTION 'A completed exchange/reaccommodation lacks parent or child segments; reconcile before obligation migration.';
  END IF;
END $$;

CREATE TEMP TABLE "_CouponSegmentEdges" ON COMMIT DROP AS
WITH exchange_counts AS (
  SELECT operation_record."id", operation_record."booking", operation_record."carrier",
    COUNT(DISTINCT original_link."A")::integer AS parent_count,
    COUNT(DISTINCT replacement_link."A")::integer AS child_count
  FROM "Exchange" operation_record
  LEFT JOIN "_BookingSegment_exchangesAsOriginal" original_link ON original_link."B" = operation_record."id"
  LEFT JOIN "_BookingSegment_exchangesAsReplacement" replacement_link ON replacement_link."B" = operation_record."id"
  WHERE operation_record."status" = 'completed'
  GROUP BY operation_record."id", operation_record."booking", operation_record."carrier"
), reaccommodation_counts AS (
  SELECT operation_record."id", operation_record."booking", operation_record."carrier",
    COUNT(DISTINCT original_link."A")::integer AS parent_count,
    COUNT(DISTINCT replacement_link."A")::integer AS child_count
  FROM "Reaccommodation" operation_record
  LEFT JOIN "_BookingSegment_reaccommodationsAsOriginal" original_link ON original_link."B" = operation_record."id"
  LEFT JOIN "_BookingSegment_reaccommodationsAsReplacement" replacement_link ON replacement_link."B" = operation_record."id"
  WHERE operation_record."status" = 'confirmed'
  GROUP BY operation_record."id", operation_record."booking", operation_record."carrier"
), operations AS (
  SELECT 'exchange'::text AS operation_type, id AS operation_id, "booking" AS booking_id, "carrier" AS operation_carrier, parent_count, child_count FROM exchange_counts
  UNION ALL
  SELECT 'reaccommodation', id, "booking", "carrier", parent_count, child_count FROM reaccommodation_counts
)
SELECT operation.operation_type, operation.operation_id, operation.booking_id, operation.operation_carrier,
  original_link."A" AS parent_segment, replacement_link."A" AS child_segment,
  operation.parent_count, operation.child_count,
  CASE WHEN operation.parent_count = 1 AND operation.child_count = 1 THEN 'alternative'
    WHEN operation.parent_count = 1 THEN 'split'
    ELSE 'consolidation' END AS transformation
FROM operations operation
JOIN "_BookingSegment_exchangesAsOriginal" original_link
  ON operation.operation_type = 'exchange' AND original_link."B" = operation.operation_id
JOIN "_BookingSegment_exchangesAsReplacement" replacement_link
  ON replacement_link."B" = operation.operation_id
UNION ALL
SELECT operation.operation_type, operation.operation_id, operation.booking_id, operation.operation_carrier,
  original_link."A", replacement_link."A", operation.parent_count, operation.child_count,
  CASE WHEN operation.parent_count = 1 AND operation.child_count = 1 THEN 'alternative'
    WHEN operation.parent_count = 1 THEN 'split'
    ELSE 'consolidation' END
FROM operations operation
JOIN "_BookingSegment_reaccommodationsAsOriginal" original_link
  ON operation.operation_type = 'reaccommodation' AND original_link."B" = operation.operation_id
JOIN "_BookingSegment_reaccommodationsAsReplacement" replacement_link
  ON replacement_link."B" = operation.operation_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "_CouponSegmentEdges" WHERE "parent_count" > 1 AND "child_count" > 1) THEN
    RAISE EXCEPTION 'Historical many-to-many coupon transformations are ambiguous; reconcile explicitly before obligation migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "_CouponSegmentEdges" edge
    JOIN "BookingSegment" parent_segment ON parent_segment."id" = edge."parent_segment"
    JOIN "BookingSegment" child_segment ON child_segment."id" = edge."child_segment"
    WHERE edge."parent_segment" = edge."child_segment"
      OR edge."booking_id" IS NULL
      OR parent_segment."booking" IS DISTINCT FROM edge."booking_id"
      OR child_segment."booking" IS DISTINCT FROM edge."booking_id"
      OR parent_segment."carrier" IS DISTINCT FROM child_segment."carrier"
      OR parent_segment."carrier" IS DISTINCT FROM edge."operation_carrier"
  ) THEN
    RAISE EXCEPTION 'Historical coupon transformation crosses bookings/carriers; reconcile before obligation migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "_CouponSegmentEdges" edge
    JOIN "TicketCoupon" parent_coupon ON parent_coupon."bookingSegment" = edge."parent_segment"
    JOIN "Ticket" parent_ticket ON parent_ticket."id" = parent_coupon."ticket"
    JOIN "BookingPassenger" parent_passenger ON parent_passenger."id" = parent_ticket."bookingPassenger"
    JOIN "TicketCoupon" child_coupon ON child_coupon."bookingSegment" = edge."child_segment"
    JOIN "Ticket" child_ticket ON child_ticket."id" = child_coupon."ticket"
    JOIN "BookingPassenger" child_passenger ON child_passenger."id" = child_ticket."bookingPassenger"
    WHERE parent_ticket."booking" IS DISTINCT FROM edge."booking_id"
      OR child_ticket."booking" IS DISTINCT FROM edge."booking_id"
      OR parent_ticket."carrier" IS DISTINCT FROM edge."operation_carrier"
      OR child_ticket."carrier" IS DISTINCT FROM edge."operation_carrier"
      OR parent_passenger."booking" IS DISTINCT FROM edge."booking_id"
      OR child_passenger."booking" IS DISTINCT FROM edge."booking_id"
      OR parent_passenger."carrier" IS DISTINCT FROM edge."operation_carrier"
      OR child_passenger."carrier" IS DISTINCT FROM edge."operation_carrier"
      OR parent_coupon."carrier" IS DISTINCT FROM parent_ticket."carrier"
      OR child_coupon."carrier" IS DISTINCT FROM child_ticket."carrier"
  ) THEN RAISE EXCEPTION 'Historical coupon lineage crosses ticket/passenger/carrier ownership; reconcile before obligation migration.'; END IF;
  IF EXISTS (
    SELECT 1 FROM "_CouponSegmentEdges" edge
    JOIN "TicketCoupon" parent_coupon ON parent_coupon."bookingSegment" = edge."parent_segment"
    JOIN "Ticket" parent_ticket ON parent_ticket."id" = parent_coupon."ticket"
    WHERE NOT EXISTS (
      SELECT 1 FROM "TicketCoupon" child_coupon
      JOIN "Ticket" child_ticket ON child_ticket."id" = child_coupon."ticket"
      WHERE child_coupon."bookingSegment" = edge."child_segment"
        AND child_ticket."bookingPassenger" = parent_ticket."bookingPassenger"
    )
  ) OR EXISTS (
    SELECT 1 FROM "_CouponSegmentEdges" edge
    JOIN "TicketCoupon" child_coupon ON child_coupon."bookingSegment" = edge."child_segment"
    JOIN "Ticket" child_ticket ON child_ticket."id" = child_coupon."ticket"
    WHERE NOT EXISTS (
      SELECT 1 FROM "TicketCoupon" parent_coupon
      JOIN "Ticket" parent_ticket ON parent_ticket."id" = parent_coupon."ticket"
      WHERE parent_coupon."bookingSegment" = edge."parent_segment"
        AND parent_ticket."bookingPassenger" = child_ticket."bookingPassenger"
    )
  ) THEN
    RAISE EXCEPTION 'A historical coupon transformation is missing a same-passenger parent or child coupon; reconcile before obligation migration.';
  END IF;
  IF EXISTS (
    SELECT edge."operation_type", edge."operation_id", edge."parent_segment", edge."child_segment", parent_ticket."bookingPassenger"
    FROM "_CouponSegmentEdges" edge
    JOIN "TicketCoupon" parent_coupon ON parent_coupon."bookingSegment" = edge."parent_segment"
    JOIN "Ticket" parent_ticket ON parent_ticket."id" = parent_coupon."ticket"
    LEFT JOIN "TicketCoupon" child_coupon ON child_coupon."bookingSegment" = edge."child_segment"
    LEFT JOIN "Ticket" child_ticket ON child_ticket."id" = child_coupon."ticket"
      AND child_ticket."bookingPassenger" = parent_ticket."bookingPassenger"
    GROUP BY edge."operation_type", edge."operation_id", edge."parent_segment", edge."child_segment", parent_ticket."bookingPassenger"
    HAVING COUNT(DISTINCT parent_coupon."id") <> 1 OR COUNT(DISTINCT child_coupon."id") <> 1
  ) THEN
    RAISE EXCEPTION 'Historical coupon transformation has multiple same-passenger coupons for one segment edge; reconcile before obligation migration.';
  END IF;
END $$;

CREATE TEMP TABLE "_CouponObligationBackfill" (
  "coupon_id" TEXT PRIMARY KEY,
  "obligation_id" TEXT NOT NULL
) ON COMMIT DROP;
INSERT INTO "_CouponObligationBackfill" ("coupon_id", "obligation_id")
SELECT coupon."id", gen_random_uuid()::text FROM "TicketCoupon" coupon;

INSERT INTO "ServiceObligation" (
  "id", "carrier", "booking", "bookingPassenger", "obligationKey", "currentVersion", "status", "createdAt", "updatedAt"
)
SELECT mapping."obligation_id", ticket."carrier", ticket."booking", ticket."bookingPassenger",
  'backfill:' || coupon."id", 1, 'active', coupon."createdAt", CURRENT_TIMESTAMP
FROM "_CouponObligationBackfill" mapping
JOIN "TicketCoupon" coupon ON coupon."id" = mapping."coupon_id"
JOIN "Ticket" ticket ON ticket."id" = coupon."ticket";

UPDATE "TicketCoupon" coupon
SET "serviceObligation" = mapping."obligation_id", "serviceObligationVersion" = 1
FROM "_CouponObligationBackfill" mapping
WHERE coupon."id" = mapping."coupon_id";

CREATE TEMP TABLE "_CouponLineageBackfill" ON COMMIT DROP AS
SELECT edge."operation_type", edge."operation_id", edge."transformation",
  parent_ticket."bookingPassenger" AS "booking_passenger",
  parent_coupon."id" AS "parent_coupon", child_coupon."id" AS "child_coupon",
  parent_coupon."serviceObligation" AS "parent_obligation",
  child_coupon."serviceObligation" AS "child_obligation",
  parent_coupon."serviceObligationVersion" AS "parent_version",
  parent_coupon."status" AS "parent_status", child_coupon."status" AS "child_status"
FROM "_CouponSegmentEdges" edge
JOIN "TicketCoupon" parent_coupon ON parent_coupon."bookingSegment" = edge."parent_segment"
JOIN "Ticket" parent_ticket ON parent_ticket."id" = parent_coupon."ticket"
JOIN "TicketCoupon" child_coupon ON child_coupon."bookingSegment" = edge."child_segment"
JOIN "Ticket" child_ticket ON child_ticket."id" = child_coupon."ticket"
  AND child_ticket."bookingPassenger" = parent_ticket."bookingPassenger";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_CouponLineageBackfill" WHERE "parent_status" <> 'exchanged'
  ) THEN
    RAISE EXCEPTION 'A historical transformation parent is not retired as exchanged; reconcile before obligation migration.';
  END IF;
  IF EXISTS (
    SELECT parent_coupon FROM "_CouponLineageBackfill" WHERE "transformation" = 'alternative'
    GROUP BY parent_coupon HAVING COUNT(DISTINCT child_coupon) > 1
  ) OR EXISTS (
    SELECT child_coupon FROM "_CouponLineageBackfill" WHERE "transformation" = 'alternative'
    GROUP BY child_coupon HAVING COUNT(DISTINCT parent_coupon) > 1
  ) THEN
    RAISE EXCEPTION 'Historical alternative coupon lineage branches or merges ambiguously; reconcile before obligation migration.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE edges AS (
      SELECT "parent_coupon" AS parent_id, "child_coupon" AS child_id FROM "_CouponLineageBackfill"
    ), reach(root_id, current_id) AS (
      SELECT parent_id, child_id FROM edges
      UNION
      SELECT reach.root_id, edge.child_id FROM reach JOIN edges edge ON edge.parent_id = reach.current_id
    )
    SELECT 1 FROM reach WHERE root_id = current_id
  ) THEN
    RAISE EXCEPTION 'Historical coupon parent-to-child lineage contains a cycle; reconcile before obligation migration.';
  END IF;
END $$;

CREATE TEMP TABLE "_AlternativeCouponVersions" ON COMMIT DROP AS
WITH RECURSIVE edges AS (
  SELECT "parent_coupon" AS parent_id, "child_coupon" AS child_id
  FROM "_CouponLineageBackfill" WHERE "transformation" = 'alternative'
), roots AS (
  SELECT DISTINCT parent_id FROM edges
  EXCEPT
  SELECT DISTINCT child_id FROM edges
), paths(root_coupon, coupon_id, coupon_version, path) AS (
  SELECT parent_id, parent_id, 1, ARRAY[parent_id]::text[] FROM roots
  UNION ALL
  SELECT paths.root_coupon, edge.child_id, paths.coupon_version + 1, paths.path || edge.child_id
  FROM paths JOIN edges edge ON edge.parent_id = paths.coupon_id
  WHERE NOT edge.child_id = ANY(paths.path)
)
SELECT root_coupon, coupon_id, coupon_version FROM paths;

-- Alternatives share the root obligation but keep immutable coupon versions.
-- Split/consolidation children keep their separately allocated new obligations.
UPDATE "ServiceObligation" root_obligation
SET "currentVersion" = versions.max_version, "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT root_coupon, MAX(coupon_version)::integer AS max_version
  FROM "_AlternativeCouponVersions" GROUP BY root_coupon
) versions
JOIN "_CouponObligationBackfill" root_mapping ON root_mapping."coupon_id" = versions.root_coupon
WHERE root_obligation."id" = root_mapping."obligation_id";

UPDATE "TicketCoupon" coupon
SET "serviceObligation" = root_mapping."obligation_id", "serviceObligationVersion" = versions.coupon_version
FROM "_AlternativeCouponVersions" versions
JOIN "_CouponObligationBackfill" root_mapping ON root_mapping."coupon_id" = versions.root_coupon
WHERE coupon."id" = versions.coupon_id;

DELETE FROM "ServiceObligation" obligation
WHERE obligation."id" IN (
  SELECT mapping."obligation_id" FROM "_CouponObligationBackfill" mapping
  JOIN "_AlternativeCouponVersions" versions ON versions.coupon_id = mapping."coupon_id"
  WHERE mapping."coupon_id" <> versions.root_coupon
);

UPDATE "ServiceObligation" obligation
SET "status" = 'retired', "updatedAt" = CURRENT_TIMESTAMP
WHERE obligation."id" IN (
  SELECT DISTINCT parent_coupon."serviceObligation"
  FROM "_CouponLineageBackfill" lineage
  JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parent_coupon"
  WHERE lineage."transformation" IN ('split', 'consolidation')
);

INSERT INTO "TicketCouponLineage" (
  "id", "carrier", "bookingPassenger", "lineageKey", "changeSetKey", "transformation", "operationType", "operationId",
  "parentCoupon", "childCoupon", "metadata", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text,
  ticket."carrier", lineage."booking_passenger",
  'legacy:' || md5(lineage."operation_type" || ':' || lineage."operation_id" || ':' || lineage."parent_coupon" || ':' || lineage."child_coupon"),
  'legacy:' || lineage."operation_type" || ':' || lineage."operation_id" || ':' || lineage."booking_passenger",
  lineage."transformation"::"TicketCouponLineageTransformationType",
  lineage."operation_type"::"TicketCouponLineageOperationTypeType", lineage."operation_id",
  lineage."parent_coupon", lineage."child_coupon", '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_CouponLineageBackfill" lineage
JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parent_coupon"
JOIN "Ticket" ticket ON ticket."id" = parent_coupon."ticket";

DO $$
BEGIN
  IF EXISTS (
    SELECT lineage."changeSetKey" FROM "TicketCouponLineage" lineage
    GROUP BY lineage."changeSetKey"
    HAVING COUNT(DISTINCT lineage."transformation") <> 1
      OR COUNT(DISTINCT lineage."operationType") <> 1
      OR COUNT(DISTINCT lineage."operationId") <> 1
      OR COUNT(DISTINCT lineage."bookingPassenger") <> 1
  ) THEN RAISE EXCEPTION 'Historical coupon lineage change sets mix operations, passengers, or transformation types.'; END IF;
  IF EXISTS (
    SELECT lineage."changeSetKey" FROM "TicketCouponLineage" lineage
    GROUP BY lineage."changeSetKey", lineage."transformation"
    HAVING (lineage."transformation" = 'alternative' AND COUNT(*) <> 1)
      OR (lineage."transformation" = 'split' AND (COUNT(DISTINCT lineage."parentCoupon") <> 1 OR COUNT(DISTINCT lineage."childCoupon") < 2 OR COUNT(*) <> COUNT(DISTINCT lineage."childCoupon")))
      OR (lineage."transformation" = 'consolidation' AND (COUNT(DISTINCT lineage."parentCoupon") < 2 OR COUNT(DISTINCT lineage."childCoupon") <> 1 OR COUNT(*) <> COUNT(DISTINCT lineage."parentCoupon")))
  ) THEN RAISE EXCEPTION 'Historical coupon lineage cardinality does not match its alternative/split/consolidation shape.'; END IF;
  IF EXISTS (
    SELECT 1 FROM "TicketCouponLineage" lineage
    JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parentCoupon"
    JOIN "TicketCoupon" child_coupon ON child_coupon."id" = lineage."childCoupon"
    JOIN "ServiceObligation" parent_obligation ON parent_obligation."id" = parent_coupon."serviceObligation"
    JOIN "ServiceObligation" child_obligation ON child_obligation."id" = child_coupon."serviceObligation"
    WHERE (lineage."transformation" = 'alternative' AND (
        parent_coupon."serviceObligation" IS DISTINCT FROM child_coupon."serviceObligation"
        OR child_coupon."serviceObligationVersion" <> parent_coupon."serviceObligationVersion" + 1
        OR child_obligation."currentVersion" < child_coupon."serviceObligationVersion"))
      OR (lineage."transformation" = 'split' AND (
        parent_obligation."status" <> 'retired'
        OR parent_coupon."serviceObligation" = child_coupon."serviceObligation"
        OR child_coupon."serviceObligationVersion" <> 1))
      OR (lineage."transformation" = 'consolidation' AND (
        parent_obligation."status" <> 'retired'
        OR parent_coupon."serviceObligation" = child_coupon."serviceObligation"
        OR child_coupon."serviceObligationVersion" <> 1))
  ) THEN RAISE EXCEPTION 'Historical coupon lineage does not preserve versioned obligations or retire required parents.'; END IF;
END $$;

UPDATE "ServiceObligation" obligation
SET "status" = 'retired', "updatedAt" = CURRENT_TIMESTAMP
WHERE obligation."status" = 'active'
  AND EXISTS (SELECT 1 FROM "TicketCoupon" coupon WHERE coupon."serviceObligation" = obligation."id" AND coupon."serviceObligationVersion" = obligation."currentVersion" AND coupon."status" IN ('refunded', 'voided'));
UPDATE "ServiceObligation" obligation
SET "status" = 'fulfilled', "updatedAt" = CURRENT_TIMESTAMP
WHERE obligation."status" = 'active'
  AND EXISTS (SELECT 1 FROM "TicketCoupon" coupon WHERE coupon."serviceObligation" = obligation."id" AND coupon."serviceObligationVersion" = obligation."currentVersion" AND coupon."status" = 'flown');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TicketCoupon" WHERE "serviceObligation" IS NULL OR "serviceObligationVersion" IS NULL OR "serviceObligationVersion" < 1) THEN
    RAISE EXCEPTION 'A historical coupon lacks a valid versioned service obligation.';
  END IF;
  IF EXISTS (SELECT 1 FROM "ServiceObligation" WHERE "carrier" IS NULL OR "booking" IS NULL OR "bookingPassenger" IS NULL OR "obligationKey" = '' OR "currentVersion" < 1) THEN
    RAISE EXCEPTION 'A historical service obligation lacks required booking/passenger ownership or version data.';
  END IF;
  IF EXISTS (
    SELECT "serviceObligation" FROM "TicketCoupon"
    WHERE "status" IN ('open', 'checked_in') GROUP BY "serviceObligation" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Historical data contains multiple spendable coupons for one service obligation; reconcile before migration.';
  END IF;
END $$;

ALTER TABLE "TicketCoupon"
  ALTER COLUMN "serviceObligation" SET NOT NULL,
  ALTER COLUMN "serviceObligationVersion" SET NOT NULL,
  ADD CONSTRAINT "TicketCoupon_serviceObligationVersion_positive" CHECK ("serviceObligationVersion" > 0) NOT VALID;
ALTER TABLE "TicketCoupon" VALIDATE CONSTRAINT "TicketCoupon_serviceObligationVersion_positive";
ALTER TABLE "ServiceObligation"
  ALTER COLUMN "carrier" SET NOT NULL,
  ALTER COLUMN "booking" SET NOT NULL,
  ALTER COLUMN "bookingPassenger" SET NOT NULL,
  ADD CONSTRAINT "ServiceObligation_currentVersion_positive" CHECK ("currentVersion" > 0) NOT VALID,
  ADD CONSTRAINT "ServiceObligation_obligationKey_required" CHECK ("obligationKey" <> '') NOT VALID;
ALTER TABLE "ServiceObligation"
  VALIDATE CONSTRAINT "ServiceObligation_currentVersion_positive",
  VALIDATE CONSTRAINT "ServiceObligation_obligationKey_required";
ALTER TABLE "TicketCouponLineage"
  ALTER COLUMN "carrier" SET NOT NULL,
  ALTER COLUMN "bookingPassenger" SET NOT NULL,
  ALTER COLUMN "lineageKey" SET NOT NULL,
  ALTER COLUMN "changeSetKey" SET NOT NULL,
  ALTER COLUMN "operationId" SET NOT NULL,
  ALTER COLUMN "parentCoupon" SET NOT NULL,
  ALTER COLUMN "childCoupon" SET NOT NULL,
  ADD CONSTRAINT "TicketCouponLineage_distinct_coupons" CHECK ("parentCoupon" <> "childCoupon") NOT VALID,
  ADD CONSTRAINT "TicketCouponLineage_keys_required" CHECK ("lineageKey" <> '' AND "changeSetKey" <> '' AND "operationId" <> '') NOT VALID;
ALTER TABLE "TicketCouponLineage"
  VALIDATE CONSTRAINT "TicketCouponLineage_distinct_coupons",
  VALIDATE CONSTRAINT "TicketCouponLineage_keys_required";

ALTER TABLE "ServiceObligation" VALIDATE CONSTRAINT "ServiceObligation_carrier_fkey";
ALTER TABLE "ServiceObligation" VALIDATE CONSTRAINT "ServiceObligation_booking_fkey";
ALTER TABLE "ServiceObligation" VALIDATE CONSTRAINT "ServiceObligation_bookingPassenger_fkey";
ALTER TABLE "TicketCoupon" VALIDATE CONSTRAINT "TicketCoupon_serviceObligation_fkey";
ALTER TABLE "TicketCouponLineage" VALIDATE CONSTRAINT "TicketCouponLineage_carrier_fkey";
ALTER TABLE "TicketCouponLineage" VALIDATE CONSTRAINT "TicketCouponLineage_bookingPassenger_fkey";
ALTER TABLE "TicketCouponLineage" VALIDATE CONSTRAINT "TicketCouponLineage_parentCoupon_fkey";
ALTER TABLE "TicketCouponLineage" VALIDATE CONSTRAINT "TicketCouponLineage_childCoupon_fkey";

CREATE UNIQUE INDEX "TicketCouponLineage_lineageKey_key" ON "TicketCouponLineage"("lineageKey");
CREATE UNIQUE INDEX "TicketCouponLineage_parentCoupon_childCoupon_key" ON "TicketCouponLineage"("parentCoupon", "childCoupon");
CREATE UNIQUE INDEX "TicketCoupon_one_spendable_coupon_per_service_obligation"
  ON "TicketCoupon"("serviceObligation") WHERE "status" IN ('open', 'checked_in');

CREATE OR REPLACE FUNCTION airline_guard_service_obligation_update() RETURNS trigger AS $$
BEGIN
  IF NEW."obligationKey" IS DISTINCT FROM OLD."obligationKey"
    OR NEW."carrier" IS DISTINCT FROM OLD."carrier"
    OR NEW."booking" IS DISTINCT FROM OLD."booking"
    OR NEW."bookingPassenger" IS DISTINCT FROM OLD."bookingPassenger" THEN
    RAISE EXCEPTION 'Service obligation identity and ownership are immutable.';
  END IF;
  IF NEW."currentVersion" IS DISTINCT FROM OLD."currentVersion" THEN
    IF OLD."status" <> 'active' OR NEW."status" <> 'active' OR NEW."currentVersion" <> OLD."currentVersion" + 1 THEN
      RAISE EXCEPTION 'An active service obligation version may advance exactly once.';
    END IF;
    IF EXISTS (SELECT 1 FROM "TicketCoupon" coupon WHERE coupon."serviceObligation" = OLD."id" AND coupon."status" IN ('open', 'checked_in')) THEN
      RAISE EXCEPTION 'Retire the current spendable coupon before advancing its service obligation.';
    END IF;
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF OLD."status" <> 'active' OR NEW."status" NOT IN ('fulfilled', 'retired') THEN
      RAISE EXCEPTION 'Fulfilled and retired service obligations are terminal.';
    END IF;
    IF EXISTS (SELECT 1 FROM "TicketCoupon" coupon WHERE coupon."serviceObligation" = OLD."id" AND coupon."status" IN ('open', 'checked_in')) THEN
      RAISE EXCEPTION 'Retire spendable coupons before closing a service obligation.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ServiceObligation_update_guard"
BEFORE UPDATE ON "ServiceObligation"
FOR EACH ROW EXECUTE FUNCTION airline_guard_service_obligation_update();

CREATE OR REPLACE FUNCTION airline_immutable_service_obligation_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Service obligation history is immutable; retire the obligation instead of deleting it.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ServiceObligation_delete_guard"
BEFORE DELETE ON "ServiceObligation"
FOR EACH ROW EXECUTE FUNCTION airline_immutable_service_obligation_delete();

CREATE OR REPLACE FUNCTION airline_guard_ticket_coupon_obligation() RETURNS trigger AS $$
DECLARE
  obligation_version INTEGER;
  obligation_status "ServiceObligationStatusType";
  obligation_carrier TEXT;
  obligation_booking TEXT;
  obligation_passenger TEXT;
  ticket_carrier TEXT;
  ticket_booking TEXT;
  ticket_passenger TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."carrier" IS DISTINCT FROM OLD."carrier"
    OR NEW."couponKey" IS DISTINCT FROM OLD."couponKey"
    OR NEW."ticket" IS DISTINCT FROM OLD."ticket"
    OR NEW."bookingSegment" IS DISTINCT FROM OLD."bookingSegment"
    OR NEW."serviceObligation" IS DISTINCT FROM OLD."serviceObligation"
    OR NEW."serviceObligationVersion" IS DISTINCT FROM OLD."serviceObligationVersion"
    OR NEW."couponNumber" IS DISTINCT FROM OLD."couponNumber"
  ) THEN
    RAISE EXCEPTION 'Coupon identity, segment, ticket, obligation, and version are immutable; create a child coupon.';
  END IF;
  IF NEW."status" IN ('open', 'checked_in') THEN
    SELECT obligation."currentVersion", obligation."status", obligation."carrier", obligation."booking", obligation."bookingPassenger"
    INTO obligation_version, obligation_status, obligation_carrier, obligation_booking, obligation_passenger
    FROM "ServiceObligation" obligation WHERE obligation."id" = NEW."serviceObligation" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Spendable coupon requires a service obligation.'; END IF;
    SELECT ticket."carrier", ticket."booking", ticket."bookingPassenger"
    INTO ticket_carrier, ticket_booking, ticket_passenger
    FROM "Ticket" ticket WHERE ticket."id" = NEW."ticket";
    IF NOT FOUND THEN RAISE EXCEPTION 'Spendable coupon requires a ticket.'; END IF;
    IF obligation_status <> 'active' OR obligation_version <> NEW."serviceObligationVersion"
      OR obligation_carrier IS DISTINCT FROM NEW."carrier"
      OR obligation_booking IS DISTINCT FROM ticket_booking
      OR obligation_passenger IS DISTINCT FROM ticket_passenger
      OR ticket_carrier IS DISTINCT FROM NEW."carrier" THEN
      RAISE EXCEPTION 'Spendable coupon does not match the active current-version passenger service obligation.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TicketCoupon_obligation_guard"
BEFORE INSERT OR UPDATE ON "TicketCoupon"
FOR EACH ROW EXECUTE FUNCTION airline_guard_ticket_coupon_obligation();

CREATE OR REPLACE FUNCTION airline_immutable_ticket_coupon_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Coupon history is immutable; change its lifecycle status instead of deleting it.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TicketCoupon_delete_guard"
BEFORE DELETE ON "TicketCoupon"
FOR EACH ROW EXECUTE FUNCTION airline_immutable_ticket_coupon_delete();

CREATE OR REPLACE FUNCTION airline_immutable_coupon_lineage() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Ticket coupon lineage is immutable.';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TicketCouponLineage_immutable_update"
BEFORE UPDATE OR DELETE ON "TicketCouponLineage"
FOR EACH ROW EXECUTE FUNCTION airline_immutable_coupon_lineage();

CREATE OR REPLACE FUNCTION airline_validate_coupon_lineage_change() RETURNS trigger AS $$
DECLARE
  edge_count INTEGER;
  parent_count INTEGER;
  child_count INTEGER;
  transformation TEXT;
  transformation_max TEXT;
  operation_type TEXT;
  operation_type_max TEXT;
  operation_count INTEGER;
  passenger_count INTEGER;
  parent_obligation_count INTEGER;
  child_obligation_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT lineage."parentCoupon"), COUNT(DISTINCT lineage."childCoupon"),
    MIN(lineage."transformation"::text), MAX(lineage."transformation"::text),
    MIN(lineage."operationType"::text), MAX(lineage."operationType"::text),
    COUNT(DISTINCT lineage."operationId"), COUNT(DISTINCT lineage."bookingPassenger")
  INTO edge_count, parent_count, child_count, transformation, transformation_max,
    operation_type, operation_type_max, operation_count, passenger_count
  FROM "TicketCouponLineage" lineage WHERE lineage."changeSetKey" = NEW."changeSetKey";

  IF edge_count = 0 OR transformation IS DISTINCT FROM transformation_max
    OR operation_type IS DISTINCT FROM operation_type_max OR operation_count <> 1 OR passenger_count <> 1 THEN
    RAISE EXCEPTION 'Coupon lineage change set is incomplete or mixes passengers/operations/transformation types.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "TicketCouponLineage" lineage
    JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parentCoupon"
    JOIN "TicketCoupon" child_coupon ON child_coupon."id" = lineage."childCoupon"
    WHERE lineage."changeSetKey" = NEW."changeSetKey"
      AND (lineage."bookingPassenger" IS DISTINCT FROM (
            SELECT ticket."bookingPassenger" FROM "Ticket" ticket WHERE ticket."id" = parent_coupon."ticket")
        OR lineage."bookingPassenger" IS DISTINCT FROM (
            SELECT ticket."bookingPassenger" FROM "Ticket" ticket WHERE ticket."id" = child_coupon."ticket")
        OR parent_coupon."carrier" IS DISTINCT FROM lineage."carrier"
        OR child_coupon."carrier" IS DISTINCT FROM lineage."carrier"
        OR parent_coupon."status" <> 'exchanged')
  ) THEN
    RAISE EXCEPTION 'Every lineage parent must be exchanged, and coupons must retain the same passenger and carrier.';
  END IF;

  IF EXISTS (
    WITH RECURSIVE reach(root_coupon, current_coupon) AS (
      SELECT lineage."parentCoupon", lineage."childCoupon"
      FROM "TicketCouponLineage" lineage WHERE lineage."changeSetKey" = NEW."changeSetKey"
      UNION
      SELECT reach.root_coupon, lineage."childCoupon"
      FROM reach JOIN "TicketCouponLineage" lineage ON lineage."parentCoupon" = reach.current_coupon
    )
    SELECT 1 FROM reach WHERE root_coupon = current_coupon
  ) THEN RAISE EXCEPTION 'Coupon lineage must remain an acyclic parent-to-child graph.'; END IF;

  IF transformation = 'alternative' THEN
    IF edge_count <> 1 OR parent_count <> 1 OR child_count <> 1 THEN
      RAISE EXCEPTION 'An alternative must have exactly one parent and one child.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "TicketCouponLineage" lineage
      JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parentCoupon"
      JOIN "TicketCoupon" child_coupon ON child_coupon."id" = lineage."childCoupon"
      JOIN "ServiceObligation" obligation ON obligation."id" = child_coupon."serviceObligation"
      WHERE lineage."changeSetKey" = NEW."changeSetKey"
        AND (parent_coupon."serviceObligation" IS DISTINCT FROM child_coupon."serviceObligation"
          OR child_coupon."serviceObligationVersion" <> parent_coupon."serviceObligationVersion" + 1
          OR obligation."currentVersion" < child_coupon."serviceObligationVersion")
    ) THEN RAISE EXCEPTION 'An alternative must advance one service obligation by one immutable version.'; END IF;
  ELSIF transformation = 'split' THEN
    IF parent_count <> 1 OR child_count < 2 OR edge_count <> child_count THEN
      RAISE EXCEPTION 'A connection split requires one parent and at least two distinct children.';
    END IF;
    SELECT COUNT(DISTINCT child_coupon."serviceObligation") INTO child_obligation_count
    FROM "TicketCouponLineage" lineage JOIN "TicketCoupon" child_coupon ON child_coupon."id" = lineage."childCoupon"
    WHERE lineage."changeSetKey" = NEW."changeSetKey";
    IF child_obligation_count <> child_count OR EXISTS (
      SELECT 1 FROM "TicketCouponLineage" lineage
      JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parentCoupon"
      JOIN "TicketCoupon" child_coupon ON child_coupon."id" = lineage."childCoupon"
      JOIN "ServiceObligation" parent_obligation ON parent_obligation."id" = parent_coupon."serviceObligation"
      JOIN "ServiceObligation" child_obligation ON child_obligation."id" = child_coupon."serviceObligation"
      WHERE lineage."changeSetKey" = NEW."changeSetKey"
        AND (parent_coupon."serviceObligation" = child_coupon."serviceObligation"
          OR parent_obligation."status" <> 'retired'
          OR child_coupon."serviceObligationVersion" <> 1
          OR child_obligation."currentVersion" < child_coupon."serviceObligationVersion")
    ) THEN RAISE EXCEPTION 'Split children require distinct new service obligations after the parent retires.'; END IF;
  ELSIF transformation = 'consolidation' THEN
    IF parent_count < 2 OR child_count <> 1 OR edge_count <> parent_count THEN
      RAISE EXCEPTION 'A consolidation requires at least two distinct parents and exactly one child.';
    END IF;
    SELECT COUNT(DISTINCT parent_coupon."serviceObligation") INTO parent_obligation_count
    FROM "TicketCouponLineage" lineage JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parentCoupon"
    WHERE lineage."changeSetKey" = NEW."changeSetKey";
    IF parent_obligation_count <> parent_count OR EXISTS (
      SELECT 1 FROM "TicketCouponLineage" lineage
      JOIN "TicketCoupon" parent_coupon ON parent_coupon."id" = lineage."parentCoupon"
      JOIN "TicketCoupon" child_coupon ON child_coupon."id" = lineage."childCoupon"
      JOIN "ServiceObligation" parent_obligation ON parent_obligation."id" = parent_coupon."serviceObligation"
      JOIN "ServiceObligation" child_obligation ON child_obligation."id" = child_coupon."serviceObligation"
      WHERE lineage."changeSetKey" = NEW."changeSetKey"
        AND (parent_coupon."serviceObligation" = child_coupon."serviceObligation"
          OR parent_obligation."status" <> 'retired'
          OR child_coupon."serviceObligationVersion" <> 1
          OR child_obligation."currentVersion" < child_coupon."serviceObligationVersion")
    ) THEN RAISE EXCEPTION 'Consolidation requires every distinct parent obligation retired before one distinct child obligation.'; END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported coupon transformation.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "TicketCouponLineage_validate_change_set"
AFTER INSERT ON "TicketCouponLineage"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION airline_validate_coupon_lineage_change();

COMMIT;
