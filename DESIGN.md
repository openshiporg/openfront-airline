---
name: Openfront Airline
description: Two printed-world systems for one carrier platform; wayfinding signage for the ops desks, a pocket timetable for the traveller storefront.
colors:
  # Storefront: pocket timetable (features/storefront/styles/timetable.css)
  cover-brand: "#334155"
  cover-brand-hover: "#1e293b"
  cover-brand-soft: "#f1f5f9"
  timetable-stock: "#f6f7f5"
  stock-shade: "#ecedea"
  card-white: "#ffffff"
  graphite-ink: "#14171a"
  graphite-ink-2: "#3b4148"
  graphite-ink-3: "#636a72"
  keyline: "#d6d8d4"
  keyline-strong: "#b9bcb7"
  state-ok: "#17734b"
  state-warn: "#9a5b00"
  state-bad: "#b42318"
  state-idle: "#7b828a"
  # Platform desks: wayfinding signage (features/platform/components/desk.tsx)
  signage-yellow: "#f5c400"
  signage-yellow-edge: "#d9ad00"
  signage-yellow-hover: "#e6b800"
  signage-graphite: "#1f2328"
  shell-ground: "oklch(1 0 0)"
  shell-ink: "oklch(0.141 0.005 285.823)"
  shell-muted-ink: "oklch(0.552 0.016 285.938)"
  shell-hairline: "oklch(0.92 0.004 286.32)"
typography:
  cover-display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.75rem, 8vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 72"
  cover-headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 72"
  cover-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 72"
  storefront-body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\""
  storefront-label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0"
  desk-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  desk-section:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  desk-body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"tnum\""
  desk-plate:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
    fontFeature: "\"tnum\""
  desk-code:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.04em"
    fontFeature: "\"tnum\""
rounded:
  marker: "1px"
  day-cell: "2px"
  timetable: "3px"
  desk: "4px"
spacing:
  container-max: "76rem"
  gutter-sm: "1rem"
  gutter-md: "1.5rem"
  gutter-lg: "2.5rem"
  storefront-control: "2.75rem"
  desk-control: "2rem"
  desk-control-sm: "1.75rem"
components:
  storefront-button-primary:
    backgroundColor: "{colors.cover-brand}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.timetable}"
    padding: "0 1.125rem"
    height: "{spacing.storefront-control}"
  storefront-button-primary-hover:
    backgroundColor: "{colors.cover-brand-hover}"
  storefront-button:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.timetable}"
    padding: "0 1.125rem"
    height: "{spacing.storefront-control}"
  storefront-tab:
    textColor: "{colors.graphite-ink-3}"
    padding: "0 0.875rem"
    height: "2.5rem"
  storefront-tab-active:
    textColor: "{colors.graphite-ink}"
  storefront-input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.timetable}"
    padding: "0 0.75rem"
    height: "{spacing.storefront-control}"
  storefront-day-on:
    backgroundColor: "{colors.cover-brand}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.day-cell}"
    size: "1.375rem"
  desk-button-primary:
    backgroundColor: "{colors.signage-yellow}"
    textColor: "{colors.signage-graphite}"
    rounded: "{rounded.desk}"
    padding: "0 0.75rem"
    height: "{spacing.desk-control}"
  desk-button-primary-hover:
    backgroundColor: "{colors.signage-yellow-hover}"
  desk-button:
    backgroundColor: "{colors.shell-ground}"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.desk}"
    padding: "0 0.75rem"
    height: "{spacing.desk-control}"
  desk-input:
    backgroundColor: "{colors.shell-ground}"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.desk}"
    padding: "0 0.625rem"
    height: "{spacing.desk-control}"
  desk-plate:
    backgroundColor: "{colors.signage-graphite}"
    textColor: "{colors.card-white}"
    typography: "{typography.desk-plate}"
    rounded: "{rounded.timetable}"
    height: "1.375rem"
    width: "2.75rem"
  desk-plate-attention:
    backgroundColor: "{colors.signage-yellow}"
    textColor: "{colors.signage-graphite}"
---

# Design System: Openfront Airline

## Overview

**Creative North Star: "The Printed Airline"**

Openfront Airline is one carrier seen through two pieces of airline print. Staff work at **ops desks set like airport wayfinding signage** (Schiphol/Mijksenaar school): graphite ink on the shell's neutral ground, 1px hairlines, 4px corners at most, no shadows, airport and flight codes set as graphite signage plates, and signage yellow held back for the single action a screen exists for. Travellers meet **the carrier's pocket timetable**: a drenched cover printed in the carrier's own brand colour holding the working search, then cool white stock with graphite ink where the real schedule is set in timetable columns with day-of-operation grids.

