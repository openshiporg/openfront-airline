-- Owner directive 2026-11-09: no invented outbox or worker machinery. External events use Openfront webhooks.
DROP TABLE IF EXISTS "OutboxEvent";
DROP TYPE IF EXISTS "OutboxEventStatusType";
DROP TABLE IF EXISTS "WorkerHeartbeat";
DROP TYPE IF EXISTS "WorkerHeartbeatStatusType";
