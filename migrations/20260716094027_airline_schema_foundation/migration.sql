/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canEditOtherPeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManagePeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canSeeOtherPeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "CarrierStatusType" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "ApprovedAgentAccreditationTypeType" AS ENUM ('iata', 'tids', 'arc', 'carrier_appointed', 'other');

-- CreateEnum
CREATE TYPE "ApprovedAgentStatusType" AS ENUM ('pending', 'approved', 'suspended', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "RouteStatusType" AS ENUM ('draft', 'active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "FlightScheduleStatusType" AS ENUM ('draft', 'published', 'suspended', 'retired');

-- CreateEnum
CREATE TYPE "FlightInstanceStatusType" AS ENUM ('scheduled', 'open_for_sale', 'closed_for_sale', 'delayed', 'departed', 'arrived', 'cancelled');

-- CreateEnum
CREATE TYPE "CabinCabinClassType" AS ENUM ('economy', 'premium_economy', 'business', 'first');

-- CreateEnum
CREATE TYPE "InventoryBucketStatusType" AS ENUM ('open', 'closed', 'frozen');

-- CreateEnum
CREATE TYPE "InventoryHoldStatusType" AS ENUM ('active', 'converted', 'released', 'expired');

-- CreateEnum
CREATE TYPE "FareBrandStatusType" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "FareRuleStatusType" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "AncillaryProductTypeType" AS ENUM ('seat', 'checked_bag', 'cabin_bag', 'priority', 'lounge', 'meal', 'wifi', 'assistance', 'other');

-- CreateEnum
CREATE TYPE "AncillaryProductStatusType" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "AncillaryProductFulfillmentTypeType" AS ENUM ('associated', 'standalone');

-- CreateEnum
CREATE TYPE "OfferStatusType" AS ENUM ('draft', 'available', 'held', 'accepted', 'expired', 'withdrawn');

-- CreateEnum
CREATE TYPE "OfferSourceType" AS ENUM ('direct', 'website', 'call_center', 'agent', 'ndc', 'gds');

-- CreateEnum
CREATE TYPE "OfferItemItemTypeType" AS ENUM ('flight', 'ancillary', 'fee', 'tax', 'discount');

-- CreateEnum
CREATE TYPE "PassengerGenderMarkerType" AS ENUM ('female', 'male', 'unspecified', 'undisclosed');

-- CreateEnum
CREATE TYPE "PassengerStatusType" AS ENUM ('active', 'merged', 'restricted', 'archived');

-- CreateEnum
CREATE TYPE "TravelDocumentDocumentTypeType" AS ENUM ('passport', 'national_id', 'residence_permit', 'visa', 'known_traveler', 'redress', 'other');

-- CreateEnum
CREATE TYPE "TravelDocumentStatusType" AS ENUM ('unverified', 'verified', 'rejected', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "BookingStatusType" AS ENUM ('pending', 'confirmed', 'ticketed', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "BookingPaymentStatusType" AS ENUM ('unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "BookingTicketingStatusType" AS ENUM ('not_ticketed', 'partially_ticketed', 'ticketed', 'voided', 'exchanged');

-- CreateEnum
CREATE TYPE "BookingSourceType" AS ENUM ('direct', 'website', 'call_center', 'agent', 'ndc', 'gds', 'airport');

-- CreateEnum
CREATE TYPE "BookingPassengerPassengerTypeType" AS ENUM ('adult', 'child', 'infant_with_seat', 'infant_without_seat');

-- CreateEnum
CREATE TYPE "BookingPassengerStatusType" AS ENUM ('active', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "JourneyStatusType" AS ENUM ('planned', 'in_progress', 'completed', 'disrupted', 'cancelled');

-- CreateEnum
CREATE TYPE "BookingSegmentStatusType" AS ENUM ('confirmed', 'checked_in', 'boarded', 'flown', 'offloaded', 'disrupted', 'reaccommodated', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "BookingLineItemItemTypeType" AS ENUM ('flight', 'ancillary', 'fee', 'tax', 'discount', 'exchange');

-- CreateEnum
CREATE TYPE "ServiceRequestCategoryType" AS ENUM ('ssr', 'osi', 'accessibility', 'meal', 'assistance', 'other');

-- CreateEnum
CREATE TYPE "ServiceRequestStatusType" AS ENUM ('requested', 'pending', 'confirmed', 'fulfilled', 'unable', 'cancelled');

-- CreateEnum
CREATE TYPE "TicketStatusType" AS ENUM ('pending', 'issued', 'partially_used', 'used', 'suspended', 'voided', 'refunded', 'exchanged');

-- CreateEnum
CREATE TYPE "TicketCouponStatusType" AS ENUM ('open', 'checked_in', 'boarded', 'flown', 'suspended', 'voided', 'refunded', 'exchanged');

-- CreateEnum
CREATE TYPE "ElectronicMiscDocumentDocumentTypeType" AS ENUM ('associated', 'standalone');

-- CreateEnum
CREATE TYPE "ElectronicMiscDocumentStatusType" AS ENUM ('pending', 'issued', 'partially_used', 'used', 'voided', 'refunded', 'exchanged');

-- CreateEnum
CREATE TYPE "ElectronicMiscCouponStatusType" AS ENUM ('open', 'used', 'voided', 'refunded', 'exchanged');

-- CreateEnum
CREATE TYPE "SeatMapStatusType" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "SeatStatusType" AS ENUM ('available', 'blocked', 'unavailable');

-- CreateEnum
CREATE TYPE "SeatSeatTypeType" AS ENUM ('standard', 'preferred', 'extra_legroom', 'bassinet', 'restricted');

-- CreateEnum
CREATE TYPE "SeatAssignmentStatusType" AS ENUM ('held', 'assigned', 'confirmed', 'boarded', 'released', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentProviderAdapterTypeType" AS ENUM ('stripe', 'paypal', 'manual', 'custom');

-- CreateEnum
CREATE TYPE "PaymentProviderStatusType" AS ENUM ('inactive', 'active', 'degraded', 'disabled');

-- CreateEnum
CREATE TYPE "PaymentSessionStatusType" AS ENUM ('created', 'pending', 'authorized', 'captured', 'failed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "PaymentStatusType" AS ENUM ('pending', 'authorized', 'captured', 'partially_refunded', 'refunded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundStatusType" AS ENUM ('requested', 'approved', 'processing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundReasonType" AS ENUM ('customer_request', 'disruption', 'schedule_change', 'duplicate', 'fraud', 'other');

-- CreateEnum
CREATE TYPE "ExchangeStatusType" AS ENUM ('quoted', 'accepted', 'processing', 'completed', 'failed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "CheckInStatusType" AS ENUM ('not_started', 'eligible', 'checked_in', 'boarded', 'blocked', 'offloaded', 'cancelled');

-- CreateEnum
CREATE TYPE "CheckInChannelType" AS ENUM ('web', 'mobile', 'kiosk', 'counter', 'agent', 'system');

-- CreateEnum
CREATE TYPE "BoardingPassStatusType" AS ENUM ('issued', 'reissued', 'boarded', 'revoked');

-- CreateEnum
CREATE TYPE "BagStatusType" AS ENUM ('accepted', 'loaded', 'in_transit', 'arrived', 'delivered', 'delayed', 'mishandled', 'closed');

-- CreateEnum
CREATE TYPE "BagBagTypeType" AS ENUM ('checked', 'gate_checked', 'special_item', 'mobility_aid');

-- CreateEnum
CREATE TYPE "BagEventEventTypeType" AS ENUM ('accepted', 'screened', 'loaded', 'unloaded', 'transferred', 'arrived', 'delivered', 'exception');

-- CreateEnum
CREATE TYPE "BagEventSourceType" AS ENUM ('system', 'scanner', 'provider', 'agent');

-- CreateEnum
CREATE TYPE "DisruptionTypeType" AS ENUM ('delay', 'cancellation', 'schedule_change', 'misconnection', 'diversion', 'equipment_change', 'other');

-- CreateEnum
CREATE TYPE "DisruptionSeverityType" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "DisruptionStatusType" AS ENUM ('detected', 'published', 'recovering', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "ReaccommodationStatusType" AS ENUM ('proposed', 'accepted', 'confirmed', 'declined', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "IntegrationProviderTypeType" AS ENUM ('ndc', 'gds', 'dcs', 'identity', 'baggage', 'notification', 'loyalty', 'other');

-- CreateEnum
CREATE TYPE "IntegrationProviderStatusType" AS ENUM ('active', 'inactive', 'deprecated');

-- CreateEnum
CREATE TYPE "ProviderConnectionStatusType" AS ENUM ('pending', 'active', 'paused', 'failed', 'revoked');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatusType" AS ENUM ('active', 'paused', 'failed', 'disabled');

-- CreateEnum
CREATE TYPE "WebhookEventDirectionType" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "WebhookEventStatusType" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'dead_lettered');

-- CreateEnum
CREATE TYPE "IdempotencyKeyStatusType" AS ENUM ('started', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AuditEventSourceType" AS ENUM ('platform', 'storefront', 'agent', 'provider', 'system');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
-- Add the airline permissions before removing starter permissions so existing
-- full administrators retain access through the upgrade.
ALTER TABLE "Role"
ADD COLUMN     "canManageAgents" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageAirportService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageBookings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCarriers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageDisruptions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageNetwork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOffers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePassengers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSecurePassengerData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageTicketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadAirportService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadAudit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadBookings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadDisruptions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadIntegrations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadNetwork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadOffers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPassengers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadRoles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadTicketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Role"
SET
  "canManageAgents" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageAirportService" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageBookings" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageCarriers" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageDisruptions" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageIntegrations" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageInventory" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageNetwork" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageOffers" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageOnboarding" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManagePassengers" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManagePayments" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageSecurePassengerData" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageTicketing" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canManageUsers" = ("canManagePeople" OR "canEditOtherPeople"),
  "canReadAirportService" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadAudit" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadBookings" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadDisruptions" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadIntegrations" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadInventory" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadNetwork" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadOffers" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadPassengers" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadPayments" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadRoles" = "canManageRoles",
  "canReadTicketing" = ("canManageAllTodos" AND "canManagePeople" AND "canManageRoles"),
  "canReadUsers" = ("canSeeOtherPeople" OR "canEditOtherPeople" OR "canManagePeople");

ALTER TABLE "Role"
DROP COLUMN "canCreateTodos",
DROP COLUMN "canEditOtherPeople",
DROP COLUMN "canManageAllTodos",
DROP COLUMN "canManagePeople",
DROP COLUMN "canSeeOtherPeople";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvedAgent" TEXT,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" DEFAULT 'not_started',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "icaoCode" TEXT,
    "callsign" TEXT NOT NULL DEFAULT '',
    "defaultCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "CarrierStatusType" NOT NULL DEFAULT 'active',
    "directSalesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "iataCode" TEXT NOT NULL DEFAULT '',
    "icaoCode" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "subdivisionCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovedAgent" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "legalName" TEXT NOT NULL DEFAULT '',
    "tradingName" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT NOT NULL DEFAULT '',
    "accreditationType" "ApprovedAgentAccreditationTypeType" DEFAULT 'other',
    "accreditationNumber" TEXT NOT NULL DEFAULT '',
    "status" "ApprovedAgentStatusType" NOT NULL DEFAULT 'pending',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "salesChannels" JSONB DEFAULT '[]',
    "servicingScopes" JSONB DEFAULT '[]',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovedAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "routeKey" TEXT NOT NULL DEFAULT '',
    "origin" TEXT,
    "destination" TEXT,
    "status" "RouteStatusType" NOT NULL DEFAULT 'active',
    "distanceKilometers" INTEGER,
    "minimumConnectionMinutes" INTEGER,
    "isInternational" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSchedule" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "scheduleKey" TEXT NOT NULL DEFAULT '',
    "route" TEXT,
    "operatingCarrier" TEXT,
    "flightNumber" TEXT NOT NULL DEFAULT '',
    "serviceSuffix" TEXT NOT NULL DEFAULT '',
    "departureLocalTime" TEXT NOT NULL DEFAULT '',
    "arrivalLocalTime" TEXT NOT NULL DEFAULT '',
    "arrivalDayOffset" INTEGER DEFAULT 0,
    "daysOfWeek" JSONB DEFAULT '[]',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "status" "FlightScheduleStatusType" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightInstance" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "instanceKey" TEXT NOT NULL DEFAULT '',
    "schedule" TEXT,
    "route" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "operatingCarrier" TEXT,
    "flightNumber" TEXT NOT NULL DEFAULT '',
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "scheduledDepartureAt" TIMESTAMP(3) NOT NULL,
    "scheduledArrivalAt" TIMESTAMP(3) NOT NULL,
    "estimatedDepartureAt" TIMESTAMP(3),
    "estimatedArrivalAt" TIMESTAMP(3),
    "actualDepartureAt" TIMESTAMP(3),
    "actualArrivalAt" TIMESTAMP(3),
    "departureTerminal" TEXT NOT NULL DEFAULT '',
    "departureGate" TEXT NOT NULL DEFAULT '',
    "arrivalTerminal" TEXT NOT NULL DEFAULT '',
    "arrivalGate" TEXT NOT NULL DEFAULT '',
    "status" "FlightInstanceStatusType" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cabin" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "cabinClass" "CabinCabinClassType" NOT NULL,
    "displayOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cabin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBucket" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "bucketKey" TEXT NOT NULL DEFAULT '',
    "flightInstance" TEXT,
    "cabin" TEXT,
    "fareBrand" TEXT,
    "bookingClassCode" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "authorized" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "status" "InventoryBucketStatusType" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryHold" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "holdKey" TEXT NOT NULL DEFAULT '',
    "inventoryBucket" TEXT,
    "offer" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryHoldStatusType" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FareBrand" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "cabin" TEXT,
    "status" "FareBrandStatusType" NOT NULL DEFAULT 'draft',
    "displayOrder" INTEGER DEFAULT 0,
    "includedBaggage" JSONB DEFAULT '{}',
    "benefits" JSONB DEFAULT '[]',
    "refundabilitySummary" TEXT NOT NULL DEFAULT '',
    "changeabilitySummary" TEXT NOT NULL DEFAULT '',
    "seatSelectionSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FareBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FareRule" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "ruleKey" TEXT NOT NULL DEFAULT '',
    "fareBrand" TEXT,
    "route" TEXT,
    "fareBasisPattern" TEXT NOT NULL DEFAULT '',
    "status" "FareRuleStatusType" DEFAULT 'draft',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "travelFrom" TIMESTAMP(3),
    "travelTo" TIMESTAMP(3),
    "salesChannels" JSONB DEFAULT '[]',
    "passengerTypes" JSONB DEFAULT '["adult"]',
    "minimumStayDays" INTEGER,
    "maximumStayDays" INTEGER,
    "minimumAdvancePurchaseHours" INTEGER,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "isChangeable" BOOLEAN NOT NULL DEFAULT false,
    "changeFeeAmount" INTEGER DEFAULT 0,
    "cancellationFeeAmount" INTEGER DEFAULT 0,
    "noShowFeeAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "restrictions" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FareRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AncillaryProduct" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "productKey" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "type" "AncillaryProductTypeType" NOT NULL,
    "status" "AncillaryProductStatusType" DEFAULT 'draft',
    "fulfillmentType" "AncillaryProductFulfillmentTypeType" DEFAULT 'associated',
    "defaultPriceAmount" INTEGER DEFAULT 0,
    "taxAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "requiresInventory" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AncillaryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "offerNumber" TEXT NOT NULL DEFAULT '',
    "shoppingSessionId" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" "OfferStatusType" NOT NULL DEFAULT 'draft',
    "source" "OfferSourceType" DEFAULT 'direct',
    "expiresAt" TIMESTAMP(3),
    "baseAmount" INTEGER DEFAULT 0,
    "taxAmount" INTEGER DEFAULT 0,
    "feeAmount" INTEGER DEFAULT 0,
    "discountAmount" INTEGER DEFAULT 0,
    "totalAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "customer" TEXT,
    "approvedAgent" TEXT,
    "passengerCriteria" JSONB DEFAULT '[]',
    "externalReferences" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferItem" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "itemKey" TEXT NOT NULL DEFAULT '',
    "offer" TEXT,
    "itemType" "OfferItemItemTypeType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL DEFAULT 0,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "flightInstance" TEXT,
    "inventoryBucket" TEXT,
    "fareBrand" TEXT,
    "fareRule" TEXT,
    "ancillaryProduct" TEXT,
    "passengerReferences" JSONB DEFAULT '[]',
    "segmentSnapshot" JSONB DEFAULT '{}',
    "productSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "passengerKey" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "givenName" TEXT NOT NULL DEFAULT '',
    "middleNames" TEXT NOT NULL DEFAULT '',
    "familyName" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3),
    "genderMarker" "PassengerGenderMarkerType",
    "nationalityCode" TEXT,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "status" "PassengerStatusType" DEFAULT 'active',
    "loyaltyPrograms" JSONB DEFAULT '[]',
    "preferences" JSONB DEFAULT '{}',
    "userAccount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelDocument" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "passenger" TEXT,
    "documentType" "TravelDocumentDocumentTypeType" NOT NULL,
    "documentNumberToken" TEXT,
    "documentNumberHash" TEXT,
    "encryptedPayload" TEXT,
    "documentNumberLast4" TEXT,
    "issuingCountryCode" TEXT NOT NULL DEFAULT '',
    "nationalityCode" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "TravelDocumentStatusType" DEFAULT 'unverified',
    "verificationProviderReference" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "bookingKey" TEXT NOT NULL DEFAULT '',
    "recordLocator" TEXT NOT NULL DEFAULT '',
    "orderNumber" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "status" "BookingStatusType" NOT NULL DEFAULT 'pending',
    "paymentStatus" "BookingPaymentStatusType" DEFAULT 'unpaid',
    "ticketingStatus" "BookingTicketingStatusType" DEFAULT 'not_ticketed',
    "source" "BookingSourceType" DEFAULT 'direct',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "baseAmount" INTEGER DEFAULT 0,
    "taxAmount" INTEGER DEFAULT 0,
    "feeAmount" INTEGER DEFAULT 0,
    "discountAmount" INTEGER DEFAULT 0,
    "totalAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "customer" TEXT,
    "approvedAgent" TEXT,
    "sourceOffer" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "ticketedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "externalReferences" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPassenger" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "bookingPassengerKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "passenger" TEXT,
    "passengerType" "BookingPassengerPassengerTypeType" DEFAULT 'adult',
    "status" "BookingPassengerStatusType" DEFAULT 'active',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "passengerSnapshot" JSONB,
    "loyaltySnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journey" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "journeyKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "sequence" INTEGER NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "status" "JourneyStatusType" DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSegment" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "segmentKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "journey" TEXT,
    "sourceOfferItem" TEXT,
    "flightInstance" TEXT,
    "sequence" INTEGER NOT NULL,
    "status" "BookingSegmentStatusType" DEFAULT 'confirmed',
    "origin" TEXT,
    "destination" TEXT,
    "originCode" TEXT NOT NULL DEFAULT '',
    "destinationCode" TEXT NOT NULL DEFAULT '',
    "marketingCarrierCode" TEXT NOT NULL DEFAULT '',
    "operatingCarrierCode" TEXT NOT NULL DEFAULT '',
    "marketingFlightNumber" TEXT NOT NULL DEFAULT '',
    "scheduledDepartureAt" TIMESTAMP(3) NOT NULL,
    "scheduledArrivalAt" TIMESTAMP(3) NOT NULL,
    "cabinCode" TEXT NOT NULL DEFAULT '',
    "bookingClassCode" TEXT NOT NULL DEFAULT '',
    "fareBrandCode" TEXT NOT NULL DEFAULT '',
    "fareBasisCode" TEXT NOT NULL DEFAULT '',
    "itinerarySnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingLineItem" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "lineItemKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "sourceOfferItem" TEXT,
    "bookingSegment" TEXT,
    "bookingPassenger" TEXT,
    "ancillaryProduct" TEXT,
    "itemType" "BookingLineItemItemTypeType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL DEFAULT 0,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "sourceReference" TEXT NOT NULL DEFAULT '',
    "productSnapshot" JSONB DEFAULT '{}',
    "pricingSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "requestKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "passenger" TEXT,
    "bookingPassenger" TEXT,
    "bookingSegment" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "category" "ServiceRequestCategoryType" DEFAULT 'ssr',
    "status" "ServiceRequestStatusType" DEFAULT 'requested',
    "travelerText" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "serviceData" JSONB DEFAULT '{}',
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "ticketNumber" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "bookingPassenger" TEXT,
    "passenger" TEXT,
    "issuingCarrierCode" TEXT NOT NULL DEFAULT '',
    "validatingCarrierCode" TEXT NOT NULL DEFAULT '',
    "status" "TicketStatusType" DEFAULT 'pending',
    "totalAmount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "providerReference" TEXT NOT NULL DEFAULT '',
    "originalTicket" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCoupon" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "couponKey" TEXT NOT NULL DEFAULT '',
    "ticket" TEXT,
    "bookingSegment" TEXT,
    "couponNumber" INTEGER NOT NULL,
    "status" "TicketCouponStatusType" DEFAULT 'open',
    "fareBasisCode" TEXT NOT NULL DEFAULT '',
    "bookingClassCode" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "usedAt" TIMESTAMP(3),
    "entitlementSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicMiscDocument" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "documentNumber" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "bookingPassenger" TEXT,
    "passenger" TEXT,
    "documentType" "ElectronicMiscDocumentDocumentTypeType" DEFAULT 'associated',
    "reasonForIssuanceCode" TEXT NOT NULL DEFAULT '',
    "serviceCode" TEXT NOT NULL DEFAULT '',
    "ancillaryProduct" TEXT,
    "status" "ElectronicMiscDocumentStatusType" DEFAULT 'pending',
    "totalAmount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "issuedAt" TIMESTAMP(3),
    "providerReference" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicMiscDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicMiscCoupon" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "couponKey" TEXT NOT NULL DEFAULT '',
    "document" TEXT,
    "couponNumber" INTEGER NOT NULL,
    "bookingSegment" TEXT,
    "ancillaryProduct" TEXT,
    "bookingLineItem" TEXT,
    "status" "ElectronicMiscCouponStatusType" DEFAULT 'open',
    "amount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "usedAt" TIMESTAMP(3),
    "entitlementSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicMiscCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatMap" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "mapKey" TEXT NOT NULL DEFAULT '',
    "flightInstance" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "SeatMapStatusType" DEFAULT 'draft',
    "layoutSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "seatKey" TEXT NOT NULL DEFAULT '',
    "seatMap" TEXT,
    "cabin" TEXT,
    "designator" TEXT NOT NULL DEFAULT '',
    "rowNumber" INTEGER NOT NULL,
    "columnCode" TEXT NOT NULL DEFAULT '',
    "status" "SeatStatusType" DEFAULT 'available',
    "seatType" "SeatSeatTypeType" DEFAULT 'standard',
    "characteristics" JSONB DEFAULT '[]',
    "surchargeAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAssignment" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "assignmentKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "bookingPassenger" TEXT,
    "passenger" TEXT,
    "bookingSegment" TEXT,
    "seat" TEXT,
    "status" "SeatAssignmentStatusType" DEFAULT 'held',
    "seatDesignatorSnapshot" TEXT NOT NULL DEFAULT '',
    "cabinCodeSnapshot" TEXT NOT NULL DEFAULT '',
    "characteristicsSnapshot" JSONB DEFAULT '[]',
    "amount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "assignedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "adapterType" "PaymentProviderAdapterTypeType" DEFAULT 'manual',
    "status" "PaymentProviderStatusType" DEFAULT 'inactive',
    "credentials" JSONB DEFAULT '{}',
    "configuration" JSONB DEFAULT '{}',
    "createPaymentFunction" TEXT NOT NULL DEFAULT '',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT '',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT '',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT '',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "sessionKey" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "provider" TEXT,
    "status" "PaymentSessionStatusType" DEFAULT 'created',
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "providerSessionId" TEXT NOT NULL DEFAULT '',
    "providerData" JSONB DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT NOT NULL DEFAULT '',
    "failureMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "paymentKey" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "provider" TEXT,
    "session" TEXT,
    "status" "PaymentStatusType" DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "authorizedAmount" INTEGER DEFAULT 0,
    "capturedAmount" INTEGER DEFAULT 0,
    "refundedAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "providerCaptureId" TEXT NOT NULL DEFAULT '',
    "instrumentBrand" TEXT NOT NULL DEFAULT '',
    "instrumentLast4" TEXT,
    "rawProviderData" JSONB,
    "failureCode" TEXT NOT NULL DEFAULT '',
    "failureMessage" TEXT NOT NULL DEFAULT '',
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "refundKey" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "payment" TEXT,
    "status" "RefundStatusType" DEFAULT 'requested',
    "reason" "RefundReasonType" DEFAULT 'customer_request',
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "providerRefundId" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "exchangeKey" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "status" "ExchangeStatusType" DEFAULT 'quoted',
    "priceDifferenceAmount" INTEGER DEFAULT 0,
    "changeFeeAmount" INTEGER DEFAULT 0,
    "additionalCollectionAmount" INTEGER DEFAULT 0,
    "refundAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "quoteExpiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "pricingSnapshot" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "checkInKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "bookingPassenger" TEXT,
    "passenger" TEXT,
    "bookingSegment" TEXT,
    "flightInstance" TEXT,
    "ticketCoupon" TEXT,
    "seatAssignment" TEXT,
    "status" "CheckInStatusType" DEFAULT 'not_started',
    "channel" "CheckInChannelType" DEFAULT 'web',
    "travelDocumentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "checkedBagCount" INTEGER DEFAULT 0,
    "eligibilityData" JSONB DEFAULT '{}',
    "blockedReason" TEXT NOT NULL DEFAULT '',
    "checkedInAt" TIMESTAMP(3),
    "boardedAt" TIMESTAMP(3),
    "offloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardingPass" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "passNumber" TEXT NOT NULL DEFAULT '',
    "checkIn" TEXT,
    "passenger" TEXT,
    "bookingSegment" TEXT,
    "seatAssignment" TEXT,
    "status" "BoardingPassStatusType" DEFAULT 'issued',
    "barcodeToken" TEXT NOT NULL DEFAULT '',
    "seatDesignatorSnapshot" TEXT NOT NULL DEFAULT '',
    "boardingGroup" TEXT NOT NULL DEFAULT '',
    "boardingZone" TEXT NOT NULL DEFAULT '',
    "sequenceNumber" TEXT NOT NULL DEFAULT '',
    "gateSnapshot" TEXT NOT NULL DEFAULT '',
    "terminalSnapshot" TEXT NOT NULL DEFAULT '',
    "issuedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "boardedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardingPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bag" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "bagKey" TEXT NOT NULL DEFAULT '',
    "tagNumber" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "bookingPassenger" TEXT,
    "passenger" TEXT,
    "flightInstance" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "status" "BagStatusType" DEFAULT 'accepted',
    "bagType" "BagBagTypeType" DEFAULT 'checked',
    "weightGrams" INTEGER,
    "routeSnapshot" JSONB DEFAULT '[]',
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BagEvent" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "bag" TEXT,
    "airport" TEXT,
    "eventType" "BagEventEventTypeType" NOT NULL,
    "statusSnapshot" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "BagEventSourceType" DEFAULT 'system',
    "providerConnection" TEXT,
    "providerReference" TEXT NOT NULL DEFAULT '',
    "payloadSummary" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BagEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disruption" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "disruptionKey" TEXT NOT NULL DEFAULT '',
    "flightInstance" TEXT,
    "type" "DisruptionTypeType" NOT NULL,
    "severity" "DisruptionSeverityType" DEFAULT 'medium',
    "status" "DisruptionStatusType" DEFAULT 'detected',
    "publicSummary" TEXT NOT NULL DEFAULT '',
    "internalDetails" TEXT NOT NULL DEFAULT '',
    "providerConnection" TEXT,
    "providerReference" TEXT NOT NULL DEFAULT '',
    "detectedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "impactSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Disruption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaccommodation" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "reaccommodationKey" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "booking" TEXT,
    "bookingPassenger" TEXT,
    "passenger" TEXT,
    "disruption" TEXT,
    "status" "ReaccommodationStatusType" DEFAULT 'proposed',
    "replacementOffer" TEXT,
    "optionExpiresAt" TIMESTAMP(3),
    "priceDifferenceAmount" INTEGER DEFAULT 0,
    "additionalCollectionAmount" INTEGER DEFAULT 0,
    "refundAmount" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "acceptedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "optionSnapshot" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaccommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationProvider" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "providerKey" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "type" "IntegrationProviderTypeType" NOT NULL,
    "status" "IntegrationProviderStatusType" DEFAULT 'active',
    "adapterModule" TEXT NOT NULL DEFAULT '',
    "capabilities" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "connectionKey" TEXT NOT NULL DEFAULT '',
    "provider" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "ProviderConnectionStatusType" DEFAULT 'pending',
    "credentials" JSONB DEFAULT '{}',
    "configuration" JSONB DEFAULT '{}',
    "capabilities" JSONB DEFAULT '[]',
    "externalAccountId" TEXT NOT NULL DEFAULT '',
    "lastAttemptedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastErrorCode" TEXT NOT NULL DEFAULT '',
    "lastErrorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "endpointKey" TEXT NOT NULL DEFAULT '',
    "connection" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "eventTypes" JSONB DEFAULT '[]',
    "status" "WebhookEndpointStatusType" DEFAULT 'active',
    "secret" TEXT NOT NULL DEFAULT '',
    "failureCount" INTEGER DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "lastDeliveredAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "connection" TEXT,
    "endpoint" TEXT,
    "direction" "WebhookEventDirectionType" NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "status" "WebhookEventStatusType" DEFAULT 'pending',
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "payloadSummary" JSONB DEFAULT '{}',
    "attemptCount" INTEGER DEFAULT 0,
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responseStatus" INTEGER,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "key" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "requestHash" TEXT NOT NULL DEFAULT '',
    "status" "IdempotencyKeyStatusType" DEFAULT 'started',
    "actor" TEXT,
    "approvedAgent" TEXT,
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "result" JSONB,
    "lockedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "carrier" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "approvedAgent" TEXT,
    "source" "AuditEventSourceType" DEFAULT 'platform',
    "correlationId" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "beforeSummary" JSONB DEFAULT '{}',
    "afterSummary" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Offer_passengers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Offer_passengers_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateTable
CREATE TABLE "_BookingSegment_disruptions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingSegment_disruptions_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateTable
CREATE TABLE "_BookingSegment_exchangesAsOriginal" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingSegment_exchangesAsOriginal_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateTable
CREATE TABLE "_BookingSegment_exchangesAsReplacement" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingSegment_exchangesAsReplacement_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateTable
CREATE TABLE "_BookingSegment_reaccommodationsAsOriginal" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingSegment_reaccommodationsAsOriginal_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateTable
CREATE TABLE "_BookingSegment_reaccommodationsAsReplacement" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BookingSegment_reaccommodationsAsReplacement_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateTable
CREATE TABLE "_Bag_segments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Bag_segments_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_code_key" ON "Carrier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_icaoCode_key" ON "Carrier"("icaoCode");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_iataCode_key" ON "Airport"("iataCode");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_icaoCode_key" ON "Airport"("icaoCode");

-- CreateIndex
CREATE INDEX "ApprovedAgent_carrier_idx" ON "ApprovedAgent"("carrier");

-- CreateIndex
CREATE INDEX "ApprovedAgent_externalReference_idx" ON "ApprovedAgent"("externalReference");

-- CreateIndex
CREATE INDEX "ApprovedAgent_accreditationNumber_idx" ON "ApprovedAgent"("accreditationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Route_routeKey_key" ON "Route"("routeKey");

-- CreateIndex
CREATE INDEX "Route_carrier_idx" ON "Route"("carrier");

-- CreateIndex
CREATE INDEX "Route_origin_idx" ON "Route"("origin");

-- CreateIndex
CREATE INDEX "Route_destination_idx" ON "Route"("destination");

-- CreateIndex
CREATE UNIQUE INDEX "FlightSchedule_scheduleKey_key" ON "FlightSchedule"("scheduleKey");

-- CreateIndex
CREATE INDEX "FlightSchedule_carrier_idx" ON "FlightSchedule"("carrier");

-- CreateIndex
CREATE INDEX "FlightSchedule_route_idx" ON "FlightSchedule"("route");

-- CreateIndex
CREATE INDEX "FlightSchedule_operatingCarrier_idx" ON "FlightSchedule"("operatingCarrier");

-- CreateIndex
CREATE UNIQUE INDEX "FlightInstance_instanceKey_key" ON "FlightInstance"("instanceKey");

-- CreateIndex
CREATE INDEX "FlightInstance_carrier_idx" ON "FlightInstance"("carrier");

-- CreateIndex
CREATE INDEX "FlightInstance_schedule_idx" ON "FlightInstance"("schedule");

-- CreateIndex
CREATE INDEX "FlightInstance_route_idx" ON "FlightInstance"("route");

-- CreateIndex
CREATE INDEX "FlightInstance_origin_idx" ON "FlightInstance"("origin");

-- CreateIndex
CREATE INDEX "FlightInstance_destination_idx" ON "FlightInstance"("destination");

-- CreateIndex
CREATE INDEX "FlightInstance_operatingCarrier_idx" ON "FlightInstance"("operatingCarrier");

-- CreateIndex
CREATE INDEX "FlightInstance_serviceDate_idx" ON "FlightInstance"("serviceDate");

-- CreateIndex
CREATE INDEX "FlightInstance_scheduledDepartureAt_idx" ON "FlightInstance"("scheduledDepartureAt");

-- CreateIndex
CREATE INDEX "FlightInstance_scheduledArrivalAt_idx" ON "FlightInstance"("scheduledArrivalAt");

-- CreateIndex
CREATE INDEX "Cabin_carrier_idx" ON "Cabin"("carrier");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBucket_bucketKey_key" ON "InventoryBucket"("bucketKey");

-- CreateIndex
CREATE INDEX "InventoryBucket_carrier_idx" ON "InventoryBucket"("carrier");

-- CreateIndex
CREATE INDEX "InventoryBucket_flightInstance_idx" ON "InventoryBucket"("flightInstance");

-- CreateIndex
CREATE INDEX "InventoryBucket_cabin_idx" ON "InventoryBucket"("cabin");

-- CreateIndex
CREATE INDEX "InventoryBucket_fareBrand_idx" ON "InventoryBucket"("fareBrand");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryHold_holdKey_key" ON "InventoryHold"("holdKey");

-- CreateIndex
CREATE INDEX "InventoryHold_carrier_idx" ON "InventoryHold"("carrier");

-- CreateIndex
CREATE INDEX "InventoryHold_inventoryBucket_idx" ON "InventoryHold"("inventoryBucket");

-- CreateIndex
CREATE INDEX "InventoryHold_offer_idx" ON "InventoryHold"("offer");

-- CreateIndex
CREATE INDEX "InventoryHold_expiresAt_idx" ON "InventoryHold"("expiresAt");

-- CreateIndex
CREATE INDEX "FareBrand_carrier_idx" ON "FareBrand"("carrier");

-- CreateIndex
CREATE INDEX "FareBrand_cabin_idx" ON "FareBrand"("cabin");

-- CreateIndex
CREATE UNIQUE INDEX "FareRule_ruleKey_key" ON "FareRule"("ruleKey");

-- CreateIndex
CREATE INDEX "FareRule_carrier_idx" ON "FareRule"("carrier");

-- CreateIndex
CREATE INDEX "FareRule_fareBrand_idx" ON "FareRule"("fareBrand");

-- CreateIndex
CREATE INDEX "FareRule_route_idx" ON "FareRule"("route");

-- CreateIndex
CREATE UNIQUE INDEX "AncillaryProduct_productKey_key" ON "AncillaryProduct"("productKey");

-- CreateIndex
CREATE INDEX "AncillaryProduct_carrier_idx" ON "AncillaryProduct"("carrier");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_offerNumber_key" ON "Offer"("offerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_idempotencyKey_key" ON "Offer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Offer_carrier_idx" ON "Offer"("carrier");

-- CreateIndex
CREATE INDEX "Offer_shoppingSessionId_idx" ON "Offer"("shoppingSessionId");

-- CreateIndex
CREATE INDEX "Offer_expiresAt_idx" ON "Offer"("expiresAt");

-- CreateIndex
CREATE INDEX "Offer_customer_idx" ON "Offer"("customer");

-- CreateIndex
CREATE INDEX "Offer_approvedAgent_idx" ON "Offer"("approvedAgent");

-- CreateIndex
CREATE UNIQUE INDEX "OfferItem_itemKey_key" ON "OfferItem"("itemKey");

-- CreateIndex
CREATE INDEX "OfferItem_carrier_idx" ON "OfferItem"("carrier");

-- CreateIndex
CREATE INDEX "OfferItem_offer_idx" ON "OfferItem"("offer");

-- CreateIndex
CREATE INDEX "OfferItem_flightInstance_idx" ON "OfferItem"("flightInstance");

-- CreateIndex
CREATE INDEX "OfferItem_inventoryBucket_idx" ON "OfferItem"("inventoryBucket");

-- CreateIndex
CREATE INDEX "OfferItem_fareBrand_idx" ON "OfferItem"("fareBrand");

-- CreateIndex
CREATE INDEX "OfferItem_fareRule_idx" ON "OfferItem"("fareRule");

-- CreateIndex
CREATE INDEX "OfferItem_ancillaryProduct_idx" ON "OfferItem"("ancillaryProduct");

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_passengerKey_key" ON "Passenger"("passengerKey");

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_userAccount_key" ON "Passenger"("userAccount");

-- CreateIndex
CREATE INDEX "Passenger_carrier_idx" ON "Passenger"("carrier");

-- CreateIndex
CREATE INDEX "TravelDocument_carrier_idx" ON "TravelDocument"("carrier");

-- CreateIndex
CREATE INDEX "TravelDocument_passenger_idx" ON "TravelDocument"("passenger");

-- CreateIndex
CREATE INDEX "TravelDocument_documentNumberHash_idx" ON "TravelDocument"("documentNumberHash");

-- CreateIndex
CREATE INDEX "TravelDocument_verifiedBy_idx" ON "TravelDocument"("verifiedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingKey_key" ON "Booking"("bookingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_orderNumber_key" ON "Booking"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_sourceOffer_key" ON "Booking"("sourceOffer");

-- CreateIndex
CREATE INDEX "Booking_carrier_idx" ON "Booking"("carrier");

-- CreateIndex
CREATE INDEX "Booking_recordLocator_idx" ON "Booking"("recordLocator");

-- CreateIndex
CREATE INDEX "Booking_customer_idx" ON "Booking"("customer");

-- CreateIndex
CREATE INDEX "Booking_approvedAgent_idx" ON "Booking"("approvedAgent");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPassenger_bookingPassengerKey_key" ON "BookingPassenger"("bookingPassengerKey");

-- CreateIndex
CREATE INDEX "BookingPassenger_carrier_idx" ON "BookingPassenger"("carrier");

-- CreateIndex
CREATE INDEX "BookingPassenger_booking_idx" ON "BookingPassenger"("booking");

-- CreateIndex
CREATE INDEX "BookingPassenger_passenger_idx" ON "BookingPassenger"("passenger");

-- CreateIndex
CREATE UNIQUE INDEX "Journey_journeyKey_key" ON "Journey"("journeyKey");

-- CreateIndex
CREATE INDEX "Journey_carrier_idx" ON "Journey"("carrier");

-- CreateIndex
CREATE INDEX "Journey_booking_idx" ON "Journey"("booking");

-- CreateIndex
CREATE INDEX "Journey_origin_idx" ON "Journey"("origin");

-- CreateIndex
CREATE INDEX "Journey_destination_idx" ON "Journey"("destination");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSegment_segmentKey_key" ON "BookingSegment"("segmentKey");

-- CreateIndex
CREATE INDEX "BookingSegment_carrier_idx" ON "BookingSegment"("carrier");

-- CreateIndex
CREATE INDEX "BookingSegment_booking_idx" ON "BookingSegment"("booking");

-- CreateIndex
CREATE INDEX "BookingSegment_journey_idx" ON "BookingSegment"("journey");

-- CreateIndex
CREATE INDEX "BookingSegment_sourceOfferItem_idx" ON "BookingSegment"("sourceOfferItem");

-- CreateIndex
CREATE INDEX "BookingSegment_flightInstance_idx" ON "BookingSegment"("flightInstance");

-- CreateIndex
CREATE INDEX "BookingSegment_origin_idx" ON "BookingSegment"("origin");

-- CreateIndex
CREATE INDEX "BookingSegment_destination_idx" ON "BookingSegment"("destination");

-- CreateIndex
CREATE UNIQUE INDEX "BookingLineItem_lineItemKey_key" ON "BookingLineItem"("lineItemKey");

-- CreateIndex
CREATE INDEX "BookingLineItem_carrier_idx" ON "BookingLineItem"("carrier");

-- CreateIndex
CREATE INDEX "BookingLineItem_booking_idx" ON "BookingLineItem"("booking");

-- CreateIndex
CREATE INDEX "BookingLineItem_sourceOfferItem_idx" ON "BookingLineItem"("sourceOfferItem");

-- CreateIndex
CREATE INDEX "BookingLineItem_bookingSegment_idx" ON "BookingLineItem"("bookingSegment");

-- CreateIndex
CREATE INDEX "BookingLineItem_bookingPassenger_idx" ON "BookingLineItem"("bookingPassenger");

-- CreateIndex
CREATE INDEX "BookingLineItem_ancillaryProduct_idx" ON "BookingLineItem"("ancillaryProduct");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_requestKey_key" ON "ServiceRequest"("requestKey");

-- CreateIndex
CREATE INDEX "ServiceRequest_carrier_idx" ON "ServiceRequest"("carrier");

-- CreateIndex
CREATE INDEX "ServiceRequest_booking_idx" ON "ServiceRequest"("booking");

-- CreateIndex
CREATE INDEX "ServiceRequest_passenger_idx" ON "ServiceRequest"("passenger");

-- CreateIndex
CREATE INDEX "ServiceRequest_bookingPassenger_idx" ON "ServiceRequest"("bookingPassenger");

-- CreateIndex
CREATE INDEX "ServiceRequest_bookingSegment_idx" ON "ServiceRequest"("bookingSegment");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_carrier_idx" ON "Ticket"("carrier");

-- CreateIndex
CREATE INDEX "Ticket_booking_idx" ON "Ticket"("booking");

-- CreateIndex
CREATE INDEX "Ticket_bookingPassenger_idx" ON "Ticket"("bookingPassenger");

-- CreateIndex
CREATE INDEX "Ticket_passenger_idx" ON "Ticket"("passenger");

-- CreateIndex
CREATE INDEX "Ticket_originalTicket_idx" ON "Ticket"("originalTicket");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCoupon_couponKey_key" ON "TicketCoupon"("couponKey");

-- CreateIndex
CREATE INDEX "TicketCoupon_carrier_idx" ON "TicketCoupon"("carrier");

-- CreateIndex
CREATE INDEX "TicketCoupon_ticket_idx" ON "TicketCoupon"("ticket");

-- CreateIndex
CREATE INDEX "TicketCoupon_bookingSegment_idx" ON "TicketCoupon"("bookingSegment");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicMiscDocument_documentNumber_key" ON "ElectronicMiscDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "ElectronicMiscDocument_carrier_idx" ON "ElectronicMiscDocument"("carrier");

-- CreateIndex
CREATE INDEX "ElectronicMiscDocument_booking_idx" ON "ElectronicMiscDocument"("booking");

-- CreateIndex
CREATE INDEX "ElectronicMiscDocument_bookingPassenger_idx" ON "ElectronicMiscDocument"("bookingPassenger");

-- CreateIndex
CREATE INDEX "ElectronicMiscDocument_passenger_idx" ON "ElectronicMiscDocument"("passenger");

-- CreateIndex
CREATE INDEX "ElectronicMiscDocument_ancillaryProduct_idx" ON "ElectronicMiscDocument"("ancillaryProduct");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicMiscCoupon_couponKey_key" ON "ElectronicMiscCoupon"("couponKey");

-- CreateIndex
CREATE INDEX "ElectronicMiscCoupon_carrier_idx" ON "ElectronicMiscCoupon"("carrier");

-- CreateIndex
CREATE INDEX "ElectronicMiscCoupon_document_idx" ON "ElectronicMiscCoupon"("document");

-- CreateIndex
CREATE INDEX "ElectronicMiscCoupon_bookingSegment_idx" ON "ElectronicMiscCoupon"("bookingSegment");

-- CreateIndex
CREATE INDEX "ElectronicMiscCoupon_ancillaryProduct_idx" ON "ElectronicMiscCoupon"("ancillaryProduct");

-- CreateIndex
CREATE INDEX "ElectronicMiscCoupon_bookingLineItem_idx" ON "ElectronicMiscCoupon"("bookingLineItem");

-- CreateIndex
CREATE UNIQUE INDEX "SeatMap_mapKey_key" ON "SeatMap"("mapKey");

-- CreateIndex
CREATE INDEX "SeatMap_carrier_idx" ON "SeatMap"("carrier");

-- CreateIndex
CREATE INDEX "SeatMap_flightInstance_idx" ON "SeatMap"("flightInstance");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_seatKey_key" ON "Seat"("seatKey");

-- CreateIndex
CREATE INDEX "Seat_carrier_idx" ON "Seat"("carrier");

-- CreateIndex
CREATE INDEX "Seat_seatMap_idx" ON "Seat"("seatMap");

-- CreateIndex
CREATE INDEX "Seat_cabin_idx" ON "Seat"("cabin");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAssignment_assignmentKey_key" ON "SeatAssignment"("assignmentKey");

-- CreateIndex
CREATE INDEX "SeatAssignment_carrier_idx" ON "SeatAssignment"("carrier");

-- CreateIndex
CREATE INDEX "SeatAssignment_booking_idx" ON "SeatAssignment"("booking");

-- CreateIndex
CREATE INDEX "SeatAssignment_bookingPassenger_idx" ON "SeatAssignment"("bookingPassenger");

-- CreateIndex
CREATE INDEX "SeatAssignment_passenger_idx" ON "SeatAssignment"("passenger");

-- CreateIndex
CREATE INDEX "SeatAssignment_bookingSegment_idx" ON "SeatAssignment"("bookingSegment");

-- CreateIndex
CREATE INDEX "SeatAssignment_seat_idx" ON "SeatAssignment"("seat");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_providerKey_key" ON "PaymentProvider"("providerKey");

-- CreateIndex
CREATE INDEX "PaymentProvider_carrier_idx" ON "PaymentProvider"("carrier");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_sessionKey_key" ON "PaymentSession"("sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_idempotencyKey_key" ON "PaymentSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentSession_carrier_idx" ON "PaymentSession"("carrier");

-- CreateIndex
CREATE INDEX "PaymentSession_booking_idx" ON "PaymentSession"("booking");

-- CreateIndex
CREATE INDEX "PaymentSession_provider_idx" ON "PaymentSession"("provider");

-- CreateIndex
CREATE INDEX "PaymentSession_providerSessionId_idx" ON "PaymentSession"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentKey_key" ON "Payment"("paymentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_session_key" ON "Payment"("session");

-- CreateIndex
CREATE INDEX "Payment_carrier_idx" ON "Payment"("carrier");

-- CreateIndex
CREATE INDEX "Payment_booking_idx" ON "Payment"("booking");

-- CreateIndex
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundKey_key" ON "Refund"("refundKey");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_carrier_idx" ON "Refund"("carrier");

-- CreateIndex
CREATE INDEX "Refund_booking_idx" ON "Refund"("booking");

-- CreateIndex
CREATE INDEX "Refund_payment_idx" ON "Refund"("payment");

-- CreateIndex
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_exchangeKey_key" ON "Exchange"("exchangeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_idempotencyKey_key" ON "Exchange"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Exchange_carrier_idx" ON "Exchange"("carrier");

-- CreateIndex
CREATE INDEX "Exchange_booking_idx" ON "Exchange"("booking");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_checkInKey_key" ON "CheckIn"("checkInKey");

-- CreateIndex
CREATE INDEX "CheckIn_carrier_idx" ON "CheckIn"("carrier");

-- CreateIndex
CREATE INDEX "CheckIn_booking_idx" ON "CheckIn"("booking");

-- CreateIndex
CREATE INDEX "CheckIn_bookingPassenger_idx" ON "CheckIn"("bookingPassenger");

-- CreateIndex
CREATE INDEX "CheckIn_passenger_idx" ON "CheckIn"("passenger");

-- CreateIndex
CREATE INDEX "CheckIn_bookingSegment_idx" ON "CheckIn"("bookingSegment");

-- CreateIndex
CREATE INDEX "CheckIn_flightInstance_idx" ON "CheckIn"("flightInstance");

-- CreateIndex
CREATE INDEX "CheckIn_ticketCoupon_idx" ON "CheckIn"("ticketCoupon");

-- CreateIndex
CREATE INDEX "CheckIn_seatAssignment_idx" ON "CheckIn"("seatAssignment");

-- CreateIndex
CREATE UNIQUE INDEX "BoardingPass_passNumber_key" ON "BoardingPass"("passNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BoardingPass_checkIn_key" ON "BoardingPass"("checkIn");

-- CreateIndex
CREATE INDEX "BoardingPass_carrier_idx" ON "BoardingPass"("carrier");

-- CreateIndex
CREATE INDEX "BoardingPass_passenger_idx" ON "BoardingPass"("passenger");

-- CreateIndex
CREATE INDEX "BoardingPass_bookingSegment_idx" ON "BoardingPass"("bookingSegment");

-- CreateIndex
CREATE INDEX "BoardingPass_seatAssignment_idx" ON "BoardingPass"("seatAssignment");

-- CreateIndex
CREATE UNIQUE INDEX "Bag_bagKey_key" ON "Bag"("bagKey");

-- CreateIndex
CREATE UNIQUE INDEX "Bag_tagNumber_key" ON "Bag"("tagNumber");

-- CreateIndex
CREATE INDEX "Bag_carrier_idx" ON "Bag"("carrier");

-- CreateIndex
CREATE INDEX "Bag_booking_idx" ON "Bag"("booking");

-- CreateIndex
CREATE INDEX "Bag_bookingPassenger_idx" ON "Bag"("bookingPassenger");

-- CreateIndex
CREATE INDEX "Bag_passenger_idx" ON "Bag"("passenger");

-- CreateIndex
CREATE INDEX "Bag_flightInstance_idx" ON "Bag"("flightInstance");

-- CreateIndex
CREATE INDEX "Bag_origin_idx" ON "Bag"("origin");

-- CreateIndex
CREATE INDEX "Bag_destination_idx" ON "Bag"("destination");

-- CreateIndex
CREATE UNIQUE INDEX "BagEvent_eventKey_key" ON "BagEvent"("eventKey");

-- CreateIndex
CREATE INDEX "BagEvent_carrier_idx" ON "BagEvent"("carrier");

-- CreateIndex
CREATE INDEX "BagEvent_bag_idx" ON "BagEvent"("bag");

-- CreateIndex
CREATE INDEX "BagEvent_airport_idx" ON "BagEvent"("airport");

-- CreateIndex
CREATE INDEX "BagEvent_occurredAt_idx" ON "BagEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "BagEvent_providerConnection_idx" ON "BagEvent"("providerConnection");

-- CreateIndex
CREATE UNIQUE INDEX "Disruption_disruptionKey_key" ON "Disruption"("disruptionKey");

-- CreateIndex
CREATE INDEX "Disruption_carrier_idx" ON "Disruption"("carrier");

-- CreateIndex
CREATE INDEX "Disruption_flightInstance_idx" ON "Disruption"("flightInstance");

-- CreateIndex
CREATE INDEX "Disruption_providerConnection_idx" ON "Disruption"("providerConnection");

-- CreateIndex
CREATE UNIQUE INDEX "Reaccommodation_reaccommodationKey_key" ON "Reaccommodation"("reaccommodationKey");

-- CreateIndex
CREATE UNIQUE INDEX "Reaccommodation_idempotencyKey_key" ON "Reaccommodation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Reaccommodation_carrier_idx" ON "Reaccommodation"("carrier");

-- CreateIndex
CREATE INDEX "Reaccommodation_booking_idx" ON "Reaccommodation"("booking");

-- CreateIndex
CREATE INDEX "Reaccommodation_bookingPassenger_idx" ON "Reaccommodation"("bookingPassenger");

-- CreateIndex
CREATE INDEX "Reaccommodation_passenger_idx" ON "Reaccommodation"("passenger");

-- CreateIndex
CREATE INDEX "Reaccommodation_disruption_idx" ON "Reaccommodation"("disruption");

-- CreateIndex
CREATE INDEX "Reaccommodation_replacementOffer_idx" ON "Reaccommodation"("replacementOffer");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProvider_providerKey_key" ON "IntegrationProvider"("providerKey");

-- CreateIndex
CREATE INDEX "IntegrationProvider_carrier_idx" ON "IntegrationProvider"("carrier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_connectionKey_key" ON "ProviderConnection"("connectionKey");

-- CreateIndex
CREATE INDEX "ProviderConnection_carrier_idx" ON "ProviderConnection"("carrier");

-- CreateIndex
CREATE INDEX "ProviderConnection_provider_idx" ON "ProviderConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_endpointKey_key" ON "WebhookEndpoint"("endpointKey");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_carrier_idx" ON "WebhookEndpoint"("carrier");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_connection_idx" ON "WebhookEndpoint"("connection");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventKey_key" ON "WebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_carrier_idx" ON "WebhookEvent"("carrier");

-- CreateIndex
CREATE INDEX "WebhookEvent_providerEventId_idx" ON "WebhookEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_connection_idx" ON "WebhookEvent"("connection");

-- CreateIndex
CREATE INDEX "WebhookEvent_endpoint_idx" ON "WebhookEvent"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_carrier_idx" ON "IdempotencyKey"("carrier");

-- CreateIndex
CREATE INDEX "IdempotencyKey_actor_idx" ON "IdempotencyKey"("actor");

-- CreateIndex
CREATE INDEX "IdempotencyKey_approvedAgent_idx" ON "IdempotencyKey"("approvedAgent");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventKey_key" ON "AuditEvent"("eventKey");

-- CreateIndex
CREATE INDEX "AuditEvent_carrier_idx" ON "AuditEvent"("carrier");

-- CreateIndex
CREATE INDEX "AuditEvent_actor_idx" ON "AuditEvent"("actor");

-- CreateIndex
CREATE INDEX "AuditEvent_approvedAgent_idx" ON "AuditEvent"("approvedAgent");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AuditEvent_idempotencyKey_idx" ON "AuditEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "_Offer_passengers_B_index" ON "_Offer_passengers"("B");

-- CreateIndex
CREATE INDEX "_BookingSegment_disruptions_B_index" ON "_BookingSegment_disruptions"("B");

-- CreateIndex
CREATE INDEX "_BookingSegment_exchangesAsOriginal_B_index" ON "_BookingSegment_exchangesAsOriginal"("B");

-- CreateIndex
CREATE INDEX "_BookingSegment_exchangesAsReplacement_B_index" ON "_BookingSegment_exchangesAsReplacement"("B");

-- CreateIndex
CREATE INDEX "_BookingSegment_reaccommodationsAsOriginal_B_index" ON "_BookingSegment_reaccommodationsAsOriginal"("B");

-- CreateIndex
CREATE INDEX "_BookingSegment_reaccommodationsAsReplacement_B_index" ON "_BookingSegment_reaccommodationsAsReplacement"("B");

-- CreateIndex
CREATE INDEX "_Bag_segments_B_index" ON "_Bag_segments"("B");

-- CreateIndex
CREATE INDEX "Role_carrier_idx" ON "Role"("carrier");

-- CreateIndex
CREATE INDEX "User_carrier_idx" ON "User"("carrier");

-- CreateIndex
CREATE INDEX "User_approvedAgent_idx" ON "User"("approvedAgent");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approvedAgent_fkey" FOREIGN KEY ("approvedAgent") REFERENCES "ApprovedAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovedAgent" ADD CONSTRAINT "ApprovedAgent_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_origin_fkey" FOREIGN KEY ("origin") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_destination_fkey" FOREIGN KEY ("destination") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSchedule" ADD CONSTRAINT "FlightSchedule_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSchedule" ADD CONSTRAINT "FlightSchedule_route_fkey" FOREIGN KEY ("route") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSchedule" ADD CONSTRAINT "FlightSchedule_operatingCarrier_fkey" FOREIGN KEY ("operatingCarrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_schedule_fkey" FOREIGN KEY ("schedule") REFERENCES "FlightSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_route_fkey" FOREIGN KEY ("route") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_origin_fkey" FOREIGN KEY ("origin") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_destination_fkey" FOREIGN KEY ("destination") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_operatingCarrier_fkey" FOREIGN KEY ("operatingCarrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cabin" ADD CONSTRAINT "Cabin_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBucket" ADD CONSTRAINT "InventoryBucket_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBucket" ADD CONSTRAINT "InventoryBucket_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBucket" ADD CONSTRAINT "InventoryBucket_cabin_fkey" FOREIGN KEY ("cabin") REFERENCES "Cabin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBucket" ADD CONSTRAINT "InventoryBucket_fareBrand_fkey" FOREIGN KEY ("fareBrand") REFERENCES "FareBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryHold" ADD CONSTRAINT "InventoryHold_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryHold" ADD CONSTRAINT "InventoryHold_inventoryBucket_fkey" FOREIGN KEY ("inventoryBucket") REFERENCES "InventoryBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryHold" ADD CONSTRAINT "InventoryHold_offer_fkey" FOREIGN KEY ("offer") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareBrand" ADD CONSTRAINT "FareBrand_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareBrand" ADD CONSTRAINT "FareBrand_cabin_fkey" FOREIGN KEY ("cabin") REFERENCES "Cabin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareRule" ADD CONSTRAINT "FareRule_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareRule" ADD CONSTRAINT "FareRule_fareBrand_fkey" FOREIGN KEY ("fareBrand") REFERENCES "FareBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareRule" ADD CONSTRAINT "FareRule_route_fkey" FOREIGN KEY ("route") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AncillaryProduct" ADD CONSTRAINT "AncillaryProduct_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_approvedAgent_fkey" FOREIGN KEY ("approvedAgent") REFERENCES "ApprovedAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_offer_fkey" FOREIGN KEY ("offer") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_inventoryBucket_fkey" FOREIGN KEY ("inventoryBucket") REFERENCES "InventoryBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_fareBrand_fkey" FOREIGN KEY ("fareBrand") REFERENCES "FareBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_fareRule_fkey" FOREIGN KEY ("fareRule") REFERENCES "FareRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_ancillaryProduct_fkey" FOREIGN KEY ("ancillaryProduct") REFERENCES "AncillaryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passenger" ADD CONSTRAINT "Passenger_userAccount_fkey" FOREIGN KEY ("userAccount") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelDocument" ADD CONSTRAINT "TravelDocument_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelDocument" ADD CONSTRAINT "TravelDocument_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelDocument" ADD CONSTRAINT "TravelDocument_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_approvedAgent_fkey" FOREIGN KEY ("approvedAgent") REFERENCES "ApprovedAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sourceOffer_fkey" FOREIGN KEY ("sourceOffer") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPassenger" ADD CONSTRAINT "BookingPassenger_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_origin_fkey" FOREIGN KEY ("origin") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_destination_fkey" FOREIGN KEY ("destination") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_journey_fkey" FOREIGN KEY ("journey") REFERENCES "Journey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_sourceOfferItem_fkey" FOREIGN KEY ("sourceOfferItem") REFERENCES "OfferItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_origin_fkey" FOREIGN KEY ("origin") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSegment" ADD CONSTRAINT "BookingSegment_destination_fkey" FOREIGN KEY ("destination") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLineItem" ADD CONSTRAINT "BookingLineItem_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLineItem" ADD CONSTRAINT "BookingLineItem_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLineItem" ADD CONSTRAINT "BookingLineItem_sourceOfferItem_fkey" FOREIGN KEY ("sourceOfferItem") REFERENCES "OfferItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLineItem" ADD CONSTRAINT "BookingLineItem_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLineItem" ADD CONSTRAINT "BookingLineItem_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLineItem" ADD CONSTRAINT "BookingLineItem_ancillaryProduct_fkey" FOREIGN KEY ("ancillaryProduct") REFERENCES "AncillaryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_originalTicket_fkey" FOREIGN KEY ("originalTicket") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCoupon" ADD CONSTRAINT "TicketCoupon_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCoupon" ADD CONSTRAINT "TicketCoupon_ticket_fkey" FOREIGN KEY ("ticket") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCoupon" ADD CONSTRAINT "TicketCoupon_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscDocument" ADD CONSTRAINT "ElectronicMiscDocument_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscDocument" ADD CONSTRAINT "ElectronicMiscDocument_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscDocument" ADD CONSTRAINT "ElectronicMiscDocument_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscDocument" ADD CONSTRAINT "ElectronicMiscDocument_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscDocument" ADD CONSTRAINT "ElectronicMiscDocument_ancillaryProduct_fkey" FOREIGN KEY ("ancillaryProduct") REFERENCES "AncillaryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscCoupon" ADD CONSTRAINT "ElectronicMiscCoupon_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscCoupon" ADD CONSTRAINT "ElectronicMiscCoupon_document_fkey" FOREIGN KEY ("document") REFERENCES "ElectronicMiscDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscCoupon" ADD CONSTRAINT "ElectronicMiscCoupon_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscCoupon" ADD CONSTRAINT "ElectronicMiscCoupon_ancillaryProduct_fkey" FOREIGN KEY ("ancillaryProduct") REFERENCES "AncillaryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicMiscCoupon" ADD CONSTRAINT "ElectronicMiscCoupon_bookingLineItem_fkey" FOREIGN KEY ("bookingLineItem") REFERENCES "BookingLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatMap" ADD CONSTRAINT "SeatMap_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatMap" ADD CONSTRAINT "SeatMap_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_seatMap_fkey" FOREIGN KEY ("seatMap") REFERENCES "SeatMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_cabin_fkey" FOREIGN KEY ("cabin") REFERENCES "Cabin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_seat_fkey" FOREIGN KEY ("seat") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProvider" ADD CONSTRAINT "PaymentProvider_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_provider_fkey" FOREIGN KEY ("provider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_provider_fkey" FOREIGN KEY ("provider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_session_fkey" FOREIGN KEY ("session") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_ticketCoupon_fkey" FOREIGN KEY ("ticketCoupon") REFERENCES "TicketCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_seatAssignment_fkey" FOREIGN KEY ("seatAssignment") REFERENCES "SeatAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingPass" ADD CONSTRAINT "BoardingPass_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingPass" ADD CONSTRAINT "BoardingPass_checkIn_fkey" FOREIGN KEY ("checkIn") REFERENCES "CheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingPass" ADD CONSTRAINT "BoardingPass_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingPass" ADD CONSTRAINT "BoardingPass_bookingSegment_fkey" FOREIGN KEY ("bookingSegment") REFERENCES "BookingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardingPass" ADD CONSTRAINT "BoardingPass_seatAssignment_fkey" FOREIGN KEY ("seatAssignment") REFERENCES "SeatAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_origin_fkey" FOREIGN KEY ("origin") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bag" ADD CONSTRAINT "Bag_destination_fkey" FOREIGN KEY ("destination") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagEvent" ADD CONSTRAINT "BagEvent_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagEvent" ADD CONSTRAINT "BagEvent_bag_fkey" FOREIGN KEY ("bag") REFERENCES "Bag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagEvent" ADD CONSTRAINT "BagEvent_airport_fkey" FOREIGN KEY ("airport") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagEvent" ADD CONSTRAINT "BagEvent_providerConnection_fkey" FOREIGN KEY ("providerConnection") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disruption" ADD CONSTRAINT "Disruption_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disruption" ADD CONSTRAINT "Disruption_flightInstance_fkey" FOREIGN KEY ("flightInstance") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disruption" ADD CONSTRAINT "Disruption_providerConnection_fkey" FOREIGN KEY ("providerConnection") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccommodation" ADD CONSTRAINT "Reaccommodation_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccommodation" ADD CONSTRAINT "Reaccommodation_booking_fkey" FOREIGN KEY ("booking") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccommodation" ADD CONSTRAINT "Reaccommodation_bookingPassenger_fkey" FOREIGN KEY ("bookingPassenger") REFERENCES "BookingPassenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccommodation" ADD CONSTRAINT "Reaccommodation_passenger_fkey" FOREIGN KEY ("passenger") REFERENCES "Passenger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccommodation" ADD CONSTRAINT "Reaccommodation_disruption_fkey" FOREIGN KEY ("disruption") REFERENCES "Disruption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaccommodation" ADD CONSTRAINT "Reaccommodation_replacementOffer_fkey" FOREIGN KEY ("replacementOffer") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_provider_fkey" FOREIGN KEY ("provider") REFERENCES "IntegrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_connection_fkey" FOREIGN KEY ("connection") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_connection_fkey" FOREIGN KEY ("connection") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_endpoint_fkey" FOREIGN KEY ("endpoint") REFERENCES "WebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_approvedAgent_fkey" FOREIGN KEY ("approvedAgent") REFERENCES "ApprovedAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_carrier_fkey" FOREIGN KEY ("carrier") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_approvedAgent_fkey" FOREIGN KEY ("approvedAgent") REFERENCES "ApprovedAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Offer_passengers" ADD CONSTRAINT "_Offer_passengers_A_fkey" FOREIGN KEY ("A") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Offer_passengers" ADD CONSTRAINT "_Offer_passengers_B_fkey" FOREIGN KEY ("B") REFERENCES "Passenger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_disruptions" ADD CONSTRAINT "_BookingSegment_disruptions_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_disruptions" ADD CONSTRAINT "_BookingSegment_disruptions_B_fkey" FOREIGN KEY ("B") REFERENCES "Disruption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_exchangesAsOriginal" ADD CONSTRAINT "_BookingSegment_exchangesAsOriginal_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_exchangesAsOriginal" ADD CONSTRAINT "_BookingSegment_exchangesAsOriginal_B_fkey" FOREIGN KEY ("B") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_exchangesAsReplacement" ADD CONSTRAINT "_BookingSegment_exchangesAsReplacement_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_exchangesAsReplacement" ADD CONSTRAINT "_BookingSegment_exchangesAsReplacement_B_fkey" FOREIGN KEY ("B") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_reaccommodationsAsOriginal" ADD CONSTRAINT "_BookingSegment_reaccommodationsAsOriginal_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_reaccommodationsAsOriginal" ADD CONSTRAINT "_BookingSegment_reaccommodationsAsOriginal_B_fkey" FOREIGN KEY ("B") REFERENCES "Reaccommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_reaccommodationsAsReplacement" ADD CONSTRAINT "_BookingSegment_reaccommodationsAsReplacement_A_fkey" FOREIGN KEY ("A") REFERENCES "BookingSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSegment_reaccommodationsAsReplacement" ADD CONSTRAINT "_BookingSegment_reaccommodationsAsReplacement_B_fkey" FOREIGN KEY ("B") REFERENCES "Reaccommodation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Bag_segments" ADD CONSTRAINT "_Bag_segments_A_fkey" FOREIGN KEY ("A") REFERENCES "Bag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Bag_segments" ADD CONSTRAINT "_Bag_segments_B_fkey" FOREIGN KEY ("B") REFERENCES "BookingSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
