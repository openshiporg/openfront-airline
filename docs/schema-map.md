# Openfront Airline: schema map (2026-10-23)

Source: `features/keystone/models/**` (59 lists), `features/keystone/mutations/**` (custom commands), `features/keystone/lib/lifecycle.ts` (state machines), onboarding (`mutations/onboarding.ts`, `features/platform/onboarding`).

**Access models** (`features/keystone/access.ts`):
- **carrierScoped:** generic Keystone CRUD, limited to the operator's carrier and gated by a read and a manage permission.
- **commandOnly:** GraphQL can read, but every write goes through a custom command that is idempotent, audited and run in a serializable transaction.
- **stationScoped:** commandOnly, plus a `StationAssignment` capability (`canCheckIn`, `canAcceptBags`, `canBoard`) at the flight's origin airport.

**Who creates a record:**
- **M:** the merchant (an operator in the dashboard).
- **C:** the customer (through the storefront).
- **S:** the system (commands, hooks, the worker).

## Lists

### Identity, tenancy and access
| List | Purpose | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| User | Operator account | name, email, password, onboardingStatus | carrier, role, approvedAgent, stationAssignments | M (first one via `/dashboard/init`; the User `resolveInput` hook attaches the carrier and admin role) | onboarding: not_started → in_progress → completed / dismissed |
| Role | Permission set: 31 read/manage flags across network, inventory, offers, bookings, passengers, ticketing, payments, airport service, disruptions, integrations, audit and onboarding | can* flags | carrier, assignedTo | M (first role via setup) | none |
| Carrier | The airline (tenant) | code (unique IATA designator), currency, timezone, directSalesEnabled, storefront branding | everything | S (setup), M (onboarding, storefront settings) | active / suspended / archived |
| ApprovedAgent | Accredited travel agency that may sell or service | accreditation type and number, validity, channels | carrier, users, offers, bookings | M | pending → approved → suspended / revoked / expired |
| StationAssignment | Lets a user work an airport: check in, accept bags, board | canCheckIn, canAcceptBags, canBoard, validFrom, validUntil | user, airport | M | active / suspended / revoked |
| MachineCredential | Token for the settlement-import machine API | audience, scopes, expiresAt | carrier | M (`issueMachineCredential` / `revokeMachineCredential`) | active / revoked / expired |
| OnboardingStep | Progress record for the launch review | step, attemptCount, inputDigest | carrier, user | S (`completeCarrierOnboarding`) | pending / completed / needs_attention |

### Network and schedule
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Airport | Global station reference, shared by all carriers | iataCode, icaoCode, city, country, timezone | routes, flights, bag events, station assignments | S (onboarding catalog), M (`registerAirport`); GraphQL create is denied | isActive |
| Route | Carrier city pair | routeKey, distance, isInternational | origin, destination, schedules, fare rules | M (CRUD; onboarding creates the first) | draft → active → suspended → archived |
| FlightSchedule | Recurring pattern: flight number, local times, weekdays, effective dates | flightNumber, departure and arrival local times, daysOfWeek, effectiveFrom/To | route, operatingCarrier, instances | M (CRUD) | draft → published → suspended → retired |
| FlightInstance | One dated, sellable flight | serviceDate, scheduled, estimated and actual times, terminals, gates | schedule, route, origin, destination, buckets, seat maps, segments, check-ins, bags, disruptions | S (`provisionDatedFlight`) | scheduled → open_for_sale ⇄ closed_for_sale → delayed → departed → arrived; any → cancelled (`setDatedFlightSalesStatus`, `publishFlightDisruption`, `updateFlightOperations`) |
| SeatMap / Seat | Cabin layout for one dated flight | rowNumber, columnCode, seatType, surcharge | flightInstance, cabin, assignments | S (provisioning generates rows and columns from capacity) | SeatMap: draft / published / retired; Seat: available / blocked / unavailable |

### Product and pricing
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Cabin | Economy, premium economy, business or first | code, name, cabinClass, displayOrder | fare brands, buckets, seats | M (CRUD; onboarding creates Y) | none |
| FareBrand | Branded fare family | code, name, description, includedBaggage {pieces, maxWeightGrams} | cabin | M (CRUD) | draft → active → inactive → archived |
| FareRule | Conditions for a fare basis on a route | fareBasisPattern, travel and sale windows, stay rules, advance purchase, refundable, changeable, fees | fareBrand, route | M (CRUD) | draft / active / inactive / archived |
| AncillaryProduct | Extras: seat, bag, priority, lounge, meal, wifi, assistance | type, price, tax, requiresInventory | carrier | M (CRUD) | draft / active / inactive / archived |
| InventoryBucket | Seats per booking class on one dated flight | capacity, authorized, sold, held, blocked, base and tax amounts | flightInstance, cabin, fareBrand, holds | S (provisioning); M (`setInventoryAuthorization`) | open / closed / frozen |
| InventoryHold | Seats held for an offer | quantity, expiresAt | bucket, offer | S (offer creation) | active → converted / released / expired |

