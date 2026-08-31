# Karakter — user character dossier design (mezo-1gim)

> Brainstormed with Daniel on 2026-08-27. Driving bd epic: `mezo-1gim`. UI language:
> Hungarian, labels verbatim; this spec is English per repo convention.
>
> **Sequencing decision:** system spec first (this document); the visual design of the
> Karakter pages happens in the **design 2.0 prototype pipeline** (`docs/design_2.0/`,
> epic `mezo-88jw` idiom: audit → prototype → iteration → consolidated spec) BEFORE any FE
> implementation. Backend work can start from this spec independently.

## 1. Concept

Mezo already remembers a lot — L1 episodic embeddings (chat turns, daily/weekly summaries,
journal, decisions, reflections, gratitude), L2/L3 confirmed knowledge facts, the statistical
pattern engine, life-event graph nodes, memoir, predictions, weekly review. What is missing is
the **synthesis layer**: a persistent, dimension-structured picture of *who Daniel is* that
matures over time, weighs evidence, and infers from meta-signals (logging discipline, gaps,
contradictions between logs and outcomes).

**Karakter** is that layer: a living dossier ("character sheet") of the user.

- **Dual consumer, equal rank:** (a) the user — a genuinely exciting Én-tab surface where he
  watches the profile being built about him and gives feedback; (b) the AI — a
  deterministically rendered `[Karakter]` block in the companion system prompt (and in the
  weekly-review / memoir / prediction generators).
- **Structure:** 7 fixed core dimensions + AI-opened chapters (see §2).
- **Built by a visible AI team:** 7 named domain-expert personas + a Szkeptikus (devil's
  advocate), chaired by Mezo as lead profiler — Mezo's *inner council* (IDENT-1 preserved:
  the user's one relationship stays Mezo; the team is something he can watch working).
- **Unit of truth:** the **claim** — a structured statement with confidence, evidence refs,
  and a lifecycle. Dimension prose is written from claims, not the other way around.
- **User feedback is claim-level** ("talál" / "nem igaz" / "pontosítom") and is itself an
  input signal.

## 2. Dimensions

Fixed core (`kind = CORE`, seeded, never deleted):

| key | Title (HU) | Expert | Scope |
|---|---|---|---|
| `physical` | Fizikai | Doki | body composition, health, weight trend, medication cycle |
| `athletic` | Sportolói | Edző | training profile, strengths/weaknesses, preferences, RIR calibration, niggles |
| `nutrition` | Táplálkozási | Táplálkozó | eating patterns, relationship with food, macro adherence, NOVA drift |
| `recovery` | Alvás & regeneráció | Szomnológus | sleep quality/rhythm, recovery, night-mode behavior |
| `mental` | Mentális & érzelmi | Pszichológus | mood patterns, stressors, rumination, emotional signal from journal/gratitude |
| `discipline` | Motiváció & fegyelem | Drill | logging discipline, streak behavior, resilience, promise-vs-delivery |
| `life` | Élet & kapcsolatok | Antropológus | life events, people, context, weekday/weekend gap, seasonality |

**AI-opened chapters** (`kind = CHAPTER`): the weekly konzílium may propose a new chapter when
a recurring pattern fits no core dimension (e.g. "Szezonalitás", "Munka-stressz ciklus"). A
chapter proposal must survive the Szkeptikus and is created with low maturity; the monthly
pass may retire a chapter that stopped accruing evidence (soft-delete; its claims are
re-homed or retired). Chapters have no dedicated expert — the Integrátor (Mezo) owns them.

## 3. The team

Each persona = a system prompt (domain expertise + voice + "what signals it watches") + a
curated input contract. Output is always in the persona's voice — the visible personality
differences are a product feature, not decoration. Working names (final naming/voice is a
design-round deliverable):

| Persona | Role | Voice sketch |
|---|---|---|
| Doki | `physical` expert | matter-of-fact, medical |
| Edző | `athletic` expert | direct, speaks in numbers |
| Táplálkozó | `nutrition` expert | practical, non-judgmental |
| Szomnológus | `recovery` expert | quiet, precise |
| Pszichológus | `mental` expert | warm, questioning |
| Drill | `discipline` expert | strict but fair |
| Antropológus | `life` expert | observational, narrative |
| **Szkeptikus** | cross-cutting adversary | dry, contrarian — attacks every claim proposal |
| **Mezo** | Integrátor / chair | the established companion voice |

Identity guardrails (bind everything):

- **IDENT-1:** the team is Mezo's inner council. Experts never message the user directly in
  the daily touchpoints; toward the user, Mezo summarizes. The user *reads* the team's work
  (observations feed, konzílium transcript) — a behind-the-scenes view, not a second
  relationship.
