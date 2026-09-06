# Proactive Coaching Observer — Design

**Date:** 2026-09-05 · **Status:** approved in brainstorm, pending spec review
**Epic:** `mezo-6269` (slices `mezo-6269.1` … `mezo-6269.3`)
**Builds on:** `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` (epic `mezo-d58h`, closed 2026-09-05)

**Driving request (user, 2026-09-05):** *"szeretnék a Mezora egy új csempét, a neve Proaktív
Coaching. itt szeretném ha lenne egy Megfigyelő csempe … az összes észlelést figyeljük itt …
ez csak annyira kell, hogy érdekesség képpen tudjuk nézni, miből jön majd ki a napi kártya és
mi az app döntési folyamata. lássuk a súlyossági értékelést, minden releváns pontot ami alapján
választani fog."*

## 0. The gap this closes

Round 1 shipped an engine that evaluates 13 rules hourly, ranks every raise by severity, and
delivers exactly one card per day. The user sees **only the winner**. Everything that made the
decision — the twelve rules that lost, the ones that checked out fine, the ones that could not
be evaluated at all, and the ranking itself — is invisible.

Worse, most of it is not merely unexposed but **structurally unrecorded**:

- `FlagEvaluator.evaluate` returns `List<FlagRaise>` — only the rules that fired. A rule
  returning `Optional.empty()` leaves no trace anywhere.
- `FlagService.evaluateAndLog` drops cooldown-suppressed raises **before** persisting.
- `CompanionFlagLogEntity`'s own javadoc: *"the evaluator writes a row only when a flag actually
  RAISES (cooldown-gated), never on a quiet evaluation."*

So this is not a read-side feature over existing data. Making the decision process visible
requires the engine to **say what it decided** — which is the bulk of the work.

**Scope boundary (hard):** this surface never recomputes anything. It renders what the engine
concluded, the same way today's card copy is rendered from each rule's own frozen payload. No
coaching logic moves to the read side or to the frontend.

## 1. What the user gets

A new wide tile on the Mező hub → a Coaching hub page → two surfaces:

1. **Megfigyelő** — all 13 rules for a chosen day, in severity order, each showing its verdict
   and the evidence behind it; plus the day's state transitions ("14:00 — Terhelés–táplálás:
   Rendben → Jelzett"); plus day-by-day back-navigation.
2. **A napi kártya** — the winning card, *why* it won against the runners-up, and the ability to
   respond (the existing actions).

Built so round-2 rules (`mezo-d58h.7`) appear without a frontend change. See §5.

## 2. Prior art

Researcher recon, 2026-09-05. Four sources; one line of search (generic observability consoles)
was dropped as too low-quality to cite.

**Adopted:**

