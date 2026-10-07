# „Most ne tanulj" — learning pause (design)

- **Date:** 2026-10-07 · **bd:** `mezo-rrjxe` (epic `mezo-d6ivw`, Mezo emlékezete) · **Status:** owner-approved design, prototype next
- **Base spec:** [`2026-09-24-mezo-emlekezete-design.md`](2026-09-24-mezo-emlekezete-design.md) (S6 deferred this switch; S8/S8b define "forget")

## 1. Goal

A master switch in the Tudástár that pauses everything Boop learns **on its own**, while all
existing knowledge stays intact and in use. It is the middle ground between full memory and
deleting memory. The switch is only worth having if its promise is exact, so the promise is strict.

**The promise (the copy must say exactly this):** *Amíg szünetel a tanulás, magamtól semmit nem
jegyzek meg — és abból, amit közben mondasz vagy írsz, később sem tanulok.*

## 2. Owner decisions (2026-10-06 … 10-07) — do not re-litigate

| # | Decision | Consequence |
|---|---|---|
| D1 | **The paused period is dropped forever.** Nothing is replayed after resume. | Pause **intervals are stored**; every look-back window excludes them. "Skip the run while paused" is not enough. |
| D2 | **Everything stops**, recall included: no facts, person facts, observations, effects, character opinions — and no recallable memory or daily summary of the paused period. The user can still read the conversation itself. | Same meaning as S8b "ezt ne jegyezd meg", applied to a time span instead of one message. Logged numbers stay in the diary and statistics, but no new observation is derived for paused days. |
| D3 | **Duration is chosen at switch-on:** „ma estig" · „holnap reggelig" · „amíg vissza nem kapcsolom". Timed pauses end by themselves and Boop says it is listening again. | A persistent indicator everywhere, which is also the off-switch. |
| D4 | **The user's own explicit acts keep working** during a pause (add / edit / accept / reject / confirm in the Tudástár, „Rólam is", people edits). Only automatic learning stops. | The copy says „magamtól". Asked in chat to remember something, Boop says learning is paused and offers to resume. |
| D5 | **The switch ships last**, only when every learning path honours it. | Backend first and invisible; no interim switch with a weaker promise. |

## 3. Behaviour

### 3.1 What is "paused material"

- **Record rule.** A text record created while a pause is in effect is *paused material*: a chat
  message (both sides of the turn), journal / gratitude / decision / reflection entry, check-in
  note, training note, csapatfal `USER` line. Paused material is never read by any learning path,
  online or batch, now or later.
- **Day rule.** A local day (user zone) that overlaps a pause at any instant is a *paused day* for
  every day-scoped derived artifact and for all numeric evidence: no daily summary is written for
  it, and pattern detection, effect links, hypothesis evidence, re-checks and the character
  detectors skip it. Deliberately over-inclusive: a pause started at 20:00 drops that day's numbers
  from learning too.
- **Principle for everything else — "reagálni szabad, megőrizni nem".** Real-time features that
  react to today's logged numbers keep working (budgets, readiness, flags and the csapatfal ügyek
  they raise, reminders). Anything that would **persist a narrative or a conclusion** about the
  paused period is skipped (daily summary, the csapatfal evening edition of a paused day, weekly /
  quarterly reviews exclude paused days, period consolidation).

### 3.2 What keeps working

- Existing knowledge in every prompt (chat, proactive, csapatfal), recall of pre-pause memory,
  „Emlékszem".
- The conversation's own running context (the model still sees this conversation's earlier turns).
- The user's explicit acts (D4): `POST /fact`, fact edit / mute / forget, candidate decisions,
  pattern decide / reply, question-card answers, „Rólam is", people CRUD.
- Maintenance of existing knowledge (Monday fact merge, graph mirror of mutes / forgets, snooze
  expiry, graph decay) — it runs, and never reads paused material.
- A csapatfal reply is still answered, but always `ANSWER_ONLY`: no fact, no exception, no chip.

### 3.3 Duration and expiry

| Choice | Ends at | Stored `planned_end_at` |
|---|---|---|
| „ma estig" | the end of the local day (24:00) | next local midnight |
| „holnap reggelig" | tomorrow at quiet-hours end (07:00, `mezo.notification.quiet-hours.end`) | that instant |
| „amíg vissza nem kapcsolom" | manual | `null` |

- Expiry is **computed, never job-dependent**: paused ⇔ an interval exists with `ended_at is null`
  and (`planned_end_at is null` or `now < planned_end_at`). A sweep closes expired rows and emits
  the one in-app notification „Újra figyelek" (no push inside quiet hours); a late sweep never
  extends a pause.
