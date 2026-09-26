# A csapat élő beszélgetése — brainstorm brief (NOT a spec)

**Date:** 2026-09-26 · **Status:** idea captured, brainstorm NOT started
**Owner request (2026-09-26, verbatim gist):** „a proaktív coaching nem tudna átalakulni oda, hogy az
5 karakter egy real-time chat, egész nap beszélget, ahova be tudsz nézni egy gombbal az
üzenőfalról? mint egy kis chat buborék … bővíthetjük a feature scope-ját, hogy az 5 karakter
vizsgálja a saját domainjét, legyen benne több beszélgetés egymás között."
**Programme home:** csapatfal (epic `mezo-a9bo7`, skill `/csapatfal`) — this is a new round there.

This file is the hand-off for a fresh session. It records what was established in the session
that produced it, so the next session starts the brainstorm (recon → questions → approaches →
prototype → owner OK) without re-deriving the terrain. It is **not** a design; nothing here is
decided beyond the "Decided" list.

## 1. How we got here

1. Owner noticed Proaktív coaching and Diagnózis vanished from the Mezo page. Cause: the old
   12-tile Mezo hub was replaced by the Üzenőfal (`mezo-a9bo7.10`); both now sit behind
   A csapat → Gépterem → Összes funkció (`/mezo/karakter/gepterem/osszes`, `BoopMenuPage`).
2. Mapping what reaches the wall showed a gap: the wall carries only long-horizon records, while
   the one piece of *today* advice — the coaching engine's daily card — lives only in
   Nap → Beszélgetés (`/nap/uzenetek`) and as a push.
3. Recommended: the daily card becomes a wall post. Owner accepted, then asked the right
   question: **when** do we post it? Too late → useless, too early → the situation changes by
   itself. That led to the live-conversation idea below.

## 2. Decided in that session

- The coaching **observer page** (`/mezo/coaching`, Megfigyelő, A napi kártya) stays a
  transparency/"engine room" view in the Gépterem. It is not promoted.
- The daily advice should reach the wall — the shape is what this brainstorm decides.
- Timing principle proposed and not objected to: **no fixed hour. Speak when the state forms,
  and say it when it resolves** ("ebédnél pótoltad, rendben vagyunk"). The engine already
  records the state transitions needed for this (see §3).
- Diagnózis gets "Kérdezd a csapatot" entry points (A csapat page + bottom of Nap) that open the
  existing Diagnózis page — handled separately, not part of this brief.

## 3. Terrain (verified 2026-09-26)

### The coaching engine (proactive coaching, epics `mezo-d58h` round 1+2, `mezo-6269` observer)
- Specs: `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md`,
  `2026-09-05-proactive-coaching-round2-design.md`, `2026-09-05-coaching-observer-design.md`.
- ~16 deterministic rules in `FlagCatalog` (`feature/companion/flags`): Rossz nap,
  Terhelés–táplálás, Gyors fogyás, Vállterhelés, Kimaradt edzések, Alvásadósság, Rögzítési hiány,
  Elengedett emlékeztető, Késői evés, Kihagyott protokoll, Étkezési ritmus, Délutáni energia,
  Regeneráció kell, Tartós stressz, Lendület veszélyben, Minden rendben. Each has a domain
  (sleep, training, nutrition, recovery, habits, logging, body; fallback `general`).
- Evaluation: hourly `FlagSweepJob` (`mezo.companion.flags.sweep-cron: "0 5 * * * *"`) plus
  on-write listeners (check-in/sleep saves). Thresholds in config (`FlagProperties`).
- Every evaluation is traced (observer work): verdict per rule per day (raised / suppressed by
  cooldown / clear / unavailable) **and the day's state transitions with timestamps**
  ("14:00 — Terhelés–táplálás: Rendben → Jelzett"). FE: `useCoachingTrace`, `coachingCopy.ts`.
- Delivery: `InterventionService` → `AdviceCardService.deliver` → ONE `companion_message` feed
  card per day (severity priority, per-rule cooldowns, effectiveness-weighted pick from a config
  text library — deliberately LLM-free). Push via `AnchorResolver` (quiet hours, channel gate).
  Card actions: `useAdviceActions` on `NapMezoPage` and `CoachingCardPage`.
