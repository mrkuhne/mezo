# Csapatfal Act III — „A csapat élő beszélgetése" (design)

**Date:** 2026-09-26 · **Bead:** `mezo-a9bo7.20` · **Epic:** `mezo-a9bo7` (skill `/csapatfal`)
**Status:** owner-approved design (brainstorm 2026-09-26) — next: implementation plan
**Brief it answers:** `docs/superpowers/specs/2026-09-26-csapat-elo-beszelgetes-brief.md`
**Prototype:** `docs/design_2.0/prototypes/uveg-uzenofal.html` — routes `#fal` (the live strip),
`#elo` (the chat room), `#nap-uzenetek` (what stays on Nap → Beszélgetés), sheet `elo-ev`.

## 1. The idea in one paragraph

The proactive coaching engine stops producing ONE daily advice card in Nap → Beszélgetés and
becomes an all-day conversation of the five characters, each speaking about its own area. A
character speaks **only when a rule turns on** (there is something to do) and **when it resolves**
(„ebédnél pótoltad, rendben vagyunk"); two characters talk when a rule genuinely spans both their
areas; the Szkeptikus adds a dry line when a number is estimated or incomplete. The user peeks in
from the Üzenőfal through a live strip, reacts in the chat (the unified trio + the card's apply
actions), and the 21:00 evening edition closes the day with one recap post on the wall.

## 2. Owner decisions (2026-09-26 — do not re-litigate)

| # | Question | Decision |
|---|---|---|
| D1 | Where does the advice live? | **The chat is the advice's only home.** It is born there, acted on there, resolved there. The Nap → Beszélgetés card disappears; one row stays there: „A csapat most erről beszél →". Weighted analysis A 3,85 vs B 3,15. |
| D2 | When does a character speak? | **Only on a teendő and on its resolution.** A rule turning on (raised, logged) opens an ügy; raised → clear closes it. Nothing else speaks (no „nincs adat", no cooldown flips, no morning roll-call). |
| D3 | What reaches the phone? | **At most 2 pushes a day from the chat**; the second only if its ügy outranks the first (`AdvicePriority`). A resolution NEVER pushes. Quiet hours (22–07) as today. The evening edition's own push stays. |
| D4 | Who writes the lines? | **The LLM, in the character's voice, under a strict guard** (only the rule's frozen numbers, 2–4 sentences, own emoji, no jargon), with a template fallback when the guard rejects. |
| D5 | Budget | **Hard cap 1 USD / month** for this feature, spent on three upgrades: (1) *emlékszik* — richer context, (2) *többet gondolkodik* — higher reasoning effort on the cheap model, (3) *valódi kereszt-beszélgetés*. Over the cap → the simpler voice (template), never silence. Expected spend ≈ 0,80 USD / month. |
| D6 | Chat vs wall | **Separate room behind an entry on the wall**; chat messages never become wall posts. The evening edition summarises the day's threads in one Mezo post. |
| D7 | The wall entry | **A live strip at the top of the wall** (under the story strip, above „N beszélgetésben várnak rád"): pulsing dot, the last speaker's face, the latest sentence, an unread count. Floating bubble rejected (it covered content); a 6th story-ring rejected (shows *that* something is new, not *what*). |
| D8 | The Szkeptikus | **Speaks in the chat too** — rarely, only when an input behind a claim is estimated or missing. No emoji, never posts, never opens an ügy. |

Standing canon that still applies: ADR 0049 honesty (every claim traceable, „Miből látszik?" on
every message, uncertainty in Hungarian), the unified action trio, the üveg bible (§3.4 ranking:
one glass per page — on `#elo` it is the „Rád vár" strip), UI glyphs are sprite symbols, emoji only
inside character sentences.

## 3. Prior art

Researcher report, filtered (2026-09-26):

- **Adopted — speak only on a real trigger, never free-running persona chat.** The Chirper.ai
  study (https://arxiv.org/html/2504.10286v1) found unconstrained LLM personas talking to each other
  grow longer, repeat their prompt, invent the people they mention (99.8% of @-mentions pointed to
  accounts that do not exist) and drift toward drama. Hence D2, the fact whitelist, and cross-talk
  only as a structured reply on a conjunction rule (§5.4).
- **Adopted — cheap continuous observation, expensive voice only above a significance bar**
  (Generative Agents, https://arxiv.org/pdf/2304.03442). Our 16 deterministic rules are the cheap
  observation; an LLM line is spent only on a state transition that opens or closes an ügy.
- **Adopted — JITAI vocabulary** (Nahum-Shani et al., https://academic.oup.com/abm/article/52/6/446/4733473):
  rule transitions are decision points, „provide nothing" is a first-class outcome, and *worth
  saying* (silent in-app line) is separated from *worth interrupting* (push, D3). A resolution is
  low-urgency → in-app only.
- **Adopted — a hard push budget and pull over push** (HeartSteps MRT,
  https://academic.oup.com/abm/article-abstract/53/6/573/5091257; JMIR 2023,
  https://mhealth.jmir.org/2023/1/e38342): even good prompts wear out in 2–4 weeks; trials used ≤ 5
  decision points a day. Our cap is 2 pushes; everything else is pulled from the live strip.
- **Adopted — facts from code, phrasing from the LLM, template fallback** (LLM vs human coaching
  messages, https://arxiv.org/abs/2312.04059): tuned LLM messages were rated as helpful as a
  human coach's; pure templates read as „repetitive and generic". This is D4.
- **Rejected — per-event LLM importance scoring** (Generative Agents' scorer): costly and
  non-deterministic; our significance is the rule's own severity (`AdvicePriority`).
- **Deferred — user snooze (1/2/4/8 h, HeartSteps).** Not asked for; revisit if the 2-push cap
  proves too much.

## 4. Codebase terrain

Investigator report, filtered (2026-09-26). BE = `backend/src/main/java/io/mrkuhne/mezo/feature`,
FE = `frontend/src`.

**Affected features:** companion (rule engine + trace), proactive (advice card, push), character
(team world, evening edition, voices), insights (wall + coaching pages), today (Nap → Beszélgetés),
notification (push anchors).

**Key files**
- Transitions: `BE/companion/flags/service/FlagService.java:39-68` (single evaluation path; a raise
  past cooldown → `companion_flag_log` + `FlagRaisedEvent`), `FlagTraceWriter.java:26-50` (writes a
  `companion_flag_trace` row only on a change; raised → clear carries `ClearEvidence`; **publishes no
  event**), `CompanionFlagTraceEntity.java:32-71`, `FlagTraceReadService.java:178-208`.
- Rules & facts: `FlagCatalog.java:41-68` (16 rules, domain vocabulary `sleep|training|nutrition|
  recovery|habits|logging|body`), `FlagPayloadEnvelope.java:33-212` (typed frozen payload per rule),
  `FlagFactRenderer.java:45-67` (Hungarian evidence sentences for raised payloads), `FlagTraceCopy`
  (clear/unavailable sentences).
- Advice card: `BE/proactive/service/InterventionService.java:80-115` (library pick,
  effectiveness-weighted), `AdviceCardService.java:98-158` (per-user advisory lock, supersession by
  `AdvicePriority.outranks`, **an LLM call per delivery**), `AdviceActionCatalog` (≤ 2 apply actions
  per card, e.g. „Holnap könnyebb legyen", „Horgony −30 perc"), `AdviceApplyService`.
- Push: `BE/notification/service/AnchorResolver.java:305-358` (`interventionAnchors`, quiet-hours
  deferral, channel gate).
- Team world: `BE/character/service/edition/TeamCharacter.java:19-69`, `EditionVoiceWriter.java:105-120`
  (one guarded LLM call per edition, never throws, `voiced=false` fallback), `EditionVoiceGuard`,
  `EditionCandidateCollector.java:79`, `TeamEditionService.java:66`, `CharacterCouncilBudget.java:22-53`.
- FE: `features/insights/pages/TeamFeedPage.tsx:24-95`, `components/feed/useTeamFeed.ts`,
  `logic/teamEdition.ts:54-90` (`mergeWall` — an edition replaces its whole day),
  `logic/team.ts:34-70`, `features/today/pages/NapMezoPage.tsx:102-132`, `data/today/adviceHooks.ts:54`
  (`useAdviceActions`, the only advice action path), `data/insights/coachingTraceHooks.ts`.

**Patterns to follow:** guard + honest fallback (never throw, `voiced=false`); number whitelist from
frozen facts (`ProseNumberGuard`); a `FakeCompanionLlm` marker line per new prompt, mirrored
literally (companion must not import character); `@Async @TransactionalEventListener(AFTER_COMMIT)`;
idempotency by unique index; contract-first API (`api/feature/*.yml`, generated types); FE data via
`useDualQuery` with a derived mock seed and honest `realEmpty`; switches via
`FeaturesConfiguration.*_SWITCH` + a `*SwitchOffIT` per bean; flat rows, never glass in glass.

**Traps**
- **Domain vocabulary mismatch:** `TeamCharacter.forMetricDomain("training")` silently returns
  Mezo. The flag → character map (§5.2) must be explicit and tested.
- **Transition lag:** only check-in and sleep saves evaluate immediately; meals and workouts wait
  for the hourly `:05` sweep → a „rendeződött" line can lag up to ~1 h. Accepted (owner saw it).
  Midnight: the evaluator's rolling windows shift at 00:05 and can flip states — no line may be
  written between 22:00 and 07:00 except a deferred open (§5.5).
- **Not every trace row is a change the user feels:** raised(logged) → raised(suppressed) is a
  disposition flip; raised → unavailable is *not* a resolution; a cooldown-suppressed raise has no
  fresh payload.
- **Package cycles** (ArchUnit `feature_slices_are_cycle_free`): allowed directions are
  character → companion, character → proactive, proactive → companion, notification → both. The
  chat lives in **character**; companion/proactive reach it only by events or ports.
- **The advice card is not LLM-free** (stale in the brief and in `companion.md` W5.2): its body is
  `proactive_feed`/`proactive_advice` LLM prose. The card also holds the per-user advisory lock and a
  DB connection across that call — no retries inside it.
- **`mergeWall` swaps a whole day for its edition** — irrelevant here, chat never enters the wall.
- **Overlap with Emlékezet `mezo-d6ivw.5`** (confirmed knowledge + person facts into the
  intervention composer): we own *when and where* the advice speaks; d6ivw.5 owns *what it knows*.
  The chat's context assembler takes the knowledge block through a port that d6ivw.5 fills (§5.3).
- **Gates:** CODEMAP freshness, FE tests in both `VITE_USE_MOCK` modes (unset = mock), full backend
  suite with `-Dmezo.test.use-testcontainers=true`.

## 5. Design

### 5.1 The unit: an ügy (thread)

An **ügy** is one rule's episode for one user. It opens on a **fresh raise** — the existing
`FlagRaisedEvent` (a raise past its cooldown, disposition `logged`, with a frozen payload) — and
stays open across days until it ends (a still-raised rule is cooldown-suppressed on the following
days and never re-raises, so the ügy must outlive its day):

| End | Trigger | What the user sees |
|---|---|---|
| `RESOLVED` | the rule's trace transitions to `clear` (from any state) while the ügy is open | the owner's resolution line, chip „RENDEZŐDÖTT · hh:mm", no push |
| `EXPIRED` | 7 days open without a clear (the longest cooldown is 168 h) | no line; it stops counting as open |

While open, the „Rád vár" strip and the evening recap count it (a day's recap says „nyitva maradt"
for ügyek still open at 21:00). raised → unavailable (data stopped) leaves it open and silent. A
fresh raise of a rule whose ügy is still open writes nothing (at most one open ügy per rule).

### 5.2 Who speaks — the owner map (explicit, tested)

| Rule (`FlagKey`) | Owner | Cross-talk guest (§5.4) |
|---|---|---|
| sleep_debt, ignored_nudge | Szunya | — |
| late_eating | Falat | Szunya |
| load_fuel_mismatch | Mocor | Falat |
| energy_dip_meal_timing | Falat | Derű |
| protocol_lapse, meal_rhythm_drift | Falat | — |
| joint_overuse, missed_workouts | Mocor | — |
| rapid_weight_loss | Derű (body) | Falat |
| acute_bad_day, sustained_stress | Derű | — |
| recovery_needed | Derű | Szunya |
| momentum_at_risk | Mezo | Mocor |
| logging_gap | Mezo | — |
| all_healthy | nobody — never opens an ügy | — |

The map lives server-side next to `TeamCharacter` (one source of names), mirrored nowhere in the
FE (the API carries the character id). Every `FlagKey` must be mapped — a test fails on a new,
unmapped rule.

### 5.3 How a line is written (D4 + D5)

A **TeamChatVoiceWriter** (character package) produces every character line in one guarded LLM
call per event:

- **Facts (the whitelist):** the rule's frozen payload rendered by `FlagFactRenderer` (open) or the
  `ClearEvidence` sentence (resolve), plus the advice library entry the effectiveness picker chose
  (`InterventionService` selection logic is reused — the *what to do* stays deterministic and keeps
  learning from feedback).
- **Context — upgrade 1, *emlékszik*:** the owner's area for the last 7 days (the same numbers the
  rule saw), today's earlier chat lines, the user's reactions to this rule's past advice
  (feedback rollup), and the confirmed-knowledge / person-fact block through a
  `TeamChatKnowledgePort` that Emlékezet `mezo-d6ivw.5` implements (a no-op adapter until it ships).
  Context is *background*; only whitelisted facts may appear as numbers.
- **Upgrade 2, *többet gondolkodik*:** the cheap tier at reasoning effort `high` — already the
  configured default for the chat tier (`reasoning-effort.chat: high`), so it costs nothing extra;
  never the smart tier (≈ 3–4 US cents a line would blow the cap).
- **Guard:** `EditionVoiceGuard` rules reused — numbers only from facts, 2–4 sentences (1–2 for a
  guest), the character's own emoji only, no jargon, informal address. The Szkeptikus: no emoji.
- **Fallback:** guard rejects, LLM fails, or the budget is spent → the template line (library
  `textHu` for an open, the `FlagTraceCopy` clear sentence for a resolve), `voiced=false`. Never
  silence, never throw.
- **Budget:** own slug `team_chat` on the `throttled-features` list, plus a feature cap
  `mezo.character.team-chat.monthly-usd-cap: 1.00` (rolling 30 days, measured from the LLM call log).
  At the cap every line falls back to the template until spend drops below it.

Cost estimate: ~10k input + ~1.5k output tokens on the cheap tier ≈ 0,4 US cents per call; a heavy
month (≈ 5 events/day, cross-talk in the same call) ≈ 0,5–0,8 USD.

### 5.4 Cross-talk and the Szkeptikus

- **Cross-talk:** when an ügy opens on a rule with a guest in §5.2, the SAME call writes the owner's
  line and one guest line (the guest answers with its own area's fact from the payload, e.g. Falat's
  „+40 g szénhidrát"). At most one guest line per event. Resolution may carry one guest line too
  (Mocor: „Akkor este teljes gázzal.") — only when the ügy had a guest at open.
- **Szkeptikus:** one dry guest line, only when the payload marks an input as estimated or missing
  (the implementation plan maps which payload fields carry that signal; a rule without such a
  signal never gets a Szkeptikus line). Never on a resolution.

### 5.5 Timing and pushes (D2, D3)

- Opens ride the existing `FlagRaisedEvent`; a new **FlagClearedEvent** is published by
  `FlagTraceWriter` (companion) when a rule's trace row changes to `clear`. The character-side listener is `@Async` AFTER_COMMIT and
  idempotent (at most one open ügy per `(user, flag_key)`, one resolution line per ügy).
- **Night:** a line that lands between 22:00 and 07:00 is written at once but an open there is
  pushed only through the wake-deferred feed anchor (`AnchorResolver.feedAnchors`), never at night.
- **Push:** only an *open*. The first open of the day pushes; a later open pushes only if it
  outranks every ügy already pushed today (`AdvicePriority.outranks`) and fewer than 2 were pushed.
  Otherwise the line is silent and the live strip shows the unread count. The push goes through
  `AnchorResolver` (quiet hours, channel gate), category `TEAM_CHAT`, deep link to the chat room.
- **Safety cap:** at most 12 character lines per user per day (all kinds); beyond it lines are
  dropped and logged — a guard against a flapping rule, not a product budget.

### 5.6 Where the user reacts (D1)

- Each **open** line carries the unified trio (Ez talál · Nem így érzem · Elmesélem) and the old
  card's apply actions (`AdviceActionCatalog`, ≤ 2, e.g. „Holnap könnyebb legyen"). Feedback feeds
  the same effectiveness rollup as the card did, keyed by the ügy's advice entry.
- **Elmesélem** in the chat writes a user line into the ügy (the prototype's „Rizses csirkét
  ettem…"). It does not by itself resolve the ügy — only the data does (honesty).
- „Miből látszik?" on every line opens the evidence sheet: the rule's numbers, when it turned on,
  and what closes it.

### 5.7 Surfaces (the prototype)

- **Üzenőfal — the live strip** (`#fal`): flat panel with a sage frame (not glass — the day's
  poster stays the only glass), pulsing live dot (static in reduced motion), last speaker's face,
  latest sentence (one line, ellipsis), coral unread count. Hidden when there is no line today and no open ügy.
- **A csapat beszél** (`#elo`), new route `/mezo/elo` (`/mezo/csapat/:id` is the room route): header, the
  „Mind az öten figyelnek" line, chips (nyitott / rendeződött / értesítés ma n/2), ONE glass strip
  „Rád vár: …" jumping to the oldest open ügy (possibly from an earlier day), then the day's lines grouped under REGGEL / DÉLBEN /
  DÉLUTÁN / ESTE dividers; each open line tagged with its ügy chip and push marker („értesítettünk ·
  07:40" / „csendben · …"). A reply row at the bottom. The page refetches every 60 s while open
  (no websockets).
- **Nap → Beszélgetés** (`#nap-uzenetek`): the Üzenetek tab loses the advice card and shows one row
  „A csapat most erről beszél" with the open ügyek in one line.
- **Evening edition:** a new candidate `team_chat_day` (host: Mezo, only if the day had ≥ 1 ügy),
  facts = ügy count, resolved count, carried count and the one-line topics; links to that day's chat.
- **Coaching observer page** (`/mezo/coaching`) stays in the Gépterem, unchanged (brief §2).

### 5.8 What is retired

`AdviceCardService.deliver` no longer writes the daily `companion_message` card once the chat is on
(behind a switch so the old path stays one flag away during rollout); its push anchor goes with it.
The advice library, effectiveness rollup, action catalog and apply service stay — the chat uses
them. The contextual-feed `proactive_feed` call for the card is no longer made (a net LLM saving
that offsets part of the 1 USD).

## 6. Error handling

- LLM failure, guard rejection, budget cap → template line, `voiced=false`; logged, never thrown.
- Listener failure → the transition is not lost: a catch-up job (hourly, :20) compares the last 24 h
  of flag-log raises and clear transitions with the ügy table and fills gaps (idempotent).
- Push failure → the line stays; no retry storm (the anchor path's own semantics).
- Chat feature off → the old daily card path runs as today.

## 7. Testing

- Pure units: owner map covers every `FlagKey`; push policy (first pushes, second only if it
  outranks, resolution never, 2 max); night hold; safety cap; Szkeptikus trigger; guard reuse.
- Integration: a raised transition → ügy + line + push anchor; raised → clear → resolution, no
  push; raised → unavailable → nothing; duplicate event → one line; budget over cap → template.
- ArchUnit + contract drift + CODEMAP gates; `*SwitchOffIT` for new beans.
- FE: live strip states (none / unread / read), chat room grouping, reactions via the existing
  advice action path, Nap row, both mock modes; reduced-motion branch.

## 8. Slicing (one fresh session each)

1. **E1 · Az ügy-motor** — transition event, ügy + line store (migration), owner map, template
   lines only, the chat API (read + reply + feedback), switch. No LLM, no push.
2. **E2 · A hang** — TeamChatVoiceWriter (context, reasoning, guard, fallback), cross-talk,
   Szkeptikus, the 1 USD cap, the knowledge port (no-op adapter).
3. **E3 · A push-keret** — 2/day policy, night hold, `TEAM_CHAT` anchor, safety cap, catch-up sweep.
4. **E4 · A szoba és a sáv** — FE chat room, live strip, Nap row, evidence sheet; retire the card
   behind the switch.
5. **E5 · Az esti összefoglaló** — `team_chat_day` edition candidate + docs (features, ADR 0053,
   stale-doc fixes listed in §4).

E1 → E2 → E3 → E4 → E5; E4 can start after E1 against mock data.

## 9. Out of scope

New per-character detectors (the 16 rules are the scope); a user snooze; real-time transport;
Diagnózis entry from the chat („kérdezzük meg" — later, reuses `mezo-u3712`); the maturity curve
(`mezo-a9bo7.11`, still last).