- The indicator always shows the exact end („eddig: ma 24:00" / „holnap 7:00" / „amíg vissza nem
  kapcsolod"). An open-ended pause older than 3 days gets one gentle in-app reminder.
- Resume is one tap on the indicator. Re-pausing opens a new interval.

### 3.4 What the user sees (Üveg, dark; prototype is the build target)

- **Tudástár hub hero:** a switch row „Most ne tanulj" → a sheet with the three duration buttons
  and the promise sentence. While paused the row shows the state and „Újra tanulhatsz" (resume).
- **Persistent strip** „Szünetel a tanulás · eddig: …" with the resume action: on every Tudástár
  view (`TudasFrame`), on the Rólad page, on the csapatfal (replaces the „Mind az öten figyelnek…"
  live line, which would be untrue) and in the chat header.
- **Chat:** no „Megjegyeztem / Megjegyezném" chips on paused turns; the model is told the real
  state and answers a "jegyezd meg" request honestly with the offer to resume.
- **Hogyan tanul?** gains a short paragraph on the pause.
- States: loading (row skeleton), error (row stays, toast, state unchanged), companion switched
  off (row hidden with the rest of the degraded hub), 320 px, reduced motion.

## 4. Architecture

### 4.1 Store and service (package `feature/auth` — the only slice every learner can import)

`people` imports only `auth` / `journal` / `ritual`, and `companion` imports `people`
(`feature_slices_are_cycle_free`), so the flag cannot live in `companion_preferences`. It is an
account-level setting.

- Table **`learning_pause`**: `id`, `created_by`, `started_at`, `planned_end_at` (nullable),
  `ended_at` (nullable), `duration_choice` (`tonight | tomorrow_morning | open`, CHECK),
  `end_reason` (`user | expired`, nullable, CHECK), audit columns. Partial unique index: one row
  with `ended_at is null` per user. Liquibase; added to `ResetDatabase`.
- **`LearningPauseService`** (ungated `@Service`, no feature switch — a disabled gate must never
  mean "learn"):
  - `current(userId)`, `start(userId, choice)`, `end(userId, reason)`;
  - `isPausedAt(userId, instant)` — the record rule;
  - `isPausedDay(userId, localDate)` / `pausedDays(userId, from, to)` — the day rule;
  - `intervals(userId, from, to)` for SQL-side exclusion.
  An interval's effective end is `coalesce(ended_at, planned_end_at, +∞)`.
- **`LearningPauseSql`** — one shared SQL fragment / predicate (`not exists (select 1 from
  learning_pause p where p.created_by = x.created_by and x.created_at >= p.started_at and
  x.created_at < coalesce(p.ended_at, p.planned_end_at, 'infinity'))`), the
  `MemorySourceVisibilitySql.forgottenTurn` idiom. Readers compose it; nobody re-derives it.
- API (contract fragment `api/feature/auth/…`): `GET /api/learning-pause` → `{paused, startedAt,
  until, choice}`; `PUT /api/learning-pause {choice}`; `DELETE /api/learning-pause`. Enums as
  `enum:`. Not part of the full-replace companion-preferences PUT (clobber trap).

### 4.2 Gates

1. **Online, per event** — every `@Async AFTER_COMMIT` learner skips before any LLM call when the
   source record is paused material, and re-checks inside its saving transaction (the
   `MessageExtractionGate` idiom; a turn finished just before the flip must not save after it).
   The chat turn carries a new `learningPaused` flag on `ChatTurnCompleted` — **not**
   `extraction_blocked`, which since S8b means "forgotten" and hides the turn from the user's own
   recall tools.
2. **Batch, per window** — every job step that reads a look-back window excludes paused material
   (record rule) and paused days (day rule). Gating sits at **step** granularity inside the job,
   not at `UserFanOut`: maintenance steps must keep running.
3. **Prompt honesty** — a volatile block `[Tanulás szünetel]` overrides the `VOICE` promise of
   background remembering; `FakeCompanionLlm` gets the matching branch.
4. **Embedding / projection** — `MemoryEmbeddingWriter` and the catch-up sweeps skip paused
   material, so no `memory_item` / `memory_vector` is ever written for it.

### 4.3 Leak guard (the Google lesson made mechanical)

- **Classification registry test:** every `@Scheduled` job class and every listener on the
  learning events (`ChatTurnCompleted`, journal / gratitude / decision / reflection saved,
  `TeamChatRepliedEvent`, `MessageFeedbackRecordedEvent`) must appear in one test-side map as
  `LEARNS` (and then names its gate test), `MAINTAINS` or `NEUTRAL`. A new, unclassified job or
  listener fails the build.
- **Leak matrix IT:** for each `LEARNS` path — create the source inside a pause, run the path now
  *and* again after resume with the clock past the window → no new row in any knowledge table.

## 5. Codebase terrain (investigator, filtered)

**Learning paths that must honour the pause** (`BE` = `backend/src/main/java/io/mrkuhne/mezo/feature`):

| Kind | Path | Trigger |
|---|---|---|
| fact candidates | `companion/service/FactExtractionListener` → `FactExtractionService.extractFromTurn` (also the reinforcement bump + `FACT_REINFORCED`) | chat turn |
| fact candidates | `proactive/service/WeeklyLessonService` via `WeeklyReviewGenerator` | weekly cron / regenerate |
| facts | `KnowledgeFactService.captureFromTeamChat` ← `character/service/chat/TeamChatReplyService` | csapatfal reply |
| facts | engine confirm in `companion/reflection/service/HypothesisEvaluationService` → `PatternService` | nightly |
| person facts | `PersonFactExtractionListener` → `people/service/PersonFactService.capture` | chat turn |
| persons / tone / edges | `GraphMaintenanceJob` phase 4 → `PersonExtractionService`; phase 3 `LifeEventExtractionService` | nightly, yesterday |
| mentions | `ChatMentionListener`; `people/service/MentionDetectionListener`, `ReflectionMentionListener`; `NoteMentionCatchUp`, `TrainingNoteMentionSweep` | events / nightly |
| patterns | `ReflectionJob` (`catch-up` 7 d, `chat-day`, `evaluate`, `effects`, `propose`), `TextSignalListener` → `QuickNoticeService`, `PatternDetectionJob`, `KnowledgeRecheckJob` (drift cards) | events / nightly |
| effects | `EffectLinkService.recompute` (60-day window) | nightly |
| memory | `TurnEmbeddingListener`, journal / gratitude / decision / reflection embedding listeners, `MemoryEmbeddingWriter`, `NoteEmbeddingCatchUp` (no lower bound), `DailySummaryJob` (7-day catch-up), `ConsolidationJob` | events / nightly |
| profile | `ProfileAssemblerJob`, `FeedbackLearningJob`, `QuarterlyReviewJob` | cron |
| character | `CharacterObservationJob` (3 d), `CharacterCouncilJob` (2 d, runs the evening edition), `CharacterConferenceJob` (2 w), monthly / maturity, `ClaimLifecycle`; csapatfal exception (created only with its fact) | cron |

**Explicit user acts (stay allowed, D4):** `FactCandidateService` decisions, `PatternService.decide`,
`ReflectionReplyService`, `KnowledgeFactService` create / update, `QuestionAnswerService`,
`AboutMeService`, people CRUD, `CharacterReplyService` / `CharacterFeedbackService` (decide in the
plan: the user's reply to a claim is their own act; the *observation derived from it* is not).

**Maintenance (keeps running):** `FactMergeJob`, backfill runners, `GraphPromotionListener` + the
nightly reconcile (must run so mutes and forgets propagate), `GraphMaintenanceService` decay.

**Frontend:** hub `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (`TudasFrame`
header slot on every view), `components/KnowledgeBaseView.tsx` (hero → the switch row, between the
hero note and the tiles), copy in `logic/hubCopy.ts`, explainer `components/HowItWorksView.tsx`;
strip precedent `hub/TenyekSection.tsx` (`th-merge-strip`); kit `shared/ui/Toggle.tsx` (`glass`).
Csapatfal `pages/TeamChatPage.tsx` (`tf-chat-live` line, `glass tf-strip`), Rólad
`pages/BoopAboutPage.tsx`; chat chips `components/memory/MemoryChip.tsx`,
`components/teamchat/ReplyAfterlife.tsx`. Data: a new `useLearningPause` on `useDualQuery`
(optimistic + rollback, the `knowledgeHubHooks` shape), MSW handler, mock store. Layout specs:
`frontend/tests/layout/{tudastar-hub,chat-memory,team-chat-reply}.spec.ts`.

**Traps:**
- `ai_message.extraction_blocked` must not be reused (see 4.2).
- Look-back cursors that would learn retroactively without interval exclusion: daily-summary and
  turn-embedding catch-up (7 d), `NoteEmbeddingCatchUp` / `NoteMentionCatchUp` (unbounded),
  text-signal catch-up (7 d), observation context (28 d), effect links (60 d), pattern look-back,
  character 3 d / 2 d / 2 w, weekly / quarterly / consolidation.
- `CompanionPreferencesRepository.upsert` rewrites every column — a new field there is clobbered
  by a stale settings draft.
- Contract drift: fragment → `cd api/generate && npm run generate:api` → Maven → `pnpm
  generate:api`; no apostrophe inside single-quoted YAML.
- New table → `ResetDatabase`; any new LLM marker → `FakeCompanionLlm` + admin label; mock seed
  counts are hard-coded in three FE tests; the PWA serves a stale bundle on first open.
- Csapatfal ITs run with the quiet window off (`TestTeamChatQuietHours`, `mezo-tielp`) — the
  expiry notification test must enforce it explicitly.
- **Living prototype is behind production:** `docs/design_2.0/prototypes/elo/mezo.html` still
  shows the pre-S6 two-door Tudástár; the four-section hub lives only in
  `uveg-tudastar-hub.html`. The hub is ported into `elo/mezo.html` (its own commit) before the
  switch is drawn on it.

## 6. Prior art (researcher, filtered)

| Pattern | Source | Verdict |
|---|---|---|
| Pause keeps the store, reset deletes; explicit "conversations while paused won't be added if you turn it back on" | Claude memory — https://support.claude.com/en/articles/11817273 | **Adopt** the split and the explicit gap sentence. **Reject** "pause also stops *using* memory" — ours is write-only. |
| Off never deletes; delete is a separate deliberate act; reading and writing are coupled | ChatGPT Memory FAQ — https://help.openai.com/en/articles/8590148-memory-faq (search excerpts; fetch blocked) | **Adopt** off ≠ delete. Our read-yes / write-no state exists at neither market leader, so the copy must explain it. **Reject** a per-conversation temporary mode for now. |
| Self-ending pause; the gap never counts; existing personalisation keeps working | Spotify Private Session — https://support.spotify.com/ae-en/article/private-listening/ | **Adopt** as the closest analogue: gap dropped, optional self-ending. **Reject** the settings-only indicator. |
| Always-visible state marker that is also the control | Microsoft Recall — https://support.microsoft.com/en-us/windows/privacy-and-control-over-your-recall-experience-d404f672-7647-41e5-886c-a3c59680af15 | **Adopt** the persistent strip outside the hub. **Reject** per-source exclusions (v1 is one master switch). |
| "Memory should never be a black box"; and the pitfall: activity saved while paused | Shape of AI — https://www.shapeof.ai/patterns/memory · Google activity controls — https://support.google.com/accounts/answer/54068 (settlement facts from press excerpts) | **Hard rule:** the pause covers every write path or the label names what it does not cover → the leak guard in 4.3. |

Not researched (5-source cap): Replika, Pi, Gemini. No sourced user complaints of the "forgot it
was on" kind were found; that risk is inferred, and D3 answers it.

## 7. Slices

| Slice | Content | Owner sees |
|---|---|---|
| **P** | Port the four-section hub into the living Mezo prototype (seed commit), then draw the switch, the sheet, the strips (hub, Rólad, csapatfal, chat), the paused chat turn, the expiry message, „Új ikonok". Owner OK. | The whole look, clickable |
| **B1** | `learning_pause` store + service + API; online gates (chat turn, notes, csapatfal reply, embeddings); prompt honesty; registry test skeleton. | nothing |
| **B2** | Batch gates: every look-back window and day-scoped artifact (reflection, summaries, effects, patterns, people, character, reviews); leak matrix IT complete; expiry sweep + notification. | nothing |
| **F** | The switch, sheet and strips in the app; docs; living prototype in sync; release. | everything, working |

Each slice gets its own plan (`docs/superpowers/plans/`) and *Kész, ha…* list; the plan of B1/B2
re-derives the full producer inventory from the code, not from this table.

## 8. Out of scope

- Per-source or per-topic exclusions; a per-conversation "temporary chat".
- Retroactively pausing a past period (that is „Elfelejtem").
- Pausing the *use* of existing knowledge (that is the per-item use-toggle).
- `mezo-bltxf` item 2 and the other open S8 follow-ups.

## 9. Open points for the plans (not owner decisions)

- Whether `CharacterReplyService` / `CharacterFeedbackService` observations count as the user's
  explicit act (default: the reply is stored, no derived observation while paused).
- The exact "paused day" treatment of the weekly review's day cells (default: the day shows as
  „szünetelt a tanulás", numbers visible, no narrative).
- Whether the 3-day reminder reuses the proactive question card or a plain in-app notification.
