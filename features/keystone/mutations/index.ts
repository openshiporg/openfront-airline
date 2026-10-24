import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import { cancelBooking, createBookingFromOffer, operatorBookingReceipt } from "./airlineOperations";
import {
  acceptCheckedBag,
  approveManualPaymentEvidence,
  captureBookingPayment,
  checkInBookingPassenger,
  createOfferFromShopping,
  issueBookingTickets,
  processBookingRefund,
  registerPassengerTravelDocument,
  rejectManualPaymentEvidence,
  searchAirlineFlights,
  submitManualPaymentEvidence,
  verifyPassengerTravelDocument,
} from './airlineWorkflows';
import { recoverCustomerBookingAccess } from './storefrontAccess'
import { recordBagEvent, registerAirport, updateFlightOperations } from './airlineOperationsControl'
import { recordReceivedPayment, reissueBookingAccessCode } from './airlinePaymentsDesk'
import { assignCustomerSeat, cancelCustomerBooking, checkInCustomerBooking, createCustomerBooking, createCustomerOffer, getCustomerBooking, getPublicCarrierIdentity, publicAirlineFlightOptions, publicFlightStatuses, rotateCustomerBookingAccessToken } from './storefront'
import { publishFlightDisruption, reaccommodateBooking } from './airlineRecovery'
import { boardBookingPassenger, departureManifest, offloadBookingPassenger } from './airlineDepartures'
import { provisionDatedFlight, setDatedFlightSalesStatus, setInventoryAuthorization } from './airlineProvisioning'
import { issueMachineCredential, machineCredentialSummaries, revokeMachineCredential } from './machineCredentials'
import { requeueDeadLetteredOutboxEvent } from './outboxRecovery'
import { completeCarrierOnboarding, dismissCarrierOnboarding } from './onboarding'
import { updateCarrierStorefrontSettings } from './storefrontSettings'

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      enum AirlineSalesStatus {
        open_for_sale
        closed_for_sale
      }

      type AirlineOperationResult {
        resourceType: String!
        resourceId: ID!
        offerId: ID
        offerNumber: String
        bookingId: ID
        recordLocator: String
        orderNumber: String
        status: String!
        totalAmount: Int
        currencyCode: String
        expiresAt: String
        passengerIds: [ID!]
        bookingAccessToken: String
        bookingReceipt: JSON
        changed: Boolean!
        replayed: Boolean!
      }

      type AirlineAvailability {
        available: Int!
        authorized: Int!
        sold: Int!
        held: Int!
        blocked: Int!
      }

      type AirlineFareBrand {
        code: String!
        name: String!
        description: String
        baggagePieces: Int
        baggageWeightGrams: Int
      }

      type PublicCarrierIdentity {
        id: ID!
        code: String!
        name: String!
        legalName: String!
        defaultCurrencyCode: String!
        defaultTimezone: String!
        salesEnabled: Boolean!
        storefrontBrandColor: String
        storefrontHomepageTitle: String
        storefrontHomepageDescription: String
        storefrontConfigured: Boolean!
        accessRecoveryEnabled: Boolean!
        storefrontContactEmail: String
        storefrontContactPhone: String
        storefrontServiceHours: String
      }

      type AirlineFlightOption {
        id: ID!
        inventoryBucketId: ID!
        flightNumber: String!
        serviceDate: String!
        scheduledDepartureAt: String!
        scheduledArrivalAt: String!
        originCode: String!
        originCity: String!
        destinationCode: String!
        destinationCity: String!
        fareBrand: AirlineFareBrand!
        cabinName: String
        currencyCode: String!
        baseAmount: Int!
        taxAmount: Int!
        totalAmount: Int!
        perTravelerBaseAmount: Int!
        perTravelerTaxAmount: Int!
        perTravelerTotalAmount: Int!
        partyTotalAmount: Int!
        passengerCount: Int!
        availability: AirlineAvailability!
        unavailableReason: String
      }

      type PublicFlightDisruption {
        type: String!
        status: String!
        publicSummary: String
        publishedAt: String
      }

      type PublicFlightStatus {
        id: ID!
        flightNumber: String!
        serviceDate: String!
        status: String!
        scheduledDepartureAt: String!
        scheduledArrivalAt: String!
        estimatedDepartureAt: String
        estimatedArrivalAt: String
        actualDepartureAt: String
        actualArrivalAt: String
        departureTerminal: String
        departureGate: String
        arrivalTerminal: String
        arrivalGate: String
        originCode: String!
        originCity: String!
        originTimezone: String!
        destinationCode: String!
        destinationCity: String!
        destinationTimezone: String!
        disruption: PublicFlightDisruption
      }

      type RotatedBookingAccess {
        recordLocator: String!
        accessToken: String!
      }

      type OnboardingStepProgress {
        key: String!
        status: String!
        attemptCount: Int!
        requirements: [String!]!
      }

      type OnboardingProgress {
        completed: Boolean!
        steps: [OnboardingStepProgress!]!
      }

      type OnboardingStatusResult {
        id: ID!
        onboardingStatus: String!
      }

      type IssuedMachineCredential {
        credentialId: ID!
        keyId: String!
        token: String!
        expiresAt: String!
      }

      type CustomerBooking {
        id: ID!
        recordLocator: String!
        orderNumber: String!
        status: String!
        paymentStatus: String!
        ticketingStatus: String!
        totalAmount: Int!
        currencyCode: String!
        carrier: JSON!
        passengers: JSON!
        segments: JSON!
        payments: JSON!
        tickets: JSON!
        checkIns: JSON!
        reaccommodations: JSON!
        bookingReceipt: JSON!
      }

      input CustomerPassengerInput {
        givenName: String!
        familyName: String!
        dateOfBirth: String!
        email: String!
        phone: String
      }

      type Query {
        redirectToInit: Boolean
        airlineFlightOptions(
          originCode: String!
          destinationCode: String!
          serviceDate: String!
          passengerCount: Int = 1
        ): [AirlineFlightOption!]!
        customerBooking(recordLocator: String!, accessToken: String!): CustomerBooking!
        operatorBookingReceipt(bookingId: ID!): JSON!
        publicCarrierIdentity(carrierCode: String!): PublicCarrierIdentity
        departureManifest(serviceDate: String!, originCode: String, cleanupCursor: String): JSON!
        machineCredentialSummaries: JSON!
        publicAirlineFlightOptions(
          carrierCode: String!
          originCode: String!
          destinationCode: String!
          serviceDate: String!
          passengerCount: Int = 1
        ): [AirlineFlightOption!]!
        publicFlightStatuses(
          carrierCode: String!
          flightNumber: String!
          serviceDate: String!
        ): [PublicFlightStatus!]!
      }

      type Mutation {
        updateCarrierStorefrontSettings(
          name: String!
          legalName: String!
          storefrontBrandColor: String!
          storefrontHomepageTitle: String!
          storefrontHomepageDescription: String!
          storefrontContactEmail: String
          storefrontContactPhone: String
          storefrontServiceHours: String
        ): Carrier!
        completeCarrierOnboarding(
          name: String!
          legalName: String!
          code: String!
          currencyCode: String!
          timezone: String!
          originCode: String!
          destinationCode: String!
          flightNumber: String!
          serviceDate: String!
          scheduledDepartureAt: String!
          scheduledArrivalAt: String!
          capacity: Int!
          baseAmount: Int!
          taxAmount: Int!
        ): OnboardingProgress!
        dismissCarrierOnboarding: OnboardingStatusResult!
        issueMachineCredential(name: String!, audience: String!, scopes: [String!]!, expiresAt: String!): IssuedMachineCredential!
        revokeMachineCredential(credentialId: ID!): Boolean!
        requeueDeadLetteredOutboxEvent(outboxEventId: ID!, expectedAttemptCount: Int!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        registerAirport(iataCode: String!, icaoCode: String, name: String!, city: String!, countryCode: String!, subdivisionCode: String, timezone: String!, idempotencyKey: String!): AirlineOperationResult!
        updateFlightOperations(
          flightInstanceId: ID!
          departureTerminal: String
          departureGate: String
          arrivalTerminal: String
          arrivalGate: String
          estimatedDepartureAt: String
          estimatedArrivalAt: String
          actualDepartureAt: String
          actualArrivalAt: String
          status: String
          idempotencyKey: String!
        ): AirlineOperationResult!
        recordBagEvent(bagId: ID!, action: String!, airportCode: String, note: String, idempotencyKey: String!): AirlineOperationResult!
        recordReceivedPayment(bookingId: ID!, purpose: String!, method: String!, externalReference: String!, amount: Int!, receivedAt: String!, idempotencyKey: String!): AirlineOperationResult!
        reissueBookingAccessCode(bookingId: ID!): RotatedBookingAccess!
        rotateCustomerBookingAccessToken(recordLocator: String!, accessToken: String!): RotatedBookingAccess!
        recoverCustomerBookingAccess(carrierCode: String!, recordLocator: String!, email: String!): Boolean!
        cancelCustomerBooking(recordLocator: String!, accessToken: String!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        assignCustomerSeat(recordLocator: String!, accessToken: String!, bookingPassengerId: ID!, bookingSegmentId: ID!, seatId: ID!, idempotencyKey: String!): AirlineOperationResult!
        checkInCustomerBooking(
          recordLocator: String!
          accessToken: String!
          bookingPassengerId: ID!
          bookingSegmentId: ID!
          seatId: ID
          idempotencyKey: String!
        ): AirlineOperationResult!
        createCustomerOffer(
          carrierCode: String!
          flightInstanceId: ID!
          inventoryBucketId: ID!
          shoppingSessionToken: String!
          idempotencyKey: String!
          passengers: [CustomerPassengerInput!]!
        ): AirlineOperationResult!
        createCustomerBooking(
          offerId: ID!
          passengerIds: [ID!]!
          shoppingSessionToken: String!
          idempotencyKey: String!
          recoverOnly: Boolean
        ): AirlineOperationResult!
        createOfferFromShopping(
          flightInstanceId: ID!
          inventoryBucketId: ID!
          passengerIds: [ID!]!
          idempotencyKey: String!
        ): AirlineOperationResult!
        submitManualPaymentEvidence(
          bookingId: ID!
          purpose: String!
          externalReference: String!
          ledgerSource: String!
          evidenceDigest: String!
          amount: Int!
          currencyCode: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        approveManualPaymentEvidence(evidenceId: ID!, idempotencyKey: String!): AirlineOperationResult!
        rejectManualPaymentEvidence(evidenceId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        captureBookingPayment(
          bookingId: ID!
          idempotencyKey: String!
          providerReference: String!
          instrumentBrand: String
          instrumentLast4: String
        ): AirlineOperationResult!
        issueBookingTickets(bookingId: ID!, idempotencyKey: String!): AirlineOperationResult!
        processBookingRefund(
          bookingId: ID!
          amount: Int!
          reason: String!
          providerReference: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        provisionDatedFlight(
          scheduleId: ID!
          cabinId: ID!
          fareBrandId: ID!
          serviceDate: String!
          scheduledDepartureAt: String!
          scheduledArrivalAt: String!
          capacity: Int!
          baseAmount: Int!
          taxAmount: Int!
          currencyCode: String!
          departureTerminal: String
          departureGate: String
          idempotencyKey: String!
        ): AirlineOperationResult!
        setDatedFlightSalesStatus(flightInstanceId: ID!, status: AirlineSalesStatus!, idempotencyKey: String!): AirlineOperationResult!
        setInventoryAuthorization(inventoryBucketId: ID!, authorized: Int!, idempotencyKey: String!): AirlineOperationResult!
        publishFlightDisruption(
          flightInstanceId: ID!
          type: String!
          publicSummary: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        reaccommodateBooking(
          disruptionId: ID!
          bookingId: ID!
          replacementFlightInstanceId: ID!
          replacementInventoryBucketId: ID!
          idempotencyKey: String!
        ): AirlineOperationResult!
        registerPassengerTravelDocument(
          bookingPassengerId: ID!
          bookingSegmentId: ID!
          documentType: String!
          documentNumber: String!
          issuingCountryCode: String!
          nationalityCode: String
          issuedAt: String
          expiresAt: String!
          providerReference: String!
          evidenceVersion: String!
          verificationExpiresAt: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        verifyPassengerTravelDocument(
          travelDocumentId: ID!
          bookingSegmentId: ID!
          providerReference: String!
          evidenceVersion: String!
          expiresAt: String!
          idempotencyKey: String!
        ): AirlineOperationResult!
        checkInBookingPassenger(
          bookingPassengerId: ID!
          bookingSegmentId: ID!
          idempotencyKey: String!
          seatId: ID
        ): AirlineOperationResult!
        boardBookingPassenger(boardingPassId: ID!, idempotencyKey: String!): AirlineOperationResult!
        offloadBookingPassenger(boardingPassId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
        acceptCheckedBag(
          bookingPassengerId: ID!
          flightInstanceId: ID!
          idempotencyKey: String!
          weightGrams: Int!
        ): AirlineOperationResult!

        createBookingFromOffer(
          offerId: ID!
          passengerIds: [ID!]!
          idempotencyKey: String!
          recoverOnly: Boolean
        ): AirlineOperationResult!
        cancelBooking(bookingId: ID!, reason: String!, idempotencyKey: String!): AirlineOperationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit,
        customerBooking: getCustomerBooking,
        operatorBookingReceipt,
        publicCarrierIdentity: getPublicCarrierIdentity,
        departureManifest,
        machineCredentialSummaries,
        publicFlightStatuses,
        airlineFlightOptions: async (root: unknown, args: any, context: any) => {
          const options = await searchAirlineFlights(root, args, context)
          return options.map(option => ({
            ...option,
            originCode: option.origin.iataCode,
            originCity: option.origin.city,
            destinationCode: option.destination.iataCode,
            destinationCity: option.destination.city,
          }))
        },
        publicAirlineFlightOptions: async (root: unknown, args: any, context: any) => {
          const options = await publicAirlineFlightOptions(root, args, context)
          return options.map(option => ({
            ...option,
            originCode: option.origin.iataCode,
            originCity: option.origin.city,
            destinationCode: option.destination.iataCode,
            destinationCity: option.destination.city,
          }))
        },
      },
      Mutation: {
        updateCarrierStorefrontSettings,
        completeCarrierOnboarding,
        dismissCarrierOnboarding,
        issueMachineCredential,
        revokeMachineCredential,
        requeueDeadLetteredOutboxEvent,
        createCustomerOffer,
        createCustomerBooking,
        rotateCustomerBookingAccessToken,
        registerAirport,
        updateFlightOperations,
        recordBagEvent,
        recordReceivedPayment,
        reissueBookingAccessCode,
        recoverCustomerBookingAccess,
        cancelCustomerBooking,
        assignCustomerSeat,
        checkInCustomerBooking,
        createOfferFromShopping,
        submitManualPaymentEvidence,
        approveManualPaymentEvidence,
        rejectManualPaymentEvidence,
        captureBookingPayment,
        issueBookingTickets,
        processBookingRefund,
        provisionDatedFlight,
        setDatedFlightSalesStatus,
        setInventoryAuthorization,
        publishFlightDisruption,
        reaccommodateBooking,
        registerPassengerTravelDocument,
        verifyPassengerTravelDocument,
        checkInBookingPassenger,
        boardBookingPassenger,
        offloadBookingPassenger,
        acceptCheckedBag,

        cancelBooking,
        createBookingFromOffer,
      },
    },
  });
}