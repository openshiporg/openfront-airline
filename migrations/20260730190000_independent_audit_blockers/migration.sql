-- Durable external settlement provenance and resumable onboarding progress.
CREATE TYPE "OnboardingStepStatusType" AS ENUM ('pending', 'completed', 'needs_attention');

ALTER TABLE "ManualPaymentEvidence" ADD COLUMN "ledgerEntry" TEXT;

CREATE TABLE "SettlementLedgerEntry" (
  "id" TEXT NOT NULL,
  "carrier" TEXT,
  "connection" TEXT,
  "ledgerKey" TEXT NOT NULL DEFAULT '',
  "externalReference" TEXT NOT NULL DEFAULT '',
  "ledgerSource" TEXT NOT NULL DEFAULT '',
  "evidenceDigest" TEXT NOT NULL DEFAULT '',
  "amount" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "importedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "importedByCredentialId" TEXT NOT NULL DEFAULT '',
  "sourceMetadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnboardingStep" (
  "id" TEXT NOT NULL,
  "carrier" TEXT,
  "user" TEXT,
  "progressKey" TEXT NOT NULL DEFAULT '',
  "step" TEXT NOT NULL DEFAULT '',
  "status" "OnboardingStepStatusType" DEFAULT 'pending',
  "attemptCount" INTEGER DEFAULT 0,
  "inputDigest" TEXT NOT NULL DEFAULT '',
  "requirements" JSONB DEFAULT '[]',
  "completedAt" TIMESTAMP(3),
  "lastAttemptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementLedgerEntry_ledgerKey_key" ON "SettlementLedgerEntry"("ledgerKey");
CREATE INDEX "SettlementLedgerEntry_carrier_idx" ON "SettlementLedgerEntry"("carrier");
CREATE INDEX "SettlementLedgerEntry_connection_idx" ON "SettlementLedgerEntry"("connection");
CREATE INDEX "SettlementLedgerEntry_evidenceDigest_idx" ON "SettlementLedgerEntry"("evidenceDigest");
CREATE INDEX "ManualPaymentEvidence_ledgerEntry_idx" ON "ManualPaymentEvidence"("ledgerEntry");
CREATE UNIQUE INDEX "OnboardingStep_progressKey_key" ON "OnboardingStep"("progressKey");
CREATE INDEX "OnboardingStep_carrier_idx" ON "OnboardingStep"("carrier");
CREATE INDEX "OnboardingStep_user_idx" ON "OnboardingStep"("user");

ALTER TABLE "SettlementLedgerEntry" ADD CONSTRAINT "SettlementLedgerEntry_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementLedgerEntry" ADD CONSTRAINT "SettlementLedgerEntry_connection_fkey" FOREIGN KEY ("connection") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualPaymentEvidence" ADD CONSTRAINT "ManualPaymentEvidence_ledgerEntry_fkey" FOREIGN KEY ("ledgerEntry") REFERENCES "SettlementLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
