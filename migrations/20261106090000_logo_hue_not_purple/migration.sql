-- Carrier: the default mark colour is never purple, indigo or violet (owner rule, 2026-11-06).
ALTER TABLE "Carrier" ALTER COLUMN "logoColor" SET DEFAULT '330';
-- Records still on the old default colour (which rendered purple/indigo) take the new one; marks a merchant changed are left alone.
UPDATE "Carrier" SET "logoColor" = '330' WHERE "logoIcon" = '<svg fill="none" height="100%" viewBox="0 0 31 48" width="100%" xmlns="http://www.w3.org/2000/svg"><g fill="#444ce7"><path d="m-.00195312 17.8433 30.90545312-17.8433-.8189 12.6994-26.32058 15.1961z"/><path d="m3.76367 27.8951 21.73573-12.5492-.8189 12.6994-17.15086 9.902z" opacity=".5"/><path d="m7.52734 37.9477 12.56596-7.255-.8189 12.6994-7.9811 4.6079z" opacity=".25"/></g></svg>' AND "logoColor" = '30';
-- The storefront accent palette no longer offers Indigo or Violet; carriers on them move to Blue.
UPDATE "Carrier" SET "storefrontBrandColor" = 'blue' WHERE "storefrontBrandColor" IN ('indigo', 'violet');
