-- Staff refunds above this amount (minor units) wait for a second approver. $1,000.00 by default.
ALTER TABLE "Carrier" ADD COLUMN IF NOT EXISTS "refundApprovalThreshold" INTEGER NOT NULL DEFAULT 100000;