Both worlds are flat, dense and ruled. Hierarchy comes from type weight, condensed width (storefront) and the placement of the one strong colour, never from lifted surfaces or tinted tiles. Both refuse their category defaults: the desks refuse stat-card rows over rounded record cards with pill button groups; the storefront refuses the wing-at-sunset hero over a floating rounded search card. Every table and figure uses tabular numerals.

The worlds share a grammar (underline tabs on a hairline, square state markers, square buttons, keylined units) but not a palette or a typeface. A new surface belongs to exactly one of them: anything under `/dashboard/platform/*` is a desk; anything a traveller sees is the timetable.

**Key Characteristics:**
- Flat everywhere: depth is a 1px keyline, never a shadow.
- One strong colour per world: signage yellow on the desks, the carrier brand colour on the storefront.
- Green, amber and red carry state only, as a small square marker or a tinted notice.
- Tabular figures for every time, fare, count and code.
- Underline tabs on a hairline for every view or mode switch; no pill or segmented-capsule tabs.
- Corners stop at 4px (desks) and 3px (storefront).

## Colors

Two restrained palettes: graphite and paper in both worlds, with a single committed accent each.

### Primary
- **Carrier Cover** (`cover-brand`, default Slate; per carrier from the brand palette: Slate, Blue, Indigo, Violet, Rose, Emerald, Amber): the storefront's cover band (home, page heads, footer), the primary button, the active underline on tabs and nav, the timetable group rule and hub code, on-days in the day grid, the boarding-pass head and the selected seat. It is set at runtime through `--storefront-brand`; never hard-code a carrier hex into a component.
- **Signage Yellow** (`signage-yellow`, with `signage-yellow-edge` border and `signage-yellow-hover`): the platform's one primary action per screen and the attention variant of a signage plate. Always paired with Signage Graphite text.

### Secondary
- **Signage Graphite** (`signage-graphite`): the fill of every airport/flight code plate on the desks, and the text colour on yellow.

### Neutral
- **Timetable Stock** (`timetable-stock`): storefront page ground for inside pages and below the cover.
- **Stock Shade** (`stock-shade`): storefront wells, taken seats, the hatched paid-seat pattern.
- **Card White** (`card-white`): storefront cards, tables, passes and fields; white type on the cover.
- **Graphite Ink** (`graphite-ink`, `graphite-ink-2`, `graphite-ink-3`): storefront primary text, secondary text, and field/column labels and quiet metadata.
- **Keyline** (`keyline`, `keyline-strong`): 1px storefront keylines on every unit; the strong step for field, button and pass borders and off-days.
- **Shell neutrals** (`shell-ground`, `shell-ink`, `shell-muted-ink`, `shell-hairline`): the desks borrow the dashboard shell's own tokens (background, foreground, muted-foreground, border) so they sit inside the untouched shell in light and dark mode.

### State
- **State Green / Amber / Red / Idle** (`state-ok`, `state-warn`, `state-bad`, `state-idle`): status markers, notice tints and destructive actions only. On the brand cover the markers lighten (ok `#7ee2b0`, warn `#ffd166`) so they hold contrast on colour. The desks use the shell's Tailwind emerald/amber/red/sky/zinc steps for the same roles.

### Named Rules
**The One Strong Colour Rule.** Each world has exactly one loud colour and it marks one thing: on a desk, signage yellow marks the single primary action (and an attention plate); on the storefront, the carrier colour is the cover and the commit action. A second yellow button on a desk screen is a bug.

**The State-Only Rule.** Green, amber and red appear only where a real lifecycle state is being shown, or on a destructive action in red. Never as decoration, category colour or section tint.

## Typography

