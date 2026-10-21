-- Persist operator-owned public identity/theme without backfilling hardcoded storefront defaults.
ALTER TABLE "Carrier"
  ADD COLUMN "storefrontBrandColor" TEXT,
  ADD COLUMN "storefrontHomepageTitle" TEXT,
  ADD COLUMN "storefrontHomepageDescription" TEXT;
