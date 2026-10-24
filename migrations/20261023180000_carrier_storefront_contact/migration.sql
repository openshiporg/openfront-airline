-- Customer service contact shown on the storefront Contact page.
ALTER TABLE "Carrier" ADD COLUMN "storefrontContactEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN "storefrontContactPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN "storefrontServiceHours" TEXT NOT NULL DEFAULT '';

-- Full-permission "Initial Carrier Administrator" roles left by failed first-run attempts: no carrier, no users.
DELETE FROM "Role" AS r
WHERE r."name" = 'Initial Carrier Administrator'
  AND r."carrier" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "User" AS u WHERE u."role" = r."id");
