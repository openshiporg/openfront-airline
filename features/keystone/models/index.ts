import { AncillaryProduct } from './AncillaryProduct'
import { ApprovedAgent } from './ApprovedAgent'
import { Airport } from './Airport'
import { AuditEvent } from './AuditEvent'
import { Bag } from './Bag'
import { BagEvent } from './BagEvent'
import { BoardingPass } from './BoardingPass'
import { Booking } from './Booking'
import { BookingLineItem } from './BookingLineItem'
import { BookingPassenger } from './BookingPassenger'
import { BookingSegment } from './BookingSegment'
import { Cabin } from './Cabin'
import { Carrier } from './Carrier'
import { CheckIn } from './CheckIn'
import { Disruption } from './Disruption'
import { DocumentVerification } from './DocumentVerification'
import { ElectronicMiscCoupon } from './ElectronicMiscCoupon'
import { ElectronicMiscDocument } from './ElectronicMiscDocument'
import { Exchange } from './Exchange'
import { FareBrand } from './FareBrand'
import { FareRule } from './FareRule'
import { FlightInstance } from './FlightInstance'
import { FlightSchedule } from './FlightSchedule'
import { InventoryBucket } from './InventoryBucket'
import { IdempotencyKey } from './IdempotencyKey'
import { IntegrationProvider } from './IntegrationProvider'
import { InventoryHold } from './InventoryHold'
import { MachineCredential } from './MachineCredential'
import { ManualPaymentEvidence } from './ManualPaymentEvidence'
import { Journey } from './Journey'
import { Offer } from './Offer'
import { OfferItem } from './OfferItem'
import { OnboardingStep } from './OnboardingStep'
import { Passenger } from './Passenger'
import { Payment } from './Payment'
import { PaymentProvider } from './PaymentProvider'
import { PaymentSession } from './PaymentSession'
import { ProviderConnection } from './ProviderConnection'
import { Reaccommodation } from './Reaccommodation'
import { Refund } from './Refund'
import { RateLimitBucket } from './RateLimitBucket'
import { Role } from './Role'
import { Route } from './Route'
import { Seat } from './Seat'
import { SeatAssignment } from './SeatAssignment'
import { SeatMap } from './SeatMap'
import { SettlementLedgerEntry } from './SettlementLedgerEntry'
import { StationAssignment } from './StationAssignment'
import { ServiceRequest } from './ServiceRequest'
import { Ticket } from './Ticket'
import { TicketCoupon } from './TicketCoupon'
import { TicketCouponLineage } from './TicketCouponLineage'
import { ServiceObligation } from './ServiceObligation'
import { TravelDocument } from './TravelDocument'
import { User } from './User'
import { WebhookEndpoint } from './WebhookEndpoint'
import { WebhookEvent } from './WebhookEvent'

const rawModels = {
  User,
  Role,
  Carrier,
  Airport,
  ApprovedAgent,
  Route,
  FlightSchedule,
  FlightInstance,
  Cabin,
  InventoryBucket,
  InventoryHold,
  FareBrand,
  FareRule,
  AncillaryProduct,
  Offer,
  OfferItem,
  Passenger,
  TravelDocument,
  DocumentVerification,
  Booking,
  BookingPassenger,
  Journey,
  BookingSegment,
  BookingLineItem,
  ServiceRequest,
  Ticket,
  TicketCoupon,
  ServiceObligation,
  TicketCouponLineage,
  ElectronicMiscDocument,
  ElectronicMiscCoupon,
  SeatMap,
  Seat,
  SeatAssignment,
  PaymentProvider,
  PaymentSession,
  SettlementLedgerEntry,
  ManualPaymentEvidence,
  Payment,
  Refund,
  Exchange,
  CheckIn,
  BoardingPass,
  Bag,
  BagEvent,
  Disruption,
  Reaccommodation,
  StationAssignment,
  IntegrationProvider,
  ProviderConnection,
  WebhookEndpoint,
  WebhookEvent,
  MachineCredential,
  OnboardingStep,
  RateLimitBucket,
  IdempotencyKey,
  AuditEvent,
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Sidebar visibility follows the role: a list whose query access denies the session is hidden from navigation
// (Keystone evaluates ui.isHidden per session in admin meta). Explicit isHidden settings are kept.
export const models = Object.fromEntries(Object.entries(rawModels).map(([key, config]: [string, any]) => {
  const operationQuery = config?.access?.operation?.query
  const filterQuery = config?.access?.filter?.query
  if (typeof operationQuery !== 'function' && typeof filterQuery !== 'function') return [key, config]
  const existing = config?.ui?.isHidden
  const isHidden = async (args: any) => {
    if (existing === true || (typeof existing === 'function' && (await existing(args)))) return true
    if (typeof operationQuery === 'function' && !(await operationQuery(args))) return true
    return typeof filterQuery === 'function' && (await filterQuery(args)) === false
  }
  return [key, { ...config, ui: { ...(config.ui ?? {}), isHidden } }]
})) as typeof rawModels

export default models
