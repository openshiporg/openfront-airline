# Product

<!-- impeccable:product-schema 1 -->

> Inferred on 2026-10-25 from the README, routes, onboarding seed and the owner's redesign brief (`~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`). The owner ordered the work without an interview round; every fact below is read from the repository, not confirmed in conversation.

## Platform

web

## Users

- **Airline operations staff** (inferred): network planners, revenue/inventory controllers, reservations and payments agents, station and gate agents, and duty managers handling disruption. They work at desks and gates through a long shift, often with several flights in play at once.
- **Travellers** (inferred): people booking a short-haul trip directly with a small carrier, then checking status, checking in and managing the booking from a phone.

## Product Purpose

Openfront Airline is a self-hostable airline retailing and passenger-service application. Travellers search flights, book, pay the airline directly, check flight status, check in and manage bookings. Airline teams manage the network (airports, routes, schedules), dated flights and inventory, fares and ancillaries, offers, bookings, tickets, passengers, departures and manifests, baggage, payments and refunds, and disruption recovery.

## Positioning

A carrier-owned, open-source passenger service system: the carrier's own direct channel and its operations desks in one codebase, with no GDS or third-party PSS in between.

## Operating Context

- Demo carrier: **Avante Air (AV)**, Avante Air LLC, hub New York JFK, nonstop to Boston, Chicago, Miami and Los Angeles; eight routes, daily flights for two weeks. Seeded by the dashboard onboarding "Full demo network".
- Times are stored in UTC and shown per airport; service dates and record locators are the operator's primary keys.
- Payments are recorded by the operator (bank transfer, receipt reference) with maker/checker settlement approval.

## Capabilities and Constraints

- Shared dashboard shell (`features/dashboard/**`, `proxy.ts`, non-platform `app/dashboard/**`) must stay byte-identical to Openfront E-commerce.
- Platform pages live in `features/platform/**` under `/dashboard/platform/*`; the storefront lives in `features/storefront/**` and the public `app/*` routes.
- No new environment variables. Onboarding and seed files are not changed by design work.

## Brand Commitments

- The carrier's own name, code and brand colour (`--storefront-brand`) come from carrier settings; the storefront must render any carrier, not only Avante Air.

## Evidence on Hand

- No real photography, testimonials, press or traffic statistics are in the repo. Do not invent fares, routes, on-time performance or reviews; render only what the carrier data provides.

## Product Principles

1. The operator's next action on a flight or booking is visible within the first screen.
2. Times, codes and money are exact and scannable: tabular, aligned, never decorative.
3. The traveller's direct channel is honest about what it is: reservation, pay the airline directly, hold expiry.
