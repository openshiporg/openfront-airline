# Airline: design ready (2026-10-25)

Brief: `~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`. The owner ordered the work directly, so impeccable's interview steps ran unattended. Every product fact in `PRODUCT.md` is inferred from the repository and labelled as inferred.

## Commits

- `b137104` (pushed): Redesign platform desks and storefront from the operator's and traveler's main tasks.
- **Deploy:** the first two deploys failed at `prisma migrate deploy` with "FATAL: sorry, too many clients already". The old deployment had used up all 100 Postgres connections.
  - Fix: restarted the running app service, which brought it down to 9 connections, then redeployed the same build (`ba2f341e`). That deploy is live.
  - No env vars, schema or data were changed.

## Gates

| Gate | Result |
|---|---|
| `tsc --noEmit` (heavy-exec, real; a probe error was caught first to prove the run is real) | exit 0 |
| `npm test` | 20/20 pass |
| `node --test tests/family-security.test.cjs tests/shared-dashboard.test.cjs` | 22/22 pass |
| Parity check | drift 0, missing 0, sidebar ok |

## Directions (impeccable `concept-seed`)

- **Platform (Operate):** airport wayfinding signage, candidate 3 of 7, `seed:7eea49ef67a60a38`.
- **Storefront (Persuade):** the carrier's pocket timetable, candidate 3 of 7, `seed:b49b62030dca8213`.
- The contracts are in `.impeccable/surfaces/`.

## Skills used, per screen

| Skill | Screen(s) | What it changed |
|---|---|---|
| impeccable (`init`, `concept-seed`, craft-floor, mode rules) | All | `PRODUCT.md`, the contracts, and these bans: eyebrows, mono costume, glow dots, pill tracks. |
| industrial-brutalist-ui (Swiss print grid) | Platform desk kit | Hairline grids, square corners, ruled readout strip, ruled tables. |
| minimalist-ui | Buttons and fields | Square keylined buttons and flat fields. Its pill badges were rejected because of the owner's ban. |
| design-taste-frontend / gpt-taste | Home, inside pages | Meta-labels removed (STS/CHK/MNG codes and eyebrows); the hero title is at most two lines. |
| hallmark / frontend-design | Storefront | Pocket-timetable world, Archivo as the only face, one-ink cover plate. |
| emil-design-eng | Kit, seat map | Colour-only transitions; no translate or scale on press. |
| high-end-visual-design | — | Consulted and rejected: its pill CTAs and eyebrow badges conflict with the owner's ban. |

## What changed

**Platform.** The desk kit in `features/platform/components/desk.tsx` was rebuilt, and every airline desk inherits it:
- Pill tracks became underline tab bars; toggles are square pressed buttons.
- Buttons are square with 4px corners. Signage yellow is used for the primary action.
- IATA codes are graphite signage plates.
- State is a square marker.
- Readouts sit in one ruled strip.
- Empty states are a ruled line of text.
- Filter bars are a ruled row.

Per-screen changes:
- **Carrier operations** opens on:
  - the next 8 departures as a table (local time, flight, route plates, arrival, gate, seats sold/capacity, status);
  - a "Needs action" queue list (payments awaiting approval, unpaid bookings, open disruptions, delayed flights, mishandled bags), each read separately so a denied queue drops out;
  - the desks grouped Plan / Sell / Fly / Settle / Administer.
- **Bookings** is a ruled table (locator, travelers, itinerary, state, total). Payment, ticketing, access and cancel commands open under each row, from a row action labelled by the next step (Take payment / Issue ticket / Service).
- **Network and fares:** row lifecycle actions are hairline-separated text actions, with destructive ones in red.

A sweep across 37 platform files removed mono numerals, tracked caps and rounded-xl/full containers. Onboarding files were not touched.

**Storefront.**
- The cover is in the carrier's own brand colour and holds the working search.
- A one-ink cover plate: an Unsplash photo (`photo-1500835556837-99ac94a94552`, Unsplash License) printed in the carrier colour with CSS.
- Underline trip-type tabs and square fields.
- The service rail (status, check-in, manage) sits on the cover.
- The live **timetable** prints below: every route grouped by origin, with flight number, local departure and arrival from the next flight on sale, and days of operation derived from the dates actually on sale.
- **Destinations** prints the same timetable.
- Page heads are cover bands without eyebrows.
- The nav is an underline bar.
- Flight results are a white timetable table with a brand header row.
- The boarding pass, seat map and notices are square and keylined.
- Barlow Condensed, Hanken Grotesk and IBM Plex Mono were replaced by Archivo, using its width axis for the condensed caps.
- The stylesheet was renamed to `timetable.css` to force a fresh compile.

## Screenshots

- `before/` and `after/`: desktop 1440 and phone 390 for all 7 storefront routes, Carrier operations and all 24 platform list pages.
- The after shots were taken with WebKit, because Playwright Chromium HTTPS hung on this machine.

## Open

- No `impeccable-finish-reviewer` pass was run yet, and DESIGN.md has not been generated.
- The meta line shows "Launch Setup In Progress" because of a capitalize class on the onboarding status. This is cosmetic.

## Finish review (impeccable-finish-reviewer, fresh context)

- **Round 1 — fix (8 items), addressed in `94155cc`:**
  - Removed the wing photo plate, which contradicted the contract.
  - Square selects.
  - The timetable prints "Daily" and leads with the hub.
  - Yellow is limited to one action per screen, and the summary is an inline strip.
  - Flight lists are one ruled table.
  - Station duties are written as text.
  - Departures opens on the next operating day.
  - Raw enum values are replaced with product language.
- **Verdict pass — 4 resolved, 4 partial, 3 regressions. Round 2 in `7c10b6b`:**
  - Inventory uses a narrower grid, fixing the overflow and the empty seats column.
  - Stations shows aligned columns.
  - Disruptions keeps a single yellow action.
  - Operations on phones keeps Status.
  - Departures explains why it is empty: manifests are station-scoped, and the demo admin has no station assignment.
- **The two-round budget is spent. Still open:**
  - The Provision dated flight form remains at the bottom of Schedules.
  - The demo needs a station assignment for Departures to list flights. That is a seed change, which the brief forbids.
- **DESIGN.md and .impeccable/design.json:** `93d185f`.
