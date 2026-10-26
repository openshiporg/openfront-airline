---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: []
---

# Surface: airline platform desks (`features/platform/**`, `/dashboard/platform/*`)

Mode: Operate. Audience: airline ops staff (network, inventory, reservations, payments, station, duty manager). Constraint: shared dashboard shell untouched; owner bans pill/rounded tabs, chips and cards (radius ≤6px, flat or underline tabs, dense tables).

## Direction contract

THESIS: Each desk opens on the work queue it exists for (today's departures, bookings awaiting payment, routes by state), set as a dense ruled table; it refuses the category default of stat-card rows over rounded record cards with pill button groups.

OWN-WORLD: Airport wayfinding signage (Schiphol/Mijksenaar school). Graphite ink on the shell's neutral ground, hairline 1px rules, radius 4px maximum, no shadows. Signage yellow (#f5c400 on graphite #1f2328) is reserved for the signature plate and the one primary action per screen; green/amber/red only carry state. Shell sans with tabular figures; no mono labels, no uppercase tracked eyebrows.

STORY: The operator sees the queue, its count and state at once, filters with underline tabs, acts from the row (text buttons with a separator, destructive in red), and opens the record.

FIRST VIEWPORT: Title with count and the one primary action at right; underline tab bar for views; filter row (search + state tabs with counts); then the table header and first rows above the fold. Summary figures sit inline in a single ruled strip, not tiles.

FORM: Candidate 3 of 7 (1 split-flap board, 2 pocket timetable, 3 wayfinding signage, 4 coupon stock, 5 flight strips, 6 aeronautical chart, 7 bag tag). Signature move: IATA codes and flight numbers set as graphite signage plates with yellow-on-graphite for the active/attention row. seed:7eea49ef67a60a38. Raises: design-annual plate section (declined) donates the 1px hairline grid discipline; ikeda datamatics (declined) donates tabular density.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