- **Oura Readiness contributors** ([support](https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score),
  [blog](https://ouraring.com/blog/readiness-score/)) — every contributor is rendered at equal
  visual weight with its own small graphic and a short "why" sentence, **including the ones that
  are fine**, rather than a "problems" list. This is the model for showing all 13 rules rather
  than only the ones that fired.
- **Garmin Training Readiness factors** ([overview](https://www.garmin.com/en-US/garmin-technology/running-science/physiological-measurements/training-readiness/),
  [manual](https://www8.garmin.com/manuals/webhelp/GUID-0221611A-992D-495E-8DED-1DD448F7A066/EN-US/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html))
  — named factors, each with a tri-state colour chip, **ordered by contribution rather than
  alphabetically**, so the ranking that produced the verdict is itself visible. This is the model
  for our severity-ordered list: the order *is* information.
- **Per-item "why am I seeing this" panels** ([TechPolicy.Press menu of options](https://www.techpolicy.press/a-menu-of-recommender-transparency-options/))
  — plain-language, item-scoped explanations grounded in the actual signals used. Both documented
  failure modes are relevant to us: explanations too generic to build trust, and raw signal dumps
  that make users disengage.
- **Alerting practice: log everything, rank, page once** ([alert fatigue](https://runframe.io/blog/how-to-reduce-alert-fatigue),
  [Netdata](https://www.netdata.cloud/academy/what-is-alert-fatigue-and-how-to-prevent-it/)) —
  confirms the engine's "evaluate many, surface one, keep the full evaluation set for audit" shape
  is standard practice, and that an alert must answer *what should I do next*, not just name a
  signal. That framing maps onto the card-detail page: evidence → action.

**Rejected:**

- **Garmin's list layout** — the factor semantics transfer, the settings-style list does not.
  Re-skinned as poster tiles per design 2.0.
- **The alerting-console aesthetic** — severity badges, timestamps, rule IDs. Reads as an ops
  dashboard; violates the fixed visual language.
- **Facebook's transparency panels as a quality bar** — widely criticised as post-hoc and
  unconvincing. The lesson taken is the opposite: ground every line in the same computed inputs
  the engine used.

**Notable gap:** an [arXiv survey of recommender transparency](https://arxiv.org/html/2504.11000)
notes that users want to know what was *suppressed* and why, and that existing consumer products
largely do not expose this. Showing the twelve losers is therefore not a pattern we can copy —
it is the part we are consciously filling.

## 3. Codebase terrain

Investigator recon, 2026-09-05. CODEMAP-first, read-only. No staleness found — the proactive,
companion and insights docs match the code inspected, including the "silent rule leaves no
trace" behaviour, which the docs state explicitly.

**Affected features:** `companion` (the engine — `backend/.../feature/companion/flags`),
`proactive` (the card — `backend/.../feature/proactive`), `insights` (the **Mező** tab —
`frontend/src/features/insights`, route `/mezo`). Note: "Mező" is the `insights` feature, *not*
`today`/`nap`.

**Key files and anchors**

- `FlagEvaluator.java:61-83` — runs 13 rules in fixed order, returns only `FlagRaise`s.
- `FlagService.java:38-59` — `evaluateAndLog`; drops cooldown-suppressed raises before persisting.
- `CompanionFlagLogEntity.java:19-23` — append-only, raises only, never quiet evaluations.
- `FlagPayloadEnvelope.java:6-13` — one nested record per `FlagKey`, each carrying **both its
  thresholds and its observed values** ("the raise is reproducible from the log alone").
- `CompanionFlagLogRepository` — `findByCreatedByAndDeletedFalseOrderByCreatedAtDesc` exists but
  **no controller reads this repository**; all four consumers are internal backend services.
- `AdvicePriority.java` — `ORDER` + `outranks`, the editorial severity ranking.
- `api/feature/proactive/proactive.yml:493-520` — `FeedMessageResponse` carries `kind`, `facts[]`,
  `suggestions[]`, `actions[]`, `applied` — but **no `flagKey`**.
- `frontend/src/features/insights/pages/MezoHubPage.tsx` — the `/mezo` hub; the new tile goes in
  the same `<Mosaic>` as the wide `Karakter`/`Diagnózis` tiles, not outside it.
- `frontend/src/app/router.tsx:261-291` — flat `/mezo/*` registrations (`mezo/diagnozis`,
  `mezo/diagnozis/:id`) — the idiom the new routes follow.
- `DiagnosisListPage.tsx` / `DiagnosisDetailPage.tsx` — **the closest existing model**: ranked
  report list, rank-badged cards (`mzp-rankb`), strength chips (`mzp-stch`), evidence rows
  (`mzp-evrow`) resolved through indexes with provenance.
- `PatternsPage.tsx` + `logic/lifecycle.ts` (`bucketize`, `BUCKET_ORDER`) — **the extensibility
  precedent**: a fixed-order taxonomy driven entirely by data shape, no per-item markup.
- `frontend/src/data/today/adviceHooks.ts` — `useAdviceActions`, `ACTION_INVALIDATES`, `failedId`.
- `frontend/src/features/today/pages/NapMezoPage.tsx:224-283` — the reference advice-card render,
  including server-driven `applied` state (never disabled-button faking).
- Kit: `shared/ui/mozaik/index.tsx` (`Tile`, `Mosaic`, `MozaikPage`, `PageHead`, `PageHero`,
  `PageBody`, `StatStrip`/`StatCell`, `CollapsibleStrip`), `mozaik/motion.tsx` (`EntranceGroup`,
  `useCountUp`), `shared/ui/clay` (`ClayIcon`, `ClaySpot` — never emoji), tokens in
  `styles/prototype.css` (`--mz-*`). Prototype source: `docs/design_2.0/prototypes/src/mezo-body.html`
  (`#page-diagnozis`, `#page-diagnozis-reszlet`).
- `MezoMessagesSheet.tsx` — confirmed dead (bd `mezo-1esk`): zero real importers, only its own
  test exercises it. Not a dependency here.

**Traps**

- **ArchUnit layering.** A controller in `feature.proactive` reading `CompanionFlagLogRepository`
  crosses a feature boundary. The trace read surface lives in `feature.companion.flags`.
- **Contract drift** is CI-gated: any OpenAPI fragment change must be regenerated and merged.
- **CODEMAP freshness** (`node scripts/gen-codemap.mjs --check`) must be regenerated in the same
  change; focused ITs miss both this and ArchUnit.
- **Testcontainers** required for any IT touching this persistence
  (`-Dmezo.test.use-testcontainers=true`); the fixed-DB mode races.
- **`VITE_USE_MOCK` unset means mock** — a bare `pnpm test` runs mock twice and the real-mode gate
  is vacuous.
- **Honest states are a documented bug class** (mezo-yew/mezo-0xl): four-way split — loading,
  real error, degraded/404, genuinely empty. Never render a fabricated zero during an unresolved
  fetch.
- **Mock mode must render fully**, and the companion feed mock is currently always `[]` — this
  feature needs its own deterministic mock day or the pages are empty in development and in the
  visual job.
- **Visual baselines**: two new pages need goldens, and adding a tile perturbs `MezoHubPage`'s
  existing golden.
- **Hungarian copy**, reusing the established idioms from `PatternsPage`/`DiagnosisListPage` for
  empty/degraded states rather than inventing new phrasings.
- `Karakter`/`Diagnózis` have a **deliberate** DOM-order-vs-stagger-order mismatch — do not
  "fix" it when inserting a neighbouring tile.

## 4. The engine tells us what it decided (S1)

### 4.1 `FlagVerdict` replaces `Optional<FlagRaise>`

Every `FlagRule` returns one of three outcomes:

| Outcome | Carries | Rendered as |
|---|---|---|
| `RAISED` | today's frozen `FlagPayloadEnvelope` (thresholds + observed), unchanged | „7 napos terhelés 412 perc, kcal a cél 71%-án" |
| `CLEAR` | the observed value **and** the threshold it did not reach | „alvás 6,8 h átlag — a 6,0 h küszöb fölött" |
| `UNAVAILABLE` | the gate's reason code | „nincs aktív cél — a trajektória nem olvasható" |

The `CLEAR` branch is the point of the whole feature, and it costs almost nothing to produce:
every rule already computes the observed value in order to compare it against its threshold. We
currently throw it away. This is **not** a second computation — it is the same one, kept.

`UNAVAILABLE` reason codes are an enum whose members are derived one-for-one from the gates that
already exist in the 13 rules — the implementation plan enumerates them by reading each rule, not
by guessing. The ones visible from recon are `NO_ACTIVE_GOAL`, `NO_SLEEP_GOAL_ROW`,
`NOT_ENOUGH_LOGGED_DAYS`, `NO_CHECKINS`, `NO_PLANNED_SESSION` and `NO_PUSH_HISTORY`. Because the
verdict is the rule's only return type, a gate cannot be added without choosing a code — there is
no `Optional.empty()` left to fall through.

**Why not a parallel `explain()` method:** it would duplicate every threshold comparison in a
second place. That is precisely the defect class round 1 hit repeatedly — five key mirrors, three
failing only at runtime. One method, one truth.

### 4.2 The full decision chain is recorded

A rule's verdict is only the first of three gates. The trace row records all of them:

```
rule verdict          service disposition        card outcome
RAISED                LOGGED                     WON
RAISED                SUPPRESSED_BY_COOLDOWN     —
RAISED                LOGGED                     LOST (rank 9 < rank 2)
CLEAR                 —                          —
UNAVAILABLE           —                          —
```

`SUPPRESSED_BY_COOLDOWN` is today discarded inside `FlagService` and is one of the most
interesting answers to "why am I not seeing this" — a rule can be true and still stay quiet
because it spoke recently.

### 4.3 Transition-only persistence

New table `companion_flag_trace`, owned by `feature.companion.flags`:

```
created_by, flag_key, outcome, reason_code, disposition, observed (jsonb), occurred_at
```

**Who writes it.** `FlagEvaluator.evaluate` returns a verdict for *every* rule, not just the ones
that fired; `FlagService.evaluateAndLog` then walks that list, determines each disposition
(`LOGGED` / `SUPPRESSED_BY_COOLDOWN`, and neither for a rule that did not raise), and writes the
trace. One place sees both halves, so one place writes.

**Card outcome is derived at read time, never stored.** The winner is decided later in the cycle
by `AdviceCardService`, after the trace row is already written; storing it would mean updating a
row that is meant to be append-only. Since the delivered card now carries its `flagKey` (§4.4),
the read side resolves `WON` / `LOST` by comparing the day's card against the `RAISED` + `LOGGED`
rows. Nothing is recomputed — both sides are read back.

**A row is written only when `(outcome, reason_code, disposition)` differs from that rule's
previous row.** Disposition is part of the comparison on purpose: a rule that stays `RAISED` but
flips from `LOGGED` to `SUPPRESSED_BY_COOLDOWN` has genuinely changed state, and that is exactly
the "why did it go quiet" moment worth recording. An hourly sweep where nothing changed writes
nothing. Both reads fall out of the same table:

- **a day's closing state** = per rule, the last row with `occurred_at` ≤ end of that day
  (which may predate the day — correct, that is what "unchanged since" means);
- **a day's transitions** = rows whose `occurred_at` falls inside that day.

Ordering is by `AdvicePriority`, so the read side never invents a ranking either.

No retention policy initially: transitions are a handful of rows per day. Revisit if that changes.

### 4.4 `flagKey` on the card

`FeedMessageResponse` gains `flagKey` so the winner can be correlated to its rule. Contract
fragment change → regenerate → contract-drift gate.

## 5. The read surface (S2)

One endpoint, in `feature.companion.flags`, returning a day:

```
GET /api/companion/flags/trace?date=YYYY-MM-DD
  → { date,
      winner: { flagKey, rank, cardId } | null,
      rules: [ { flagKey, label, domain, rank, outcome, reasonCode, reasonText,
                 facts[], disposition, cardOutcome, changedAt } ],   // severity order
                                                                  // cardOutcome derived, not stored
      transitions: [ { at, flagKey, from, to, reasonText } ] }       // chronological
```

**The server sends `label` and `domain`.** This is the mechanism that makes the round-2 promise
real rather than aspirational: if the frontend held a per-`flagKey` map of Hungarian labels and
icons, every new rule would require a frontend change. Instead the domain drives the colour wash
and the clay icon, with a safe fallback for an unknown domain. A round-2 rule appears correctly
because the engine returned it.

`reasonText` is rendered server-side by the same deterministic renderer family as the card's fact
lines — one place produces user-facing explanations of a payload.

**Mock:** a deterministic mock day exercising all five states (`Jelzett`, `Rendben`,
`Nem mérhető`, `Pihenőn`, `Nyertes`), plus at least one transition, since the companion feed mock
is `[]` today.

## 6. The surfaces (S3)

**State vocabulary** (screen copy, not engineering words):
`Jelzett` · `Rendben` · `Nem mérhető` · `Pihenőn` · `Nyertes`

### 6.1 Tile on the Mező hub

A wide tile inside the existing `<Mosaic>`, beside `Karakter`/`Diagnózis`. Poster anatomy:
eyebrow `PROAKTÍV COACHING`, clay spot, one big numeral — how many rules flagged today — with the
winner's name beneath, and a thin 13-segment arc drawing the split. Data as graphics, per the
visual language.

### 6.2 `/mezo/coaching` — hub

`PageHead` (own back chip; there is no shared outlet under `/mezo/*`) → `PageHero` with the
winner's poster and a rank badge (`2/13`) → a three-part ring over the 13 rules
(`StatStrip`) → two wide tiles: **Megfigyelő**, **A napi kártya**. Round 2 lands here later as an
additional row.

### 6.3 `/mezo/coaching/megfigyelo` — Observer

- **Day pager**: today, yesterday, back. Each day shows its closing state.
- **13 tiles in severity order** — the order is the decision, so it is information, not
  decoration. Per tile: rank badge (`mzp-rankb`), clay icon by domain, wash by outcome (flagged =
  domain colour, fine = calm, unmeasurable = muted), one evidence line. The winner carries the
  gold ring the hub already uses for its decision card.
- **Tap expands** (`CollapsibleStrip`) to evidence rows (`mzp-evrow`): threshold, observed value,
  window, logged-day count.
- **The day's timeline** below, when there were transitions: `14:00 · Terhelés–táplálás —
  Rendben → Jelzett`. Absent — not an empty box — on a day with no changes.
- Rendered entirely from the server's ordered array; **no per-rule markup anywhere**, following
  `PatternsPage`'s precedent.

### 6.4 `/mezo/coaching/kartya` — the winning card

- The card, using the anatomy already proven on `NapMezoPage` (facts, suggestions).
- **„Miért ez nyert"** — a ranked strip of the beaten candidates: `Késői evés · rang 9 —
  alacsonyabb súlyosság`. This exists nowhere else in the app.
- **Actions** reuse `useAdviceActions` + `ACTION_INVALIDATES` with server-driven applied state.
  No parallel action path.

### 6.5 Honest states

Four-way everywhere: loading / real error / degraded / genuinely empty. If nothing flagged today,
the Observer says so ("mind a 13 rendben") rather than showing a blank; if there is no card, the
card page says that rather than fabricating one.

## 7. Testing

Content, not coverage:

- **The quiet verdict is genuinely the rule's.** Per rule, all applicable outcomes, tested on
  **both sides of the threshold**. Round 1 was bitten twice by fixtures parked far from the
  boundary — and once by a filler value sitting exactly *on* it, which hid the bug it should have
  exposed.
- **Transition-only writing.** The same verdict twice produces **one** row. This is the condition
  for the table's existence; if it breaks, the table grows by 312 rows a day.
- **Cooldown suppression is visible** as `Pihenőn` rather than vanishing.
- **Closing state and timeline come from the same rows**, and a past day reads back unchanged.
- **The round-2 guarantee**: render a `flagKey` the frontend has never seen — it must appear
  correctly, not blank and not crashed.
- **Actions** run through the existing path with server-driven state.
- Visual goldens for two new pages; `MezoHubPage`'s existing golden moves with the new tile.

## 8. Slices

| Slice | Delivers | User-visible |
|---|---|---|
| `mezo-6269.1` **S1** | `FlagVerdict` across all 13 rules, `companion_flag_trace`, transition-only writes, cooldown disposition | no |
| `mezo-6269.2` **S2** | Read endpoint (closing state + timeline + paging), `flagKey` on the card, mock day | no |
| `mezo-6269.3` **S3** | The tile and the three pages per design 2.0, with goldens | yes |

S1 is the largest and riskiest — the `FlagRule` interface changes in all 13 implementations — so
it ships alone. A problem there should not surface tangled with a half-built UI.

## 9. Out of scope

- Round-2 detections themselves (`mezo-d58h.7`) — this feature prepares for them, it does not add
  them.
- Editing severity, thresholds or cooldowns from the UI. This surface is read-only except for the
  card's existing actions.
- Cross-day analytics ("sleep debt tends to hit on Mondays"). Back-navigation is per-day; pattern
  mining over the trace is a possible later feature, deliberately not designed here.
- Deleting or pruning trace history.
