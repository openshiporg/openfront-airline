# Airline redesign: direction (2026-10-23)

## Storefront: "Departure board"
- **Type:** Barlow Condensed for display (airport wayfinding signage), Hanken Grotesk for body, IBM Plex Mono for readouts (locators, flight numbers, times, money). Loaded in `features/storefront/lib/fonts.ts`.
- **Palette** (`features/storefront/styles/airline.css`, scoped to `.af`): warm ticket-stock paper, night-navy ink, a dark board band (`.af-board`) for the hero, flight results and flight status, and board-yellow `--af-signal` for flight numbers and gates. The only accent is the carrier's Storefront Settings colour (`--storefront-brand`).
- **Logo:** Untitled UI registry mark "45 Degrees" (`CarrierMark`), drawn in the brand colour.
- **Signature:** the boarding pass (`.af-pass`): body, a perforated tear line, and a stub. It's used for the traveller form + fare summary, the reservation confirmation, and the issued boarding pass.
- **Rules:** in-page buttons are `.af-pill` inside `.af-track` (`.af-pill-primary` for the main action, `.af-pill-raised` for secondary actions and for the selected one); status dots are `.af-dot[data-tone]` inside `.af-title-line`; copy is labels, states and errors only; phone first.

## Platform: "Ops desk"
- Kit: `features/platform/components/desk.tsx`, on the dashboard tokens (light and dark). It extends the Batch 2 desk kit with `statusTone`, `StatusLabel`, `Route`, `Well`, `FilterBar`, `Field`, `deskInput` and `RowLink`.
- Worklists are Panels of row links with the status dot on the title line. Denied, stale and inconsistent reads are short Notices that link back to the first page.
- `features/dashboard/**` and `PageContainer` are unchanged.
