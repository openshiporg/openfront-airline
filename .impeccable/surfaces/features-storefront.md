---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: ["app/page.tsx"]
---

# Surface: airline storefront (`features/storefront/**`, public `app/*` routes)

Mode: Persuade (home) and Operate (status, check-in, manage booking). Audience: travellers booking a short-haul trip direct; returning travellers servicing a booking on a phone. Keep every route, state and workflow.

## Direction contract

THESIS: The carrier's site is its pocket timetable: a drenched cover in the carrier's own colour holding the working search, and the real schedule set in timetable columns underneath; it refuses the wing-at-sunset hero over a floating rounded search card.

OWN-WORLD: Cover stock in the carrier brand colour (--storefront-brand) at full strength; inside pages on cool white stock (#f6f7f5) with graphite ink (#14171a); 1px keylines on every unit; corners 3px; Archivo across display (condensed width) and text, tabular figures for times and fares; no mono, no eyebrows. Status green/amber/red only on state.

STORY: The traveller knows who flies where in one look, searches from the cover, sees fares as timetable rows, picks a fare, pays the airline directly; returning travellers reach status, check-in and manage booking from the cover's service rail.

FIRST VIEWPORT: Full-width brand-colour cover: carrier name and homepage title in condensed caps at left, the search form as a ruled white panel (underline tabs One way / Round trip, square fields, one solid action). Below the fold edge, the timetable begins: "From JFK" groups with route, flight, departs, arrives, days of operation 1–7.

FORM: Candidate 3 of 7 (1 ticket coupon, 2 in-flight route map, 3 pocket timetable, 4 bag tag, 5 travel poster, 6 safety card, 7 wayfinding). seed:b49b62030dca8213. Raises: Breton ornament program (declined) donates a keyline around every unit; wall-calendar pad (declined) donates the small, even date grid used for days of operation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