- **No theater:** the konzílium transcript is the *real* multi-turn exchange that produced
  the decisions — persisted as it ran, never re-dramatized. This extends the AI-napló
  transparency principle.
- **Companion tone on sensitive claims:** self-perception-calibration and
  knowledge-rejection-pattern claims (the most valuable and the creepiest) are always
  phrased as a mirror/question ("úgy tűnik, felfelé kerekíted az energiád — nézzük meg
  együtt?"), never as a diagnosis. The Szkeptikus's explicit brief includes hunting
  over-interpretation on this claim class.

## 4. Data model

New backend feature package `feature/character`, house idioms throughout (UUID PK
`gen_random_uuid()`, soft delete `@SQLDelete`/`@SQLRestriction`, `created_by` ownership,
typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)`, Liquibase `{ts}_{bd-id}_{desc}.sql`, seed in
`@Profile("demodata")`). LLM access via the existing `CompanionLlm` port; all calls flow into
the LLM audit log (`feature/llmlog`) with a `character` feature tag.

Five tables:

- **`character_dimension`** — `key varchar` (unique per user among live rows), `title`,
  `kind CORE|CHAPTER`, `expert_key` (nullable for chapters), `portrait text` (current HU
  prose), `maturity smallint` (0–100 coverage/confidence roll-up, computed), `version int`,
  `updated_at`. Core 7 seeded by migration with empty portrait + maturity 0.
- **`character_claim`** — `dimension_id FK`, `text` (HU, one statement), `confidence
  numeric(3,2)` 0–1, `status ACTIVE|RETIRED` (a proposal Mezo rejects never becomes a claim row — it lives
  only in the conference transcript), `origin_conference_id FK`,
  `proposed_by varchar` (expert key), `evidence jsonb` (typed ref list: observation ids,
  pattern ids, fact ids, memory refs), `sensitive boolean` (the §3 mirror-tone class),
  `user_feedback jsonb` (history of talál/nem igaz/pontosítom events with timestamps),
  timestamps. Confidence changes append to a compact `confidence_history jsonb` (for the
  claim detail UI).
- **`character_observation`** — `expert_key`, `dimension_keys jsonb` (usually one, may be
  two for cross-signals), `day date`, `text` (expert voice), `salience smallint` 1–5,
  `signals jsonb` (detector event refs + raw data refs), `consumed_by_conference_id FK
  nullable`. User feedback events are ALSO written here (expert_key `user`) so the
  konzílium consumes them uniformly.
- **`character_conference`** — `kind BOOTSTRAP|WEEKLY|MONTHLY`, `week_start date`
  (nullable for BOOTSTRAP/MONTHLY), `transcript jsonb` (ordered turns
  `{persona, text, refs[]}`), `outcome jsonb` (structured change list: claims
  accepted/retired/reconfirmed, portraits rewritten, chapters opened — the feed's diff
  source), `generated_at`. Partial unique index: one LIVE WEEKLY row per user+week.
- **`character_portrait_revision`** — `dimension_id FK`, `version int`, `portrait text`,
  `conference_id FK`, `created_at`. Every portrait rewrite appends one; the future
  "Történet" view reads this.

## 5. Signal layer — deterministic detectors (pure code, no LLM)

A detector catalog in the pattern-engine spirit: code *detects*, LLM *interprets* — the
honest-state axiom holds because no number or event is ever invented by a model. Detectors
run inside the nightly job (§6) over existing domain reads; output = typed signal events
handed to the experts (embedded in `character_observation.signals`; no separate table in v1).

v1 catalog (grouped; each detector = key + params + owning expert):

**Meta-behavior (app usage as character evidence):**

- `logging-gap` — N consecutive days without meal logs (also variants: weight, check-in,
  journal silence). → Drill
- `retro-logging-ratio` — share of Pótold/backdated logs vs real-time, trend. → Drill
- `checkin-latency` — notification→answer delay trend; sudden lengthening. → Drill
- `night-activity` — app activity near/after lights-out vs next-day sleep quality. →
  Szomnológus
- `chat-topic-shift` — theme distribution drift in chat (food-question spikes, repeated
  "how should I feel" loops). Detector = coarse keyword/embedding bucketing; interpretation
  strictly LLM-side. → Pszichológus
- `knowledge-rejection-pattern` — which fact/pattern categories get rejected repeatedly in
  triage. **Sensitive class.** → Pszichológus

**Cross-domain:**

- `under-logging` — logged kcal deficit while weight MA rises ⇒ the log lies, not the
  scale. → Táplálkozó + Drill
- `comfort-eating` — high-stress check-in weeks vs NOVA level / snack-window usage rise. →
  Táplálkozó + Pszichológus
- `sleep-performance-chain` — post-bad-night RPE/skipped sets; personal collapse threshold
  (hours below which training quality breaks). → Szomnológus + Edző
- `sport-interference` — volleyball shoulder-scale vs gym shoulder volume collisions. → Edző
- `med-cycle-covariance` — medication-cycle week vs energy/mood/appetite check-ins.
  Careful framing, medical supervision context. **Sensitive class.** → Doki
- `people-mood-link` — mentioned-person events vs mental check-in movement; recurring
  gratitude themes. → Antropológus + Pszichológus
- `weekend-gap` — weekday-vs-weekend behavior differential size + trend. → Antropológus

**Character traits (the dossier's soul):**

- `resilience` — days-to-return after a streak break. Possibly the single most valuable
  number in the dossier. → Drill
- `all-or-nothing` — one slipped item ⇒ does the rest of the day's logging vanish? → Drill
- `restart-pattern` — Monday/first-of-month restart cycles. → Drill
- `promise-vs-delivery` — morning kreed/foci vs evening Napzárás reflection: what is
  repeatedly promised and repeatedly missed. → Pszichológus + Drill
- `self-calibration` — subjective check-ins vs objective data (energy 8 after 5 h sleep ⇒
  upward-biased self-perception). **Sensitive class.** → Pszichológus
- `decision-profile` — decision-journal outcome scores by decision type. → Pszichológus

**Physiological fine signals:**

- `rir-calibration` — estimated vs actual reserve from set data. → Edző
- `niggle-map` — body parts vs preceding volume patterns. → Edző/Doki
- `hr-recovery-trend` — running HR-recovery as conditioning proxy. → Edző

Detectors are individually switch-listed in config (`mezo.character.detector.<key>.enabled`)
so a noisy one can be silenced without a deploy.

## 6. Pipeline — three cadence tiers + bootstrap

The intermediate unit is the **observation**: daily runs never rewrite portraits; they
deposit timestamped, weighted observations, and the weekly konzílium distills them. The
dossier doesn't chase daily noise, but the UI shows a fresh-observations feed — the
"it's being built about me" experience.

- **Nightly expert pass** (cron next to `DailySummaryJob`; flash tier). Per expert: run the
  expert's detectors + gather the day's domain deltas; **if nothing relevant, no LLM call**
  (zero-cost quiet days). Otherwise one structured call → 0–n observations in the expert's
  voice (strict JSON, marker idiom like `SUMMARY_MARKER`). No portrait writes.
- **Weekly konzílium** (Sunday evening cron, after `MemoirJob`; the expensive, accepted
  cost). An actually-executed multi-turn orchestration, persisted turn-by-turn:
  1. each expert with unconsumed observations presents a week summary + claim proposals
     (new / confidence-up / confidence-down / retire) — flash tier;
  2. the Szkeptikus attacks every proposal (evidence sufficiency, alternative explanations,
     over-interpretation — extra scrutiny on `sensitive`) — smart tier;
  3. Mezo the Integrátor rules per proposal (accept with confidence / reject / "figyeljük
     tovább"), looks for cross-dimension patterns, may propose a chapter, and orders
     portrait rewrites for affected dimensions — smart tier;
  4. portraits are rewritten (one call per affected dimension, from ACTIVE claims + prior
     portrait), revisions appended, `outcome` diff assembled, observations marked consumed.
  User feedback observations (§7) are surfaced to the owning expert(s) at step 1 with top salience (an unaddressed correction is logged, never silently dropped).
- **Monthly deep read** (first Sunday of month, extends that week's konzílium): full
  re-evaluation over the memory layers + the whole claim base — slow-drift detection
  ("logging discipline has been eroding for six months"), stale-claim retirement,
  confidence recalibration, chapter retirement.
- **Bootstrap** (one-time, manual trigger; the launch "wow"): a deep read over the full
  existing history (daily summaries, journal, patterns, facts, weekly reviews, life
  events) runs as the first konzílium (`kind BOOTSTRAP`) and stands up the initial
  dossier — first open shows a substantive profile, not an empty sheet.

Failure semantics follow house idioms: a failed conference leaves no partial row (single
transaction around persist); an unusable LLM answer ⇒ no change + honest absence; crons are
switch-gated per job (`mezo.techcore.cron.character-*.enabled`) plus one feature switch
(`CHARACTER_SWITCH`, dependent on `COMPANION_SWITCH`).

## 7. Claim lifecycle + user feedback

```
expert proposal → Szkeptikus verdict → Mezo ruling
   → ACTIVE (initial confidence)  |  rejected (recorded in transcript only)
ACTIVE: reinforcing signals ↑ / contradicting signals ↓ (konzílium moves it)
   → RETIRED (monthly pass or "nem igaz")
```

User feedback buttons on every claim (Én/Karakter dimension page):

- **„talál"** — confidence up (konzílium applies the bump; capped so self-confirmation
  can't saturate a claim without data).
- **„nem igaz"** — immediate `RETIRED` + a high-salience `user` observation for the next
  konzílium (the team must reckon with being wrong).
- **„pontosítom"** — free text; stored on the claim + surfaced to the owning expert(s) at
  top salience, evidence line carrying the claim id so it can be targeted directly. The
  correction itself is strong evidence; if a konzílium consumes it without a proposal
  addressing that claim id, the gap is logged, not silently dropped.

Every feedback event is also a `character_observation` (expert_key `user`), so it flows
through the same pipeline as any other signal.

## 8. Prompt injection — the `[Karakter]` block

Deterministically rendered (no LLM) from the dossier into the companion system prompt,
alongside the confirmed-facts block (facts = atomic data, claims = interpretation; both
belong):

- per dimension: top claims with `confidence ≥ threshold` (config), ordered by confidence ×
  recency, token-capped (config, e.g. ~600 tokens);
- one-line portrait digest per dimension when maturity > threshold;
- rendered by a single shared formatter (the `renderDayLine` precedent) reused verbatim by
  the chat system prompt AND the weekly-review / memoir / prediction generators, so no two
  surfaces can disagree about who the user is.

## 9. API contours (contract-first, `api/feature/character/character.yml`)

- `GET /api/character` — dimensions with maturity + current portraits + top claims (hub +
  page read).
- `GET /api/character/dimension/{key}` — full portrait + ACTIVE claims with evidence refs +
  recent revisions.
- `GET /api/character/feed?limit=` — recent observations (expert-voiced) + latest
  conference outcome diff, merged chronologically.
- `GET /api/character/conference` (list) + `GET /api/character/conference/{id}` — the
  transcript for the konzílium view.
- `POST /api/character/claim/{id}/feedback` — `{kind: TALAL|NEM_IGAZ|PONTOSITOM, text?}`.
- `POST /api/character/bootstrap` — one-time trigger (409 if a live BOOTSTRAP conference
  exists).

All gated on `CHARACTER_SWITCH`; 404-when-off follows the companion idiom (FE degraded
badge).

## 10. FE surface (content skeleton — visual design in the design 2.0 round)

Design 2.0 language throughout: tile-first Mozaik 2.0, clay icons (new sprites needed: one
per expert persona + a dossier spot), tile → own full page with colored hero, honest states
("tanulom", absence renders nothing, never red).

- **Én hub**: new **Karakter** tile (clay icon + maturity cue). Later evolution (flagged,
  not v1): the identity hero's bio line becomes the dossier's live one-line self-portrait.
- **Karakter page**: hero = compact 7-dimension maturity visual (radar/segmented ring) +
  one-line self-portrait; then 7+n dimension tiles (expert avatar, maturity, one key
  claim); then **„Amit mostanában megtudtam rólad"** feed (fresh observations in expert
  voices + the latest konzílium diff).
- **Dimension page**: portrait prose + claim list (confidence in human words, never raw
  numbers — the Minták precedent), evidence refs as chips, the three feedback buttons,
  chat-handoff chip (anchored-chat idiom).
- **Konzílium page**: transcript as persona-styled bubbles — watching the team work.
- **Történet** (later, cheap to open): portrait revisions + claim timeline. Not v1.

Feedback uses the claim-level buttons (§7), NOT the generic 👍/👎 artifact feedback.

## 11. Testing & ops

- Konzílium choreography integration tests via `FakeCompanionLlm` sentinels (one per
  persona step, the `[fake-memoir:…]` precedent) — assert transcript shape, claim
  transitions, portrait revision append, observation consumption, single-transaction
  failure semantics.
- Detector unit tests are pure-code (no LLM): fixture days in, signal events out.
- Cost visibility: every call audited with feature `character` + call-kind per step; the
  AI-napló shows the weekly konzílium honestly (an accepted, deliberate spend).
- Backend gates locally: focused ITs only (Testcontainers mode); full suite in CI via the
  self-PR.

## 12. Decomposition (implementation-plan input)

Suggested slice order (each a bd child of `mezo-1gim`, own branch + self-PR):

1. Schema + seed + `character.yml` contract + read endpoints over empty data.
2. Detector catalog v1 (pure code) + nightly expert pass → observations.
3. Konzílium orchestration (weekly) + claim lifecycle + portrait rewrite + transcript.
4. Bootstrap + monthly deep read.
5. `[Karakter]` prompt block + generator wiring.
6. Feedback endpoint + user-observation loop.
7. FE (AFTER the design 2.0 Karakter prototype round): hub tile + page + dimension +
   konzílium + feed, dual-mode hooks, mock seeds.

Out of scope v1: Történet view, identity-hero live bio line, expert direct messaging
(never — IDENT-1), any outward action (IDENT-2).