**Storefront Font:** Archivo (variable, width axis), with ui-sans-serif, system-ui fallback
**Desk Font:** Geist (the dashboard shell's sans), with ui-sans-serif fallback

**Character:** The storefront uses one family as a printed timetable does: Archivo pulled to 72% width for bold condensed uppercase cover lettering, and at normal width for text. The desks stay in the shell's sans and earn their signage voice from plates and tabular figures rather than a display face.

### Hierarchy
- **Cover Display** (700, 3.75rem rising to 6rem, line-height 0.92, condensed, uppercase): homepage title and inside-page titles on the cover band.
- **Cover Headline** (700, 3rem, condensed, uppercase): section heads on stock ("Timetable") and the status/booking hero figure.
- **Cover Title** (700, 1.875rem, condensed, uppercase): "From [city]" timetable groups, cover service rail entries, wordmark, footer name.
- **Storefront Body** (400, 1rem, tabular): fields, rows and running text; cover description at 1.125rem in the softened board ink.
- **Storefront Label** (600, 0.75rem, sentence case, no tracking, Graphite Ink 3): field labels and timetable column heads.
- **Desk Title** (600, 1.25rem, tight tracking): one per desk, with count/meta beneath at 0.875rem in muted ink.
- **Desk Section** (600, 0.875rem): titled regions, with the count after it in muted 0.75rem tabular.
- **Desk Body** (400, 0.875rem, tabular): table rows, facts, notices.
- **Desk Plate / Code** (600 or 500, 12px, uppercase, 0.06em / 0.04em tracking, tabular): IATA codes, flight numbers, record locators. Uppercase tracking is reserved for identifiers.

### Named Rules
**The Identifier-Only Caps Rule.** Uppercase with tracking is how a sign sets a code: airport codes, flight numbers, locators. It is never used for a label, a column head or a line above a heading. Labels are sentence case, 0.75rem, untracked.

**The No-Kicker Rule.** A heading stands alone. No small line above a title naming its category, section or carrier; the title and its meta line carry the page.

**The Tabular Rule.** Every time, fare, count and code is set with tabular figures in both worlds. No monospace face stands in for this.

## Layout

**Desks.** Each desk opens on its work queue. First viewport order: desk title with count/meta and the primary action at right; underline tab bar for views; a filter row (fields ending in the action, ruled underneath, 1rem bottom padding); then the table or ruled row list. Summary figures sit in one inline strip between hairlines, separated by vertical hairlines, never as tiles. Sections are separated by spacing and a hairline under the section title (0.5rem below), not by cards. Rows: 0.75rem horizontal, 0.5rem vertical padding; facts lists on a two-column grid (label column 7rem to 40%). Controls are 2rem tall (1.75rem small). Actions on a row are text buttons; destructive in red.

**Storefront.** A centred container (max 76rem) with gutters of 1rem, 1.5rem at 640px and 2.5rem at 1024px. Home is a full-width cover band holding the title, the description, the search as a ruled white panel, and a three-column service rail divided by board hairlines; the timetable follows on stock in two columns from 1024px (2.5rem column gap, 2rem row gap). Inside pages are a cover band with the condensed title (2.5–3.5rem top padding) and then the work on stock. Results tables show their brand-colour header row from 768px; below that rows stack. Boarding passes add a 15rem stub column from 768px. Controls are 2.75rem tall for touch.

## Elevation & Depth

Both worlds are completely flat. Depth is conveyed by 1px keylines and tonal steps: stock to white card on the storefront, shell ground to muted wells on the desks. Selection is shown with a flat 3px brand-colour bar on the leading edge (`inset 3px 0 0`) plus the soft brand tint, and field focus with a 1px brand ring beside the brand border. These are rules drawn on the surface, not elevation.

### Named Rules
**The Keyline Rule.** Every unit (card, table, pass, notice, well, field) carries a 1px keyline. If a surface needs separating, add a rule, not a shadow.

## Shapes

Square-cut print. Storefront corners are 3px on every unit and control, 2px on day-of-operation cells and the carrier code tag, 1px on state markers; seats are 3px over 2px. Desk corners are 4px on buttons, fields, panels, notices and wells, 3px on signage plates, 1px on markers. Tabs have no corners: they are a 2px bottom border on a 1px track hairline. State markers are small squares (0.5rem storefront, 0.5rem / 0.375rem desk), never circles. The boarding pass is the one cut form: a dashed 1px perforation between body and stub.

## Components

### Buttons
Square, flat, labelled; the legacy component name "Pill" survives in code only.
- **Shape:** 3px storefront, 4px desk.
- **Primary (storefront):** carrier colour fill, white 600 text, 2.75rem tall, 0 1.125rem padding; hover darkens to the brand hover step.
- **Primary (desk):** signage yellow fill with yellow-edge border and graphite text, 2rem tall; hover to the darker yellow. One per screen.
- **Default:** white with a strong keyline (storefront; hover darkens the border to ink) or shell ground with a hairline (desk; hover to muted).
- **Plain (desk):** borderless muted text that fills muted on hover; used for row actions.
- **Danger:** white with a red-tinted border and red text; hover strengthens the border or tints red.
- **Focus:** 2px brand outline offset 2px (storefront); 2px shell ring (desk). Disabled drops to 45–50% opacity.

### Tabs (view and mode switches)
- **Style:** a row of text labels on a 1px hairline. Inactive in muted ink; hover to ink; active gets ink text and a 2px underline (brand colour on the storefront, foreground on the desks). Counts follow the label in muted 0.75rem tabular; an optional square state marker precedes it.
- **Toggle (desk, unlabelled-as-tab):** a pressed button inverts to foreground fill.

### Cards / Containers
- **Corner Style:** 3px storefront, 4px desk.
- **Background:** white on stock (storefront); shell ground (desk panel).
- **Shadow Strategy:** none; see Elevation & Depth.
- **Border:** 1px keyline; desk panels rule their rows with hairline dividers.
- **Internal Padding:** 1.25rem, 1.5rem from 640px (storefront cards); row-level 0.75rem / 0.5rem (desk).

### Inputs / Fields
- **Style:** storefront fields are 2.75rem, white, 3px, strong keyline, 1rem text; selects carry a drawn two-triangle caret. Desk fields are 2rem, shell ground, 4px, hairline, 0.875rem text. Labels sit above in the label style.
- **Focus:** storefront border and a 1px ring in the carrier colour; desk border to foreground with a soft ring.
- **Code fields:** uppercase, 0.08em tracking, 700 (booking reference).

### Navigation
- **Storefront header:** sticky white bar, 4rem tall, keyline below; carrier mark in a 2.25rem brand square, condensed wordmark, and the carrier code in a keylined 2px tag. Links are 0.9375rem 600 in Graphite Ink 2; current page gets ink and a 2px brand underline at the bar's base. Below 1024px a "Menu" button opens a keylined list where the current item gets a 3px brand leading bar.
- **Storefront footer:** a cover band again: wordmark, legal name and code, two-column link list in softened board ink.
- **Desks:** live inside the untouched dashboard shell and its sidebar; the desk adds only its underline tab bar.

### Signage Plate (signature, desk)
An airport or flight code in white 12px 600 uppercase tracked tabular type on a graphite plate, 1.375rem tall, min 2.75rem wide, 3px corners. A route is two plates joined by a 0.75rem hairline. The attention variant swaps to yellow on graphite for the active or flagged row.

### Readout Strip (desk)
Summary figures as label then tabular value on one line, set in a single strip between top and bottom hairlines with vertical hairlines between figures.

### Timetable Group (signature, storefront)
A "From [city]" condensed title with its code in the brand colour, over a 2px brand rule; then a ruled table of destination, flight, departs (bold), arrives, and days of operation as seven 1.375rem keylined cells, on-days filled brand colour; a route operating all seven days shows "Daily" in brand 700 instead.

### Boarding Pass (storefront)
A white keylined coupon with a brand-colour head strip, a dashed perforation, and a 15rem stub from 768px.

### Seat Map (storefront)
2.75rem keylined seats; selected fills brand colour with white type; taken seats are stock-shade with a strike-through; paid seats a diagonal hatch of stock and white.

### Status Marker and Notice
A square state marker sits on the first text line of a title or label. Notices are keylined, 3–4px, with a faint state tint and matching border and text; errors announce as alerts.

## Do's and Don'ts

### Do:
- **Do** open every desk on its work queue: title with count, primary action at right, underline tabs, filter row, then rows.
- **Do** set airport and flight codes on desks as graphite signage plates (`desk-plate`), with yellow-on-graphite only for the active or attention row.
- **Do** keep one signage-yellow action per desk screen and one carrier-colour commit action per storefront unit.
- **Do** carry the carrier colour through `--storefront-brand` so every carrier's storefront recolours without code changes.
- **Do** put a 1px keyline around every storefront unit and rule desk rows with hairlines.
- **Do** set every time, fare, count and code with tabular figures.
- **Do** use condensed Archivo uppercase only for cover and section titles on the storefront.

### Don't:
- **Don't** use pill or capsule tabs, chips, or corners above 4px (desks) and 3px (storefront).
- **Don't** add shadows for depth; the only inset is the 3px selection bar.
- **Don't** lay summary figures out as stat tiles or cards; use the readout strip.
- **Don't** colour anything green, amber or red that is not a state or a destructive action.
- **Don't** set labels, column heads or lines above headings in uppercase tracked type; caps with tracking belong to identifiers.
- **Don't** put a kicker or eyebrow line above a heading.
- **Don't** use a monospace face for figures or codes.
- **Don't** put signage yellow on the storefront or the carrier colour on the desks.