### Retailing and orders
| List | Purpose | Key fields | Relationships | Created by | States |
|---|---|---|---|---|---|
| Offer / OfferItem | Priced, expiring proposal | offerNumber, totals, expiresAt, source | passengers, items, holds, booking | C (`createCustomerOffer`), M (`createOfferFromShopping`) | draft → available → held → accepted / expired / withdrawn |
| Passenger | Traveller profile | names, date of birth, contact, loyalty | carrier | C or M (with the offer) | active / merged / restricted / archived |
| Booking | The order (record locator) | recordLocator, totals, contact, access-token hash | passengers, journeys, segments, line items, tickets, payments, refunds, check-ins, bags | C (`createCustomerBooking`), M (`createBookingFromOffer`) | pending → confirmed → ticketed → in_progress → completed; cancel from any open state. paymentStatus and ticketingStatus are separate. |
| BookingPassenger | A passenger on a booking | passengerType (adult / child / infant_with_seat, by age), passengerSnapshot | booking, passenger | S | active / cancelled / completed |
| Journey / BookingSegment | Itinerary flight legs | segment sequence, codes, cabin, class, fare basis | flightInstance, bucket | S | segment: confirmed → checked_in → boarded → flown; also offloaded, disrupted, reaccommodated, cancelled, refunded |
| BookingLineItem | Priced lines | type, amounts | segment, passenger, ancillary | S | none |
| ServiceRequest | Special service request (SSR) or OSI, such as wheelchair or meal | category, code, travellerText | booking, passenger, segment | **no command creates it** | requested → … → fulfilled / unable / cancelled |

### Ticketing
| List | Purpose | Created by | States |
|---|---|---|---|
| Ticket / TicketCoupon | E-ticket per passenger, with one coupon per segment | S (`issueBookingTickets`) | ticket: issued → partially_used → used; also voided, refunded, exchanged. coupon: open → checked_in → boarded → flown |
| ServiceObligation / TicketCouponLineage | Entitlement versioning across reissues | S | active / fulfilled / retired |
| ElectronicMiscDocument / Coupon | EMD for ancillaries | **no command issues them** | pending → issued → … |
| Exchange | Change quote and execution | **no command** | quoted → accepted → … |

### Payments
| List | Purpose | Created by | States |
|---|---|---|---|
| PaymentProvider | Settlement adapter. Only `manual` (evidence-only) can be activated: configuration `{providerExecution:false, requiresIndependentApproval:true}`. Credentials are write-only. | M (CRUD) | inactive / active / degraded / disabled |
| ManualPaymentEvidence | Maker-checker evidence of an external settlement | M (submit, then a different user approves or rejects) | submitted → approved → consumed; or rejected |
| Payment / PaymentSession | Captured value against a booking | S (`captureBookingPayment` consumes approved evidence) | pending → authorized → captured → partially_refunded → refunded |
| Refund | Refund against a captured payment | M (`processBookingRefund`, with approved refund evidence) | requested → … → succeeded / failed |
| SettlementLedgerEntry | Imported external ledger line | S (machine API) | none |

### Airport service
| List | Purpose | Created by | States |
|---|---|---|---|
| TravelDocument / DocumentVerification | Tokenized passport or ID and its station verification | M (`registerPassengerTravelDocument`, `verifyPassengerTravelDocument`) | unverified → verified / rejected / expired / revoked |
| SeatAssignment | Seat for a passenger on a segment | C (`assignCustomerSeat`), S (check-in) | held → assigned → confirmed → boarded; or released / cancelled |
| CheckIn / BoardingPass | Check-in and pass | C (`checkInCustomerBooking`), M (`checkInBookingPassenger`) | check-in: eligible → checked_in → boarded / offloaded. pass: issued → reissued → boarded / revoked |
| Bag / BagEvent | Checked bag and its scan history | M (`acceptCheckedBag`, `recordBagEvent`) | accepted → loaded → in_transit → arrived → delivered → closed; also delayed, mishandled |

### Irregular operations
| List | Purpose | Created by | States |
|---|---|---|---|
| Disruption | Delay, cancellation or schedule change on a flight | M (`publishFlightDisruption`) | detected → published → recovering → resolved / cancelled |
| Reaccommodation | Rebooking a disrupted passenger | M (`reaccommodateBooking`) | proposed → accepted → confirmed; or declined, failed, expired |

### Integrations and system (no page of their own)
| List | Parent page |
|---|---|
| IntegrationProvider, ProviderConnection | Settings & readiness (connections) |
| WebhookEndpoint, WebhookEvent, OutboxEvent | Settings & readiness, and the generic list views; `requeueDeadLetteredOutboxEvent` |
| AuditEvent | Manifest entry & audit |
| IdempotencyKey, RateLimitBucket, WorkerHeartbeat | System only, never shown |

