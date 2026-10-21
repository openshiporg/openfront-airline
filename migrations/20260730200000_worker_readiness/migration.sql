CREATE TYPE "WorkerHeartbeatStatusType" AS ENUM ('running', 'draining', 'stopped');

CREATE TABLE "WorkerHeartbeat" (
  "id" TEXT NOT NULL,
  "workerKey" TEXT NOT NULL DEFAULT '',
  "component" TEXT NOT NULL DEFAULT '',
  "status" "WorkerHeartbeatStatusType" DEFAULT 'running',
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerHeartbeat_workerKey_key" ON "WorkerHeartbeat"("workerKey");
CREATE INDEX "WorkerHeartbeat_lastSeenAt_idx" ON "WorkerHeartbeat"("lastSeenAt");
