# MerchMath — mobile app design

A phone app for apparel merchants who need to run merchant math on new
items and assess items already selling, without opening a spreadsheet.

Design source lives in `design/`: `build.mjs` generates one artboard
(`*.dc.html`) per screen plus `canvas.json`. Run `node build.mjs` from
that folder to regenerate after edits.

## Who it is for

Buyers, associate buyers and planners who price new styles and make
weekly reorder / hold / markdown calls. They know retail math cold; they
want the number fast, on a phone, in a vendor meeting or on the floor.

## Two jobs, two flows

**New item math** — price a style before it is bought.

1. Enter FOB cost; freight and duty default from Setup and can be
   overridden per item (duty by HTS code).
2. Landed cost is computed inline.
3. Enter ticket price (or flip "Solve for" to enter a target IMU and get
   the retail).
4. A live result strip pinned above the tab bar shows IMU and the delta
   to the class target. Tapping it opens the full math.
5. Full math: the IMU as the one big number, a cost/markup bar, a price
   ladder at three price points with IMU and the markup after a 30%
   promo, and a promo-depth gauge showing how deep a promo can go before
   the maintained markup breaks the floor set in Setup.
6. Save to Items or compare against another scenario.

**Assess an item** — decide what to do with a style already on the
floor.

1. Enter what was bought (units received, landed cost, original retail).
2. Enter how it is selling (weeks on floor, units sold, on hand, AUR).
3. Enter weeks remaining in the season (defaults from Setup).
4. Verdict screen: one of Reorder / Hold / Markdown with a one-line
   reason, six metrics (sell-through, rate of sale, weeks of supply,
   maintained markup, AUR vs ticket, GMROI), a week-by-week coverage
   strip (sold / on hand covers / uncovered), and a suggested reorder
   quantity when the verdict is Reorder.
5. Save the verdict or run a what-if markdown.

**Items** is the third tab: everything assessed, grouped by verdict and
filterable. The Assess and Verdict screens live under it. The Home
screen surfaces the items that need a decision and the most recent
math.

**Setup** holds target IMU by class, freight and duty defaults, the
promo IMU floor, season length, and the plain-language verdict rules.
**Formulas**, reached from the book icon on Setup, shows every
calculation the app uses so a merchant can trust the numbers.

## Verdict rules (defaults, editable in Setup)

| Verdict  | Condition                                              |
| -------- | ------------------------------------------------------ |
| Reorder  | Weeks of supply < weeks remaining and sell-through > 50% |
| Markdown | Weeks of supply exceeds weeks remaining by 2 or more   |
| Hold     | Everything else                                        |

## Formulas

| Metric                 | Formula                                                  |
| ---------------------- | -------------------------------------------------------- |
| Landed cost            | FOB + freight + duty                                     |
| IMU %                  | (Retail − Landed) ÷ Retail                               |
| Retail for target IMU  | Landed ÷ (1 − target IMU), rounded up to the next .50    |
| Markup after promo     | (Retail × (1 − off) − Landed) ÷ (Retail × (1 − off))     |
| Sell-through %         | Sold ÷ Received                                          |
| Rate of sale           | Sold ÷ Weeks on floor                                    |
| Weeks of supply        | On hand ÷ Rate of sale                                   |
| Maintained markup      | (AUR − Landed) ÷ AUR                                     |
| GMROI                  | Gross margin $ ÷ Average inventory at cost               |
| AUR vs ticket          | AUR ÷ Original retail                                    |
| Suggested reorder      | Uncovered weeks × rate of sale, rounded up to case pack  |

## Visual direction: paper ledger

- Warm paper ground (`#f6f3ee`), white cards, ink text (`#1b1a17`).
- One green accent (`#1f7a5c`) reserved for margin, positive deltas and
  go decisions. Amber for Hold, red for Markdown and below-target.
- Instrument Serif for screen titles and the single big number on a
  result screen. IBM Plex Sans with tabular figures everywhere else.
- Inputs are right-aligned numeric fields with a hairline underline;
  computed rows sit on the paper tint so entered and derived values
  read differently.
- Tab bar: Home, New item, Items, Setup.
- Hit targets are at least 44 px. No painted status bar or fake system
  keyboard (Alt B's in-app numeric pad is its own design element).

## Screens on the canvas

| Artboard            | Screen                    |
| ------------------- | ------------------------- |
| `Main.dc.html`      | Home                      |
| `NewItem.dc.html`   | New item · inputs         |
| `NewItemResult.dc.html` | New item · math       |
| `Assess.dc.html`    | Assess · inputs           |
| `Verdict.dc.html`   | Assess · verdict          |
| `Items.dc.html`     | Items                     |
| `Setup.dc.html`     | Setup                     |
| `Formulas.dc.html`  | Formulas                  |
| `AltLedger.dc.html` | Alternate A, low-fi: one dense ledger grid |
| `AltGuided.dc.html` | Alternate B, low-fi: one question at a time |

Sample values on the screens are illustrative. Duty rates, class targets
and the season calendar come from the merchant's own setup.
