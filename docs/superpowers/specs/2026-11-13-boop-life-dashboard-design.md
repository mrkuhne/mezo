# Boop as a life dashboard — mail digest, finances, and the areas as apps (design)

- **Status:** **approved by the owner 2026-11-13** (design and prototype; build order unchanged) ·
  **Date:** 2026-11-13 · **Issue:** `mezo-r36n9.33` · **Epic:** `mezo-r36n9`
- **Extends:** `2026-11-11-boop-standalone-design.md` (the spine, B0–B8). It does not supersede it:
  the B-slice order is unchanged by owner decision.
- **Evidence:** `docs/superpowers/research/boop-life/01-mail-digest-research.md` (feasibility, privacy,
  cost, prior art), `02-finance-tracker-map.md` (the owner's existing finance app, read-only map),
  `03-ui-direction.md` (the UI direction and the four prototype rounds).
- **Executable reference:** the Élet spike — `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Elet*.swift`,
  launch `-elet YES`; screenshots `elet-1-ma.png` … `elet-15-miert.png`.

## 1. Intent

Boop grows from a personal coach into the owner's **life dashboard**: calendar, mail, money and
health in one place, with one AI that sees all of it and keeps threads he can return to.

In his words: *"van egy főképernyő amin rajta van a teljes reggel napközben este görgethetően, ott
látsz mindent és valamilyen orb. de aztán ha valamelyik fő területre bemegyek akkor legyen annak
már egy saját dashboard oldala … mintha az egy full saját app lenne."*

## 2. Owner decisions (2026-11-13) — do not re-litigate

1. **The existing order stays.** B4 Étel, B5 Edzés+Watch, B6 A Terv keep their priority. The life
   dashboard is **planned now, built after B6** (`14-decisions.md` #9).
2. **Money and mail are rooms, not a fifth bottom-bar button** — the bar stays `Ma · Terv · Napló ·
   Boop` + `+`.
3. **Terv is the home of the areas** (`14-decisions.md` #11): the life goal plus one card per area,
   each opening that area's own page. The areas are the legs of the goal.
4. **An area is its own app**: painted head → its own top tabs with badges → a composed dashboard,
   never a list page.
5. **The morning briefing is long and premium**, with a glance into every area.
6. **Area names follow the spine vocabulary:** Alvás, Étel, Edzés, Energia, Forma, Pénz, Levél.
7. Never ask the owner for a password or token; he creates and enters every credential himself.
8. **Warm is the look** (#12): photo heads where a compliant mood photo exists (painted landscape as the
   fallback), the area's hue on key numbers and marked spans inside the text, photo thumbnails on rows that are
   *things*, and no card around the stats / curve / composition / row-list blocks.
9. **Ma is a living wall, not a timeline** (#13): what Boop wants to say right now, bounded — and the big 0–100
   score leaves the home screen.
10. **The wall has three weights** (#13, round 7): the check-in as a question card · one hero with a photo band ·
    the rest as compact rows inside a single card, the number in weight.

## 3. What the owner sees

### 3.1 Ma — the living wall

Open the app and it shows **what matters now**, not a plan to read. Hero: the painted/photographed sky, the orb
**without a number**, and one sentence. Then:

**`Most` — at most three cards**, plus the check-in pinned above them while it is due. Four kinds:

| Kind | Example |
|---|---|
| **Teendő** | "Itt a délutáni check-in · fél perc" · "Logold az ebédet" |
| **Történt** | "Megjött a reggeli posta · 2 érdekes" · "Spar · 8 240 Ft" |
| **Készülj** | "Másfél óra múlva edzés — egyél valamit 17:00 körül" |
| **Reakció** | *right after he logs lunch* → "46 g fehérje, jól állsz. Vacsorára 50 kell." |

Three weights so it reads as a wall, not a list: the **check-in** keeps its own tinted question shape; **one
hero** carries a photo band of the thing and 25 pt serif; **the rest are compact rows inside a single card** —
thumbnail, two lines, the number in weight on the right, the action as an inline link.

A card he acts on **settles into "Ma történt"** instead of vanishing. When nothing is live the wall says so
warmly — "Most nincs teendőd. Legközelebb 17:00-kor szólok." An empty wall is good news, not an empty state.

**Below the wall, folded into one row each:** `A reggeli összefoglaló · 08:10` and `A napod · 4 megvolt, 3
hátra` — open in the morning, closed later. The timeline is not dropped; without it the day loses its shape.

**Then `A nap energiája`** (a curve that looks forward, which a score does not) and **`Amit ma észrevettem`**,
the cross-area observations. The per-area levels are not on the home at all — Terv is their place.

### 3.2 Terv — the goal and the areas
The life goal in the head, then the areas **two per row**: a big orb with its number, a bell badge
with how much there is to look at, today's one-liner, and what the area contributes to the goal
with a progress bar.

### 3.3 An area page
Painted head (glyph, name, score + orb, verdict, sentence) · search and settings in the corner ·
**its own top tabs, each with its own badge** · then blocks from one shared kit:

| Block | Used for |
|---|---|
| highlight | the one thing worth reading today |
| stat tiles | 2–3 numbers, one lit, with trend |
| curve | a smooth auto-scaled curve, dashed target line, "now" marker |
| composition | one bar split into named parts with a legend |
| row list | glyph medallion · title + badge · sub · optional level bar · value |
| heat strip | a week or a day by hour |
| menu grid | 2-column "what else this area can do", with badges |
| ask row | opens a Boop thread already holding this area's data |

The page wears the **warm** treatment: a photo head where the world has a compliant mood photo, the hue on key
numbers and marked spans, photo thumbnails on rows that are things, and only the highlight and the menu grid
keep a card around them.

### 3.4 Pénz (the finance app, rebuilt)
Tabs **Ma · Keretek · Előzmények · Tervezett**. Month curve against the even-pace line, five-part
composition, the day's transactions (bank-message capture), budgets with their own bars, six-month
history with observations, planned items and what stays free.

### 3.5 Levél (the daily digest)
Tabs **Ma · Figyelt · Szabályok · Fiókok**. Arrival heat strip, the two items worth a minute as
rich cards (1–10 score, a coloured price verdict, one line of goal relevance), the 31 handled ones
grouped, watched products with their price history, and a Szabályok tab that states in plain words
what never reaches a machine.

## 4. How it works

### 4.1 Mail intake
- **Gmail and iCloud over IMAP with an app-specific password** the owner creates and enters.
  Not OAuth: `gmail.readonly` is a **restricted scope**, so a Testing-mode app gets refresh tokens
  that **expire in 7 days**, and Production needs verification plus a CASA assessment (~$500–900,
  4–6 weeks, repeated annually) — absurd for an app with one user. Research §1.
  **Open question for the owner:** if his Gmail is on a Workspace domain he controls, an *Internal*
  OAuth client avoids both the 7-day expiry and CASA; worth one question before building.
- iCloud: `imap.mail.me.com:993`. **Trap:** changing the Apple Account password revokes all
  app-specific passwords at once, so the digest dies silently — the health check below covers it.
- **Blast-radius control:** prefer a *forwarded mirror mailbox* that both accounts auto-forward
  into, so the stored credential never opens the real inbox (prior art: MailDigest).
- Scheduling: a plain Spring `@Scheduled` cron at **08:00** and **15:00** in the owner's timezone.
  No Pub/Sub push — for one user it adds a topic, an IAM grant, a public endpoint and a 7-day watch
  renewal to save two polls a day. Idempotency on `(mailbox, uidvalidity, uid)` plus a content hash.
- **Health alert** when a run returns zero mails twice in a row (revoked password, IMAP disabled).

### 4.2 Redaction — before a single token is spent
1. Prefer `text/plain`; otherwise sanitize `text/html` (strip style, script, head, all attributes).
2. Drop every image; replace links with their anchor text plus the **bare host** — this kills the
   per-recipient tracking tokens *and* is the single biggest cost lever (**~25 000 raw tokens per
   promo mail vs ~600 stripped, a 30–40× cut**).
3. Mask e-mail addresses, long digit runs, IBAN- and card-shaped strings, order/booking references.
4. A **sender deny list** in Postgres: bank, insurer, government, health, and anything that looks
   like a login code never reaches a model at all — they are surfaced by rule, counted only.
5. The raw message stays in our own Postgres; only the redacted projection leaves it.
6. Message bodies are **attacker-controlled text**: delimited as data, the reading model gets no
   write or send tools, URLs it emits are never followed, and a second cheap pass screens for
   phishing and injection.

### 4.3 The three passes, and what they cost
1. **Classify + summarise** every mail on the cheap tier, behind deterministic sender/keyword rules
   so most mail never reaches a model (prior art: SummerMail's rules-then-LLM funnel).
2. **Relate to goals** — one call over the candidates plus the goal/plan context (cacheable).
3. **Market check** — web search, **capped and deduped**: only items above a price threshold, with
   the result cached per product for 7–14 days.

Realistic cost: **≈ €3/month** at 10 price checks a day, **≈ €1.2/month** at 3. The flat web-search
tool fee is 85–90% of it, not the model. This is not a cost-constrained feature.

### 4.4 The price verdict — and its honest limit
There is **no usable European price-history source at this budget**: Keepa's API starts at €49/month
(Amazon only), Google's Content API for Shopping was sunset 2026-08-18 and its Merchant API
replacement is a merchant-side feed API, and Árukereső has no public buyer-side API. So the verdict
is three-level and says so out loud:

- **Olcsóbb máshol** — found cheaper today at a named shop (high confidence),
- **A szokásos ára** — comparable listings at a similar price, so the "akció" is not special,
- **Nem tudom ellenőrizni** — no comparable listing found.

And: **we record every price we ever see** into our own Postgres, keyed by normalised product name
and retailer. After a few months Boop owns a private price history for exactly the products he is
marketed — worth more to him than Keepa's catalogue.

### 4.5 Finances
The owner's existing app (`02-finance-tracker-map.md`) is 12 days old, lives in Base44, and is
**practically empty** — no complete tracked month, no investments. **So this is a rebuild, not a
migration.** What is worth porting, in order:

1. the **allowance engine** (weekly/monthly budget, month-portioning, "never rewrite the past"
   recurring totals, deficit carry-over, month close),
2. the **bank-SMS capture** (iOS Shortcut → backend, LLM parse behind a money regex, hash dedupe),
3. the **amount guard** — a forint-amount parser that downgrades any AI text naming more money than
   the budget allows,
4. the hand-curated **investment catalog** with split rules and bond accrual.

Not portable: Base44 RLS, `auth.me/updateMe` as the settings store, `InvokeLLM`, its workflows and
hosting. Free externals that carry over: frankfurter.dev (FX) and the Yahoo chart endpoint (quotes).
Note the ninth v1 goal of that app — a conversational assistant — **was never built**; in Boop it
comes free with the Boop tab.

## 5. The slices

Numbered after the existing map. **Earliest start: after B6 ships** (owner decision). `L0` and `L0/b` are the
exceptions: they change navigation and the home that B4/B5 build on, so they should land as soon as B5 is done.
`L0/b` has no new data — every card kind it needs already exists or comes from B3.

| Slice | What | Depends on |
|---|---|---|
| **L0** Területek otthona | Terv becomes the areas home (goal + two-up area grid with big orbs and derived badges); the **shared area-page kit** (stat tiles, curve, composition, row list, heat strip, menu grid, badges) in `BoopDesign`; Étel and Edzés move onto it. No new data. | B5 |
| **L0/b** Ma · az élő fal | Ma becomes the living wall: the feed engine (what to say now, ranked, capped at three + the pinned check-in), the four card kinds, the settle-into-"Ma történt" behaviour, the honest empty state, the folded briefing and timeline, the day's energy curve and the cross-area notices; the score leaves the home. **Amends the shipped B2 Ma.** | B3 (it needs the check-in and the day ledger) |
| **L1** Levél · alap | Mailbox settings screen (the owner enters his own app passwords), IMAP intake for Gmail + iCloud, raw storage, the **redaction pipeline**, sender deny list, idempotency, the 08:00 + 15:00 schedule, the zero-mail health alert. **No AI yet** — the Levél room shows counts and categories only. | B6, L0 |
| **L2** Levél · összefoglaló | The rules-then-LLM funnel, the goal-relevance pass, the 1–10 score, the Levél room (Ma · Szabályok · Fiókok) and its card on Ma and Terv. Per-day cost cap and the adversarial/phishing pass. | L1 |
| **L3** Levél · figyelt termékek | Watched products, the capped and cached market check, the three-level verdict, **our own price log**, the Figyelt tab with price history, and the proposal card when something is genuinely cheap. | L2 |
| **L4** Pénz · adatalap | Accounts, categories, transactions, budgets, recurring items; the **allowance engine** and month close; the **bank-SMS capture** with its key and Shortcut contract; the **amount guard**. Backend + data only. | B6, L0 |
| **L5** Pénz · a szoba | The Pénz room (Ma · Keretek · Előzmények · Tervezett): month curve against the even-pace line, composition, transactions, budgets, six-month history, planned items; its card on Ma and Terv; manual capture in `+`. | L4 |
| **L6** Az egy AI látja a pénzt és a levelet | Money and mail facts enter the memory corpus with the same day-scoping as a check-in; they become contributors in "miért?"; the Boop tab becomes a **thread list** with a "kérdezd meg Boopot" door on every card and area. | L3, L5, B8 |

### What B8 must allow for, even though it ships first
1. **Area contributors are an open set**, not a fixed five-expert list. The "miért?" renderer keeps
   taking `(area, line)` pairs.
2. **The memory corpus must admit non-biometric daily facts** (a cost, a mail verdict) through the
   same ingestion path as a check-in.
3. **Areas are a list, not five hard-coded slots.**

## 6. Privacy

- No personal health value, no real financial figure and no real mail content ever goes into a
  commit, a doc, a prototype or Notion. Every example here is invented.
- The owner creates every credential himself; Boop never asks for or stores a password.
- OpenAI API traffic is retained ≤30 days for abuse monitoring and is **not** used for training by
  default; ZDR needs an enterprise agreement and is unobtainable for a personal app. The real
  control is §4.2 redaction, not the contract.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Price-check credibility | The three-level verdict says "nem tudom ellenőrizni" out loud; our own price log builds real history over months. |
| Prompt injection from promo mail | Bodies delimited as data, no write/send tools on the reading model, URLs never followed, a second adversarial pass. |
| Credential blast radius and silent death | A forwarded mirror mailbox as the read target; a health alert on two empty runs. |
| Scope creep against the health roadmap | Hard gate: nothing here starts before B6 ships, except L0. |
| An eighth area | The home shows loud areas as cards and collapses the calm ones; Terv's grid scrolls. The pattern survives growth; a fixed orb strip did not. |

## 8. Open questions for the owner

1. Is his Gmail a consumer account or on a **Workspace domain he controls**? (The latter unlocks a
   cleaner, permanent connection.)
2. Does he accept a **forwarded mirror mailbox**, or must Boop read the real inboxes?
3. Should a high-scoring mail item **notify** (push), or only ever appear in Ma? Prior art says the
   notification policy decides whether a digest gets read at all.
4. **Price-check budget:** 3 checks a day (~€1.2/month) or 10 (~€3.2/month)?
5. One life goal at a time, or several with shared areas?