- Origin lesson (round-1 spec §0): 20–30 pushes/day drowned the two that mattered. **Noise is the
  primary risk of an all-day conversation.**

### The csapatfal world (epic `mezo-a9bo7`)
- Spec: `docs/superpowers/specs/2026-09-23-boop-team-feed-design.md`;
  act II: `2026-09-24-csapatfal-act2-esti-kiadas-design.md`. Principle:
  `docs/decisions/0049-boop-shared-social-ai-world.md` — **the builder never composes**; a post's
  body is the record's own text, the character is only its host.
- Characters (`frontend/src/features/insights/logic/team.ts` ↔ backend `TeamCharacter`):
  Szunya (alvás), Mocor (mozgás), Falat (étkezés), Derű (közérzet: mind + body), Mezo (a csapat,
  fallback), plus the Szkeptikus who never posts, only speaks inside conversations.
- Wall sources today (`useTeamFeed` → `buildTeamFeed` + `mergeWall` with the evening edition):
  patterns, pattern monitor pairs, predictions, experiments, observations (észrevételek),
  character feed, konzílium; the evening edition (`EditionCandidateCollector`) adds fuel-day and
  check-in-coverage candidates. **Not on the wall: coaching flags/daily card, diagnoses.**
- Already built conversation pieces: H4 (`mezo-a9bo7.15`) two characters talk under a post
  (max 2 guest lines, the Szkeptikus can be a guest); H3 own voices (`mezo-a9bo7.14`); H5 Falat
  and Derű daily show (`mezo-a9bo7.16`); the evening edition is a once-a-day curator (H1/H2).
- Open related beads: `mezo-a9bo7.17` (edition waits for konzílium retries), `.18`, `.19`.

### Adjacent surfaces
- Nap → Beszélgetés (`/nap/uzenetek`, `NapMezoPage`): tabs Üzenetek | Életjelek | Észrevételek.
  The daily advice card is in Üzenetek. Észrevételek = pattern questions with a daily budget
  (`OBSERVATION_BUDGET`, backend `mezo.companion.reflection.notice`) — the same records also
  appear on the wall as character posts.
- Emlékezet programme (`mezo-d6ivw`, skill `/emlekezet`) owns memory/insight coherence; check
  for overlap before designing (esp. `mezo-d6ivw.6` Tudástár-hub).

## 4. Open questions for the brainstorm

1. **Shape:** a separate "csapat-chat" room behind a bubble on the wall, or live threads on the
   wall itself? How does it relate to Nap → Beszélgetés (does the advice card move, mirror, or
   stay)? One place to act on advice, never two.
2. **Timing:** event-driven on state transitions — which transitions deserve a message? Quiet
   hours? Does "resolved" always speak, or only after a raised message?
3. **Noise budget:** messages can flow all day, but what earns a push? (Proposal: only when the
   user has something to do.) Per-day message cap per character?
4. **Voice & cost:** LLM-written lines (lively, costs per message, ADR 0049 constraints) vs
   templated lines from rule payloads (cheap, mechanical) vs hybrid (template facts + one cheap
   LLM pass per edition/transition). Needs a cost estimate at realistic transition counts.
5. **Cross-talk:** which inter-character exchanges are real (e.g. Terhelés–táplálás = Mocor +
   Falat) vs theatre? The rule domains map naturally onto characters; conjunction rules give a
   genuine reason for two characters to talk.
6. **Scope growth:** "each character examines its own domain" — reuse the existing rules, or
   new per-character detectors? Relationship to diagnoses (could a character offer "kérdezzük
   meg"?).
7. **Fate of the observer page:** stays as the engine room; should each chat message link to its
   rule's evidence ("Miből látszik?")?

## 5. How to start the next session

`/csapatfal` → new round "élő beszélgetés". Brainstorm opens with `brainstorm-recon` (researcher:
live group-chat / ambient AI companions, JITAI timing, notification budgets; investigator: the
terrain above), then questions one at a time, 2–3 approaches, a clickable üveg prototype, owner
OK, then spec → plan. Bead: `mezo-a9bo7.20`.
