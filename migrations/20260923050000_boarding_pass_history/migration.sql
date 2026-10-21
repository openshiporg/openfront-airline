-- A check-in can be offloaded and reissued more than once. Preserve every
-- issued/revoked pass against the original check-in instead of overwriting or
-- detaching historical pass ownership.
DROP INDEX IF EXISTS "BoardingPass_checkIn_key";
