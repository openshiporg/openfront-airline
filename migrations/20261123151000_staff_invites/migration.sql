-- Staff invitations: an administrator invites an email with a role; the invitee sets a password from the emailed link.
CREATE TABLE IF NOT EXISTS "StaffInvite" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL DEFAULT '',
    "roleId" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL DEFAULT '',
    "invitedById" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffInvite_email_idx" ON "StaffInvite"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