## Merchant workflows
1. **Launch:** first-run setup (User, Carrier, Role) → onboarding (Carrier, Airport, Route, Cabin, FareBrand, FlightSchedule, FlightInstance, InventoryBucket, SeatMap, PaymentProvider, MachineCredential, OnboardingStep) → storefront settings (Carrier branding).
2. **Build the network:** Airport (register) → Route → FlightSchedule (publish) → provision dated flights (FlightInstance, InventoryBucket, SeatMap, Seat).
3. **Price and sell:** Cabin → FareBrand → FareRule → bucket authorization and open sales → Offer (hold) → Booking.
4. **Settle and ticket:** ManualPaymentEvidence (maker) → approve (checker) → Payment (capture) → Ticket and TicketCoupon (issue).
5. **Day of operation:** FlightInstance gates and times → StationAssignment → TravelDocument and verification → CheckIn → Bag (accept, then events) → BoardingPass (board) → departed → arrived.
6. **Irregular operations:** Disruption (publish) → Reaccommodation → Refund.
7. **Refunds and cancellations:** Booking cancel → refund evidence → Refund → Ticket voided or refunded.
8. **Service:** Passenger records; ServiceRequest (no command); ApprovedAgent channel.

## Coverage table

Generic list views (`/dashboard/<list>`) exist for every list, but they don't run the airline's commands.

| Workflow / list | Before | After |
|---|---|---|
| Launch setup and onboarding | `/dashboard/onboarding`, `/dashboard/operations` | unchanged |
| Storefront settings | `/dashboard/platform/store-settings` | unchanged |
| Airports and routes | **MISSING**: generic list only; airports can't be created at all | `/dashboard/platform/network` (`features/platform/network`) |
| Flight schedules (authoring, publish, suspend, retire) | **THIN**: the schedules desk only provisions from already-published patterns | `/dashboard/platform/network` (Schedules tab) |
| Cabins, fare brands, fare rules, ancillaries | **MISSING**: generic list only | `/dashboard/platform/fares` (`features/platform/fares`) |
| Dated flights and provisioning, open/close sales | `/dashboard/platform/schedules` | unchanged |
| Bucket authorization | `/dashboard/platform/inventory` | unchanged |
| Flight operations (gates, times, departed, arrived) | **MISSING**: no command existed | `/dashboard/platform/flight-ops` (`features/platform/flight-ops`, `updateFlightOperations`) |
| Offers | `/dashboard/platform/offers` | unchanged |
| Bookings: accept, evidence, capture, ticket, cancel, refund | `/dashboard/platform/bookings` | unchanged |
| Tickets and coupons | **THIN**: only a count on the booking detail | `/dashboard/platform/tickets` (`features/platform/tickets`) |
| Passengers | `/dashboard/platform/passengers` | unchanged |
| Departures: documents, check-in, bag acceptance, boarding, offload | `/dashboard/platform/departures` | unchanged |
| Station assignments | **MISSING**: generic list only, but every station command needs one | `/dashboard/platform/stations` (`features/platform/stations`) |
| Baggage tracking after acceptance | **MISSING**: no command or page | `/dashboard/platform/baggage` (`features/platform/baggage`, `recordBagEvent`) |
| Disruptions and reaccommodation | `/dashboard/platform/disruptions` | unchanged |
| Payments and the evidence queue | `/dashboard/platform/payments` | unchanged |
| Refunds | **THIN**: the alias pointed at payments, with no refund list | `/dashboard/platform/refunds` (`features/platform/refunds`) |
| Payment providers (evidence-only manual settlement) | **MISSING**: generic list; the activation rule needs hand-typed JSON | `/dashboard/platform/payment-providers` (`features/platform/payment-providers`) |
| Audit | `/dashboard/platform/manifests` | unchanged |
| Integrations and connections | `/dashboard/platform/settings` | unchanged |
| Users and roles | `/dashboard/users`, `/dashboard/roles` (shared shell) | unchanged |
| Service requests (SSR) | **MISSING** | **MISSING**: no command exists and the storefront can't request one. Left out of this pass (see the COVERAGE-READY note). |
| EMD / ancillary sales | **MISSING** | **MISSING**: no issuance command and no ancillary checkout |
| Exchanges | **MISSING** | **MISSING**: no exchange pricing or reissue command |
| Approved agents (agency channel) | generic list | generic list: no agency sign-in or sales flow in this release |

## Customer workflows (storefront)
| Workflow | Before | After |
|---|---|---|
| Browse where the airline flies | **MISSING** | `/destinations`: active routes, each linking to a prefilled search |
| Search → results → fare detail | search and results; fare showed a name only | results show cabin, fare description and included bags |
| Hold → book → confirmation | `/` (FlightShop) | unchanged |
| Pay online | none (pay the airline) | still none: owner decision QA-004 |
| Manage booking, seats, check-in, boarding pass | `/manage-booking`, `/check-in` | unchanged |
| Booking history | **MISSING** (no customer accounts) | "Your trips" on Manage booking, from bookings saved in this browser |
| Flight status | `/status` | now shows the gates and times operators set in flight ops |
