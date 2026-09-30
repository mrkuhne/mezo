# mezo — Per-Feature Documentation Index

This folder is mezo's **living, current** engineering reference: one doc per domain feature and one per cross-cutting platform layer. Each doc describes how a feature **works now** — its data flow, data model/API, **integrations with other features**, how to **use** it, how to **extend** it, and how it's tested. They are kept in sync with the code; if a feature changes and its doc here doesn't, the work is not done.

---

## 1. Purpose — and how this differs from `specs/` and `references/`

`docs/features/` is the answer to *"how does feature X work, and how do I build on it?"* — read it before touching any feature or wiring any new one. It is durable memory that tracks the code, not a point-in-time artifact.

Four doc families, four different jobs — read the right one (or all of them) for the job at hand:

| Folder | Question it answers | Lifecycle | When to read it |
|---|---|---|---|
| **[`docs/CODEMAP.md`](../CODEMAP.md)** | **WHERE it lives** — per feature: backend package, entities→tables, controllers→`<Tag>Api`, contract endpoints, FE data hooks, pages/sheets/components/logic, ITs + populators | **Generated** — `node scripts/gen-codemap.mjs`, CI-gated, never hand-edited | You need to *find* the files for a feature. Read it BEFORE this folder — then open the feature doc it links. Never grep the tree to orient. |
| **`docs/features/`** (this folder) | **HOW it works NOW** — operation, data flow, data model/API, integrations, use, extend, test | **Living** — kept in sync with the code | You're understanding, consuming, debugging, extending, or wiring a feature. Start here. |
| **`docs/superpowers/specs/`** | **WHAT we decided to build & WHY then** — the design as it stood when the feature was conceived | **Point-in-time** — a historical artifact, *not* kept in sync | You need the original design rationale, slice map, or the "why this shape" behind a decision. Each feature doc links its driving spec. |
| **`docs/references/`** | **HOW we build** — Java/Spring/Liquibase/testing/API **house standards** | **Living, non-negotiable** rules | You're writing/reviewing backend code, a migration, a test, or a contract. The feature doc tells you *what*; the reference tells you the *mandatory pattern*. |

Rule of thumb: `CODEMAP.md` gets you to the right files; the feature doc explains them. A feature doc tells you the feature's seams and the recipe to extend it, then **links** to the relevant `references/*.md` for the exact house standard and to its `specs/` for the original rationale — it never restates them. ADRs (`docs/decisions/`), infra (`docs/infrastructure/`), and the roadmap (`docs/milestones/roadmap.md`) are linked, never duplicated.

### Maintenance policy — living, but kept lean

These docs are **overwritten in place; git is the history.** When a feature changes, edit the affected section(s) of its doc as part of the same change — **never** keep an in-doc changelog, version suffix, or dated snapshot. To see what a doc said before, use `git log -p docs/features/<x>.md`. This is what keeps the set from bloating: a `features/` doc has exactly one current version per feature, whereas `specs/` deliberately accumulates one dated, frozen artifact per design effort (the decision trail). Practical rules:

- **Edit only what changed.** The 10-section template means a change maps to specific sections (new endpoint → §4 + §10; new integration → §5; mock→real swap → §3 + §4 + §8). Update those; leave the rest.
- **Link, don't duplicate.** Describe structure, intent, and integration seams with `file:line` pointers — don't paste code (it rots fastest) or restate `references/` / `specs/`.
- **Update when it changes what the doc describes** — behavior, contract, data model, integrations, the file map, or status. A purely internal, no-behavior-change refactor only needs a touch if its `file:line` pointers went stale.
- **Same change, not a later pass** — so review catches drift. If the work leaves a `features/` doc stale, the work isn't done.

**Mandatory rule (enforced by root `CLAUDE.md` + [`docs/README.md`](../README.md)):** every new or changed feature MUST add or update its `docs/features/` doc — a new view/flow, a new domain, swapping a mock hook to real, a new sub-feature, or a cross-feature integration all require it. See [§5 of this index](#5-the-doc-template) for the canonical template every doc follows.

---

## 2. Index

Status legend: ✅ done · 🔶 mock-only (no real backend yet) · 🟣 Phase-3 (AI brain) deferred · mixed = per sub-feature. Statuses below are each doc's own declared status (frontmatter `status:` + its §1 detail) — read the doc for the exact per-layer breakdown.

**Last reviewed: 2026-09-27.**

Live nav (5 domains × 4 tabs, [`frontend/src/app/navModel.ts`](../../frontend/src/app/navModel.ts)): **Nap** (`/nap` Mai · `/nap/napom` A napom · `/nap/uzenetek` Beszélgetés · `/nap/rutin` Rutin) · **Edzés** (`/train/mai` Mai · `/train/mesocycles` Terv · `/train/week` Terhelés · `/train/exercises` Gyakorlatok) · **Fuel** (`/fuel` Mai · `/fuel/stack` Kiegészítők · `/fuel/trendek` Trendek · `/fuel/konyha` Konyha) · **Mezo** (`/mezo` Üzenőfal · `/mezo/csapat` A csapat · `/mezo/rolad` Rólad · `/mezo/emlekek` Emlékek) · **Én** (`/me` Áttekintés · `/me/weight` Súly · `/me/sleep` Alvás · `/me/naplo` Napló). Visual language: dark-only "Üveg" ([`docs/design_2.0/2026-09-23-uveg-style-bible.md`](../design_2.0/2026-09-23-uveg-style-bible.md)).

### Domain docs

| Doc | Area | Status | One-line |
|---|---|---|---|
| [`today.md`](today.md) | Nap hub + siblings (`/nap`, `/nap/napom`, `/nap/uzenetek`, `/nap/gyors`, `/nap/kuldetesek`, `/nap/checkin`) | mixed | Daily capture hub: the orbital Mai hub (companion block + one computed next step + tiles), "A napom" live/closed-day view, the companion-thread page, the FAB's quick-log picker, day's quests, check-in slots. **Check-in 2.0 (`mezo-ck2`, 2026-09-28):** plan-driven 14-item sheet (5 core + time-of-day items + „A nap kérdése", no pre-selection, quick exit), answered-item cells, A napom „Te: X/10" duo. |
| [`habit.md`](habit.md) | Nap → Rutin (`/nap/rutin`) + Én → Rutin (`/me/rutin`) | ✅ done | Two fixed habit-stacking chains (9 morning + 6 evening catalog items), mostly DERIVED off already-logged data, HABIT progression XP, trailing-28-day habit strength (no hard streaks). |
| [`intention.md`](intention.md) | rides the Nap hub (`/nap`, `IntentionSheet`) — no route of its own | ✅ done | Standing creed + up to 3 daily foci + a holistic evening reflection; two DERIVED habits + one DERIVED `growth_intention` GROWTH quest; only the first daily focus earns XP. |
| [`needs.md`](needs.md) | Nap → Életjelek (`/nap/eletjel`) | ✅ done | Six real-time decaying "life-sign" rings (Energia/Hidratáció/Pihenés/Mozgás/Lélek/Rend) refilled from existing logs; FE pure engine + UI, backend day-close snapshot/award/streak. |
| [`ritual.md`](ritual.md) | full-screen `/ritual` (chrome hidden; entered from Nap's evening island, "A napom", or the Rutin tab's `evening_ritual` row) | ✅ done | Sleep-anchored 6-act evening closing ritual (Megérkezés → … → Termés → Elengedés); R4 visual goldens + reduced-motion audit shipped; rides the HABIT XP tail. |
| [`growth.md`](growth.md) | Nap → Küldetések tile (`/nap/kuldetesek`) + Én → Növekedés (`/me/growth`, `/me/growth/{skillek,naplo,kituntetesek}`) | ✅ done (E1+E2+E3 + the Growth page) | Gamified layer: 3 daily side quests (derived completion, never self-claimed) + a free-text activity log (companion-proposed, server-disposed XP) feeding one 8-skill LIFE economy. E4 (shop/coins) remains, under `mezo-52vz`. |
| [`train.md`](train.md) | Edzés (`/train/mai`, `/train/mesocycles`, `/train/week`, `/train/exercises`) | ✅ done (FE mock + FE real + backend) | Four owner-approved tabs — Mai, Terv (mesocycles), Terhelés (weekly muscle/load), Gyakorlatok (exercise catalog) — periodized mesocycles, workout execution, volleyball, interval running; **Check-in 2.0 training readiness** on Mai („Mai állapot" card, one-tap „Könnyítsük", `/api/train/readiness/today`, `mezo-ck2`). **Proportional progression step** (real-weight candidates, reps before a too-big jump, `mezo-bk7sn`). **Mid-workout exercise swap / add** („Csak ma” / „Mezociklusra is”, `mezo-mobji`). **Kihagyás S1 shipped** — one-tap Kihagyom/Kihagytam for a planned gym day, sport slot or run, optional reason, weekly free pass, `/api/train/skips` (`mezo-q4xt2.1`). **Kihagyás S2 shipped** — multi-day **kímélő mód** for a serious reason: protected days, daily „Hogy vagy?” on the Nap hub, return rule CONTINUE/RESUME/STEP_BACK with a whole-week meso shift, automatic comeback ramp, `/api/train/recovery` (`mezo-q4xt2.2`). Cross-load AI narrative stays 🟣 Phase-3. |
| [`fuel.md`](fuel.md) | Fuel (`/fuel`, `/fuel/stack`, `/fuel/trendek`, `/fuel/konyha`, `/fuel/tanulas`) | ✅ done (Phase-2 exit audit closed 2026-07-05) | Four tabs — Mai (meal pacing + deterministic 8-dim scoring), Kiegészítők (stack/protocol), Trendek, Konyha (pantry + recipes) — all backend-backed; only the Replan cascade + Stack-recommendation fixtures stay 🟣 P8 theater. Learned expenditure Part 2 (`mezo-3n2so`): the weekly dot/sheet, „Hogy tanultam?” history page, day marks and the learning switch. **Actual-movement budget (`mezo-tb3s2`, 2026-09-28):** the Mozgás row credits the day's actually-logged movement (planned + unplanned), not the weekly plan average; a faint „még jön” preview shows the still-unlogged plan; the Edzőnap-shift setting is retired. **Unified meal entry (`mezo-qe90y`, 2026-09-29):** Fotó · Kamra · Recept · Szokásosak, persistent text/mic, large photo preview and explicit Elemzés ([ADR 0056](../decisions/0056-unified-meal-entry.md)). |
| [`pantry.md`](pantry.md) | Fuel → Konyha (`/fuel/kamra`) | ✅ done | Shared definition catalog (`pantry_catalog`, master + user-authored) + per-user shelf state (`pantry_item`); OFF/URL/photo import; catalog search "Hozzáadás a közösből". |
| [`recipe.md`](recipe.md) | Fuel → Konyha (`/fuel/recipes`) | ✅ done | Owned recipe aggregate with frozen line snapshots, deterministic mezo-fit at read, AI breakdown, stateless Receptműhely turn. |
| [`goal-engine.md`](goal-engine.md) | no route of its own — feeds Én → Cél (`/me/goals/weight`), Fuel → „Hogy tanultam?" (`/fuel/tanulas`) | ✅ done (backend) | TDEE-bootstrap → segmented projection → soft-guards → feasibility-graded prescription engine behind a body-weight goal's "recept"; adaptive TDEE + learned-expenditure Part 1 **and Part 2** (weekly card, day marks, the learning switch, `mezo-3n2so`) landed. **The day-type kcal split is retired (`mezo-tb3s2`, 2026-09-28, M4):** each segment's `kcal` is a planning-only weekly average; the day the owner is served now follows Fuel/Train's actually-logged movement instead. The learning filter's movement input follows the same served number (M5). Deferred: the Phase-3 AI evaluator (replacing the heuristic gate) and the Profile TDEE card's formula-only display (`mezo-qnsl9`). |
| [`lifegoal.md`](lifegoal.md) | Én → Célok (`/me/goals`) | in-progress | General-purpose life goals tagged to a PERMAH dimension, measured by 1–5 signal-backed pillars; CRUD/scorer/nightly-eval/ha-akkor triggers/chat+prompt embedding all shipped (slice 3). Still 🔴 not built: the knowledge-graph `GOAL` node. |
| [`insights.md`](insights.md) | Mezo (`/mezo`, `/mezo/csapat`, `/mezo/rolad`, `/mezo/emlekek`) | mixed | The "AI brain" surface, now rooted in the five-character csapat-üzenőfal social wall (`TeamFeedPage`). Chat/Patterns/Knowledge/Memoir/Predictions/Experiments/Memória are all real over the companion + proactive backends — **no mock-only Insights tab remains**; the backend itself is companion-only (no dedicated `pattern`/`knowledge_fact` service). |
| [`character.md`](character.md) | Mezo (`/mezo/karakter/*`, opens on Üzenőfal; Rólad and A csapat are the other primary destinations) | shipped | Karakter dossier: 7 domain-expert personas + a Szkeptikus chaired by Mezo, 47 nightly detectors (4 inventory rounds + the 7 Check-in 2.0 ones, `mezo-ck2`), weekly konzílium, bootstrap + monthly deep read, a `[Karakter]` prompt block on all four narrative surfaces, a claim feedback loop, contextual social-feed replies. |
| [`companion.md`](companion.md) | AI conversation layer, no route of its own — surfaces via Mezo's Chat/Knowledge pages | mixed | Open-ended Hungarian conversation with owner-scoped data access: a smart retrieval loop + native streaming, 18 domain reads + 5 context/source reads on an audited 15-call budget. Backend real; FE surface is Insights' `ChatPage`/`KnowledgeListPage`. |
| [`proactive.md`](proactive.md) | no dedicated route — feeds Nap's `/nap/uzenetek` thread, the companion feed, and Mezo's coaching pages | complete | The Phase-4 "companion speaks first" layer: one `companion_message` table, 9 kinds (morning/sleep/weight/midday/evening/people/advice, plus `intervention`/`setup` as pre-S4 history), event/cron-driven, one unified `GET /api/proactive/feed`. |
| [`journal.md`](journal.md) | Én → Napló (`/me/naplo`; also reachable from the global QuickInput sheet) | ✅ done | Free-prose journal + gratitude + decision entries feeding the companion's narrative-memory embedding pipeline (`memory_embedding`); an open-decisions block with due chips + a review sheet. |
| [`me.md`](me.md) | Én (`/me`, `/me/weight`, `/me/sleep`, `/me/naplo`) | mixed | Personal hub: identity/progression hero, weight goal, sleep, journal, weekly review, people, knowledge. Weight/sleep/journal/growth/habit/`Heti`/`Emberek` are backend-real (person facts since S3/S8, `mezo-d6ivw.3`/`.12`); `Tudás` reuses the companion Tudástár. |
| [`tutorial.md`](tutorial.md) | cross-cutting overlay — header "?" button on any route; first-launch welcome pager on `/nap` | mixed | Per-route "Mezo-kalauz" onboarding sheet + registry; the motor + 5 T1 hub guides + 22 T2 sub-page guides (Nap/Edzés/Fuel) are shipped. Still unbuilt: the Mezo/Én T2 batches and every T3 guide. |
| [`admin-hub.md`](admin-hub.md) | `/admin/*` (desktop, OWNER-only) | ✅ done (BE + FE real + FE mock) | Owner console: a value dashboard (Pulzus · Emberek · Funkciók · Költés · Memória · Meghívók) plus a generic "Nyers adatok" `information_schema` row browser. |
| [`admin-memory-explorer.md`](admin-memory-explorer.md) | `/admin/memory`, `/admin/users/:id/memory` | ✅ done (BE + FE real + FE mock) | RAG memory explorer, part 2 of the admin/observability series: an install-wide entry page + a per-user 5-view explorer (Áttekintés · Felidézések · Gráf · Térkép · Rétegek) over one shared inspector. |

**Records:** [`contextual-feed-evaluation.md`](contextual-feed-evaluation.md) is not a feature surface — it is the release-gate evaluation record for the contextual Mezo feed ([ADR 0050](../decisions/0050-contextual-mezo-feed.md), `mezo-7nron.6`): fake-backed ITs plus a real-provider prose review over twelve synthetic cases. Kept beside [`proactive.md`](proactive.md) and [`companion.md`](companion.md), which it gates.

### Platform docs (cross-cutting, `_`-prefixed — no route/tab of their own — plus `settings.md`)

| Doc | Area | Status | One-line |
|---|---|---|---|
| [`_platform-data-layer.md`](_platform-data-layer.md) | Data Layer & Dual-Mode | ✅ done (some hooks 🔶 mock-only) | The single FE↔data boundary (`data/hooks.ts`) + `isMockMode()` dual-mode switch + TanStack Query wiring + typed REST clients. Read before wiring any domain to the backend. |
| [`_platform-api-backend.md`](_platform-api-backend.md) | API Contract & Backend Architecture | ✅ done (Phase-2 infrastructure closed 2026-07-05) | The contract-first OpenAPI pipeline (`api/`) + the Spring Boot 4 backend spine (`techcore/` + `feature/<x>/…`) + the FE consumption seam. Backs auth, biometrics, goal, Train, Fuel, People, companion. Drift = compile error. |
| [`_platform-auth-security.md`](_platform-auth-security.md) | Auth & Security | ✅ backend done (S1); ✅ FE persisted token + `AuthGate` | Multi-user auth (`mezo-qw37`): invite-gated register/login → 30-day HS256 JWT → resource-server filter → per-request `CurrentUser` status check → server-side `created_by` ownership. |
| [`_platform-design-system.md`](_platform-design-system.md) | Design System & UI Primitives (now "Üveg") | in-progress (per doc) — the app-wide Üveg re-dress programme itself is complete | Dark-only "Üveg" material: Mozaik colors on a warm-graphite ground, wearing Titanium (3D icon sprite, glass cards with a gradient frame, sheen, glow). Epic `mezo-me75u` (U1–U11) closed 2026-09-27 — every surface wears it. |
| [`_platform-notifications.md`](_platform-notifications.md) | Push Notifications Platform | mixed | `techcore/webpush` (in-house VAPID ES256 + RFC 8291 `aes128gcm`) + `feature/notification`/`feature/appnotification`; N1 (delivery spine) + N2 (dispatcher/prefs) + N3 (FE-schedule/preview) are all shipped, all 22 push categories are live, and real Web Push delivery to a device is confirmed. FE surface: `/me/ertesitesek`. |
| [`settings.md`](settings.md) | Central settings & personal context — reached via the header cog, `/settings` | ✅ done | Domain preference groups (Fuel/Train/Mezo/Én/Nap) + notifications/appearance/account, plus the inspectable personal companion context the AI reads from. |

---

## 3. Feature → doc map (quick lookup by route or sub-feature)

Jump from a route, tab, sub-feature, or concept to the doc + the section that covers it.

| You're looking at / for… | Route | Doc → section |
|---|---|---|
| The Nap hub, "Mai", daily capture orbit | `/nap` | [`today.md`](today.md) §2 |
| "A napom" — live day view / closed-day review | `/nap/napom`, `/nap/napom/:date` | [`today.md`](today.md) §2–§3 |
| Companion thread ("Mezo · ma") | `/nap/uzenetek` | [`today.md`](today.md) §2 · [`proactive.md`](proactive.md) §2 |
| Quick-log picker (FAB, full-page) | `/nap/gyors` | [`today.md`](today.md) §2 |
| Check-in / "Heartbeat" slots — Check-in 2.0 sheet, answered cells | `/nap/checkin` (+ the sheet from any Nap entry) | [`today.md`](today.md) §2–§3 |
| Check-in backend — 14 items, question plan, „A nap kérdése" (`GET /api/biometrics/checkin/plan`) | no route — `feature/biometrics/checkin` | [`me.md`](me.md) §4 |
| Training readiness — „Mai állapot" / „Könnyítsük" | `/train/mai` | [`train.md`](train.md) §2, §4 |
| Kihagyás S1 — Kihagyom/Kihagytam skip + reason, weekly free pass, `/api/train/skips` | `/train/mai` (+ `/train/week` muted rows) | [`train.md`](train.md) §2 "Kihagyás (S1)" |
| Kihagyás S2 — kímélő mód: multi-day recovery period, Hogy vagy? card, return rule + comeback ramp, `/api/train/recovery` | `/train/mai` (+ `/` Nap hub) | [`train.md`](train.md) §2 "Kihagyás S2 — kímélő mód", [`today.md`](today.md) §2 |
| Edzés közbeni gyakorlat csere / hozzáadás („Csak ma” / „Mezociklusra is”) | `/train/session` | [`train.md`](train.md) §2, §4 |
| Rutin (morning/evening habit chains) | `/nap/rutin`, `/me/rutin` | [`habit.md`](habit.md) §2 |
| Daily intention creed + foci + evening reflection | rides `/nap` (`IntentionSheet`) | [`intention.md`](intention.md) §2 |
| Életjel-ringek (six life-sign rings) | `/nap/eletjel` | [`needs.md`](needs.md) §1–§2 |
| Napzárás (sleep-anchored evening closing ritual) | `/ritual` | [`ritual.md`](ritual.md) §2 |
| Daily quests / activity log / Growth | `/nap/kuldetesek`, `/me/growth`, `/me/growth/{skillek,naplo,kituntetesek}` | [`growth.md`](growth.md) §2 |
| Weekly cross-domain agenda (gym+volley+run) | `/train/mai` | [`train.md`](train.md) §2, §5 |
| Active week / weekly muscle-load review | `/train/week` | [`train.md`](train.md) §2 |
| Workout briefing (Eligazítás) / active workout / per-set logging / resume | `/train/session` (owned by Mai tab; fresh start = briefing, resume = card list) | [`train.md`](train.md) §2, §4 (workout execution) |
| Mesocycle library / plan wizard / templates | `/train/mesocycles`, `/train/templates` | [`train.md`](train.md) §2, §4 (mesocycles) |
| Volleyball ("Röplabda") schedule + log | `/train/sport` (owned by Mai tab) | [`train.md`](train.md) §2, §4 (sport) |
| Interval running ("Futás") + block builder | `/train/futas` (owned by Terv tab) | [`train.md`](train.md) §2, §4 (running) |
| Exercise catalog + per-exercise records | `/train/exercises` | [`train.md`](train.md) §2, §4 (catalog/records) |
| Meal pacing ("Mai") + meal score sheet | `/fuel` | [`fuel.md`](fuel.md) §2 |
| Learned expenditure — weekly „Heti tanulás” summary, „Hogy tanultam?” history + day marks | `/fuel/tanulas` | [`fuel.md`](fuel.md) §2 · [`goal-engine.md`](goal-engine.md) §3 |
| Meal-slot templates / weekly fuel rhythm editor | `/fuel/slots` | [`fuel.md`](fuel.md) §1–§2 |
| Supplement stack / protocol builder | `/fuel/stack` | [`fuel.md`](fuel.md) §2 |
| Recipe library / editor / Receptműhely | `/fuel/recipes` (owned by Konyha tab) | [`recipe.md`](recipe.md) §2 |
| Pantry / "Kamra" / OFF-URL-photo import | `/fuel/kamra` (owned by Konyha tab) | [`pantry.md`](pantry.md) §2–§4 |
| Goal engine "recept" (kcal/protein/sleep prescription) | feeds `/me/goals/weight` | [`goal-engine.md`](goal-engine.md) §2 · Me surface: [`me.md`](me.md) §2 |
| Célok (general-purpose life goals, PERMAH + pillars) | `/me/goals` | [`lifegoal.md`](lifegoal.md) §2 |
| Csapat-üzenőfal (five-character social wall) | `/mezo` | [`insights.md`](insights.md) §1 (Csapat-üzenőfal Act I note) |
| Detected patterns (pattern dashboard + decision inbox) | `/mezo/patterns` (owned by Üzenőfal tab) | [`insights.md`](insights.md) §2.1 |
| Memoir / predictions / experiments | `/mezo/memoir` (Emlékek tab) · `/mezo/predictions`, `/mezo/experiments` (Üzenőfal tab) | [`insights.md`](insights.md) §2.3–§2.7 |
| Weekly review (score bars, AI summary) | `/me/week` | [`me.md`](me.md) §1 (retired from Insights, `/mezo/weekly` redirects) |
| Companion chat (real, Spring AI 2 / Gemini) — incl. turn-memory chips and „Rólam is" (`mezo-d6ivw.13`) | `/mezo/chat` | [`insights.md`](insights.md) §1, §2.5 · [`companion.md`](companion.md) §3–§4 |
| Knowledge facts / knowledge graph ("Tudástár") — incl. the Monday weekly fact merge (`mezo-d6ivw.10`: „Összevonnám” card on Rólad, „Összevontam” fold + strip) | `/mezo/knowledge` (owned by Rólad tab), `/mezo/rolad` | [`insights.md`](insights.md) §2.0b, §2.4 · [`companion.md`](companion.md) „Heti tény-összevonás” · [`me.md`](me.md) §1 |
| Memória (RAG memory observatory) | `/mezo/memoria` (owned by A csapat tab) | [`insights.md`](insights.md) §2.9 |
| Karakter dossier (7 experts + Szkeptikus, chaired by Mezo) | `/mezo/karakter/*` | [`character.md`](character.md) §2 |
| Proactive companion feed (morning/sleep/weight/midday/evening/people/advice) | surfaces on `/nap/uzenetek` | [`proactive.md`](proactive.md) §2–§3 |
| Áttekintés hub — identity/progression, tiles | `/me` | [`me.md`](me.md) §1–§2 |
| Weight goal + log ("Cél") | `/me/goals/weight` | [`me.md`](me.md) §2–§4 (weight ✅ backed) · engine: [`goal-engine.md`](goal-engine.md) |
| Sleep log ("Alvás") | `/me/sleep` | [`me.md`](me.md) §2–§4 (sleep ✅ backed) |
| People ("Emberek") | `/me/people` | [`me.md`](me.md) §2 (mock shell) |
| Push-notification opt-in ("Értesítés") — subscribe toggle, test push, feed | `/me/ertesitesek` | [`me.md`](me.md) §2 · protocol/data-model/categories: [`_platform-notifications.md`](_platform-notifications.md) |
| Free-prose journal / gratitude / decisions ("Napló") | `/me/naplo` | [`journal.md`](journal.md) §2 · Me surface: [`me.md`](me.md) §2 |
| Per-route onboarding sheet ("Mezo-kalauz") / welcome pager | header "?" on any route · first launch on `/nap` | [`tutorial.md`](tutorial.md) §1–§2 |
| Central settings (Fuel/Train/Mezo/Én/Nap preferences, notifications, appearance, account) | `/settings` | [`settings.md`](settings.md) §2 |
| Meghívó kódok / felhasználók / jelszó-reset / letiltás | `/admin/accounts` | [`admin-hub.md`](admin-hub.md) §2, §4 |
| AI-napló per-user chips, owner-only LLM-usage | `/admin/cost` | [`admin-hub.md`](admin-hub.md) §3 · [`me.md`](me.md) §2 |
| Admin overview / users / usage / data browser | `/admin`, `/admin/users(/:id)`, `/admin/usage`, `/admin/data` | [`admin-hub.md`](admin-hub.md) §2, §4 |
| RAG memory explorer (install-wide + per-user) | `/admin/memory`, `/admin/users/:id/memory` | [`admin-memory-explorer.md`](admin-memory-explorer.md) §2 |
| Contextual feed release-gate evaluation (not a UI surface) | — | [`contextual-feed-evaluation.md`](contextual-feed-evaluation.md) |
| The `useX()` hooks / mock-vs-real / ghost-guard rule | — | [`_platform-data-layer.md`](_platform-data-layer.md) §2, §4 |
| OpenAPI contract / `api/feature/<x>.yml` / codegen | — | [`_platform-api-backend.md`](_platform-api-backend.md) §3–§4 |
| `OwnedEntity` / `CurrentUserId` / soft delete / typed jsonb | — | [`_platform-api-backend.md`](_platform-api-backend.md) §4b · [`_platform-auth-security.md`](_platform-auth-security.md) §4 |
| Login / JWT / owner seed / token bootstrap | `/api/auth/login` | [`_platform-auth-security.md`](_platform-auth-security.md) §3–§4 |
| Üveg tokens / glass recipe / 3D icon sprite / accent convention | — | [`_platform-design-system.md`](_platform-design-system.md) §3, §5–§6 |
| Companion chat backend (conversations + sync/streamed message) | `/api/companion/*` | [`companion.md`](companion.md) §3–§4 |

---

## 4. Cross-reference / integration matrix

Derived from each doc's **§5 Integrations**. The named **contract** is the type/shape that crosses the seam. 🟣 marks a seam that is narrated/mock today but whose live engine is Phase 3.

### Domain ↔ domain

| Seam | Direction | Contract crossing | Notes / source |
|---|---|---|---|
| **Today ↔ Train** | Today → Train | navigation only (`navigate('/train')`); Today renders its **own** mock `Workout`, not Train's backend | [`today.md`](today.md) §5 |
| **Today ↔ Fuel** | Today ← Fuel | `FuelSlot[]` / `FuelPlanToday` — `useFuelPreview` slices the **same** `fuelToday` object Fuel renders | [`today.md`](today.md) §5 · [`fuel.md`](fuel.md) §5 |
| **Today ↔ Insights** | Today → Insights | visual teaser only; `InsightsTeaser` mirrors pattern `p1` verbatim (a copy, not a live read) | [`today.md`](today.md) §5 · [`insights.md`](insights.md) §5.2 |
| **Today scenario ↔ Fuel** | Fuel ← Today | `TodayScenario` (`medCycleDay`, `day`) drives Fuel Terv's medication-cycle strip via `useTodayScenario` | [`fuel.md`](fuel.md) §5 |
| **Train (Mai) ↔ Running** | internal merge | `WeeklyAgendaDay` / `RunPrescribedSession` / `WorkoutPlan` / `SportSchedule` — `TrainTodayPage` composes both `useTrain` + `useRunning` | [`train.md`](train.md) §5 (canonical internal integration) |
| **Train Sport → all systems** 🟣 | Sport → Fuel/Sleep/Weight/Insights/Train | `CrossLoadRow {target,impact,why,system,warning}` — mock-only; engine Phase 3 (`crossLoad: null` in real → view ghosts) | [`train.md`](train.md) §5 |
| **Train Running → GYM** 🟣 | Running → leg volume | static presentational cross-load text — engine Phase 3 | [`train.md`](train.md) §5 |
| **Train ↔ Me/`Cél`** 🟣 | mock narrative | a mesocycle id/label pair; `Goal.mesocycles` IDs are mock strings, not joined to the Train backend | [`me.md`](me.md) §5.2 |
| **Train (gym) ↔ Fuel** | Fuel owns a copy | `GymScheduleDay` / `VolleyballSession` — Fuel keeps its **own private copy** of the schedule, not read from Train | [`fuel.md`](fuel.md) §5 |
| **Fuel ↔ Me/`Alvás`** 🟣 | Fuel → Sleep | `SleepLogResponse.mealToSleep` hardcoded `0` "until Fuel lands" — *the* documented future seam | [`me.md`](me.md) §5.3 · [`fuel.md`](fuel.md) §1 |
| **Fuel replan cascade** 🟣 | Fuel → Sleep/Insights/Train | `ReplanScenario.cascades[].system` (`'Fuel'|'Train'|'Sleep'|'Insights'`) — the simulated "context ripples across domains" model | [`fuel.md`](fuel.md) §5 |
| **Me/Knowledge ↔ Insights/Knowledge** | shared hook | `KnowledgeFact[]` + `KnowledgeEdge[]` — `useKnowledge` backs the Tudástár (`/mezo/knowledge`, under Rólad) **and** `/me/knowledge` (graph) — co-design any backend | [`insights.md`](insights.md) §5.1 · [`me.md`](me.md) §5.5 |
| **Cross-system "pattern engine"** 🟣 | Insights ← Train/Sleep/Fuel/Goals | shared stable pattern IDs (`P2`/`P3`) referenced by hand in mock copy across domains — build as a **shared service**, not Insights-local | [`insights.md`](insights.md) §5.4 |
| **`TrendInsight` (lightweight insight)** | embedded in Goals/Sleep | `TrendInsight {type, text}` — a parallel, lighter insight type vs the rich `Pattern`; Phase-3 must reconcile | [`insights.md`](insights.md) §5.3 |
| **Today ↔ Me** | shared object | `UserMeta` — `useProfile` re-exports the same `user` defined in Today's mock; biometrics backend is shared (check-in is a weight/sleep sibling) | [`me.md`](me.md) §5.1 |
| **Journal → Companion** (wired, one-way OUT) | Journal → Companion | `JournalEntrySavedEvent`/`JournalEntryDeletedEvent` — a post-commit AFTER_COMMIT listener writes/removes the entry's `memory_embedding(kind=journal_entry)` vector through the single `MemoryEmbeddingWriter` path; `feature/journal` has no import of `feature/companion` | [`journal.md`](journal.md) §5 · [`companion.md`](companion.md) §4 |

### Domain ↔ platform (every domain rides these)

| Platform seam | What crosses | Doc |
|---|---|---|
| **Data layer** (the hub) | every domain consumes its data **only** via `useX()` from `@/data/hooks`; mock-vs-real via `isMockMode()`; real mode has no static fallback → views ghost-guard | [`_platform-data-layer.md`](_platform-data-layer.md) §6 |
| **API contract & backend** | every backed feature flows `api/feature/<x>.yml` → generated `*Api` + `*Request`/`*Response` DTOs → controller → service → `OwnedRepository` → Postgres; drift = compile error | [`_platform-api-backend.md`](_platform-api-backend.md) §5 |
| **Auth & ownership** | `CurrentUserId.get()` → `CurrentUser` (UUID from JWT subject, status check) → `OwnedEntity.createdBy`, stamped server-side, never in a DTO; `apiFetch` Bearer token from the persisted `tokenStore` | [`_platform-auth-security.md`](_platform-auth-security.md) §5 |
| **Error contract** | `SystemMessage[]` / `SystemMessageList` (stable codes, never resolved text) ↔ FE `ApiError` | [`_platform-api-backend.md`](_platform-api-backend.md) §5 · [`_platform-auth-security.md`](_platform-auth-security.md) §5 |
| **Design system** | `@/shared/ui/**` primitives, `Sheet`, `GhostState`, `--cat-*`/accent tokens, the on-brand-screen idiom; theme via `data-theme` | [`_platform-design-system.md`](_platform-design-system.md) §5 |

**Reading the matrix:** Train is the hub of live cross-domain data (Mai aggregation, records ← sets). Insights is the conceptual hub the others *point toward* (shared `P2`/`P3` pattern IDs, the knowledge graph shared with Me). Fuel is the most cross-coupled **mock** domain (Today preview, medication cycle, replan cascade, Me/Goals context). Everything funnels through the platform data-layer + design-system, and every backed write funnels through auth/ownership.

---

## 5. The doc template

Every feature doc — domain or platform — follows this **canonical 10-section template**. Keep the section numbers and headings stable so the [feature→doc map](#3-feature--doc-map-quick-lookup-by-route-or-sub-feature) and cross-references stay mechanical. Open with a one-line `>` blockquote summary that states the route/tab (or "platform, no route") and a precise per-layer status badge (✅ / 🔶 / 🟣 / mixed). Write in **English**; quote Hungarian UI labels, route names, and domain terms **verbatim**. Link `specs/`, `references/`, `decisions/`, and `roadmap.md` — never duplicate them.

```markdown
# <Feature> — Feature Documentation

> One-line: <what it is> at route `<route>` (tab "<HU label>"). **Status: <✅/🔶/🟣/mixed per layer>.**
> <If platform: the `_`-prefix note — cross-cutting, no route/tab of its own.>

## 1. Summary
What it is, why it exists, status per layer (FE mock / FE real / backend), and the driving
design spec(s) in `docs/superpowers/specs/` (+ ADR if one exists). Be precise about what is
real vs mock vs Phase-3.

## 2. User-facing behavior
The routes/sub-tabs and what the user actually does on each — flows, sheets, scenarios,
empty/ghost states. Quote Hungarian labels verbatim.

## 3. Architecture & data flow
The `view → hook → mock/real → api → backend → db` path (or where it truncates). The
`isMockMode()` seam, key invariants (synchronous mock `initialData`, no-static-fallback
real mode, ghost-guard), and the mock/real mutation flavors. A traced flow diagram helps.

## 4. Data model & API
FE domain types (`data/types.ts`), mock data files, and — if backed — the contract fragment,
endpoints (method + path + returns + status), entities, migrations, mappers. If unbacked,
state "no tables/DTOs/endpoints exist yet" and where the backend will plug in.

## 5. Integrations
The highest-value section: every seam to other features/platform, **bidirectional**, each
naming the **contract** (the type/shape that crosses). Mark 🟣 for mock-today/Phase-3-engine
seams. This section feeds the index's integration matrix — keep it accurate.

## 6. How to use it (consume)
Import-from-`@/data/hooks` examples (never reach into a hook module or `*Api.ts` directly),
the returned shape, ghost-guard + `*Pending` obligations, and pure helpers worth reusing.

## 7. How to extend it
The concrete recipe: contract-first → backend (per `docs/references/*.md`) → migration →
dual-mode hook → both-test-modes-green. Link the references; never restate them. Include the
mock-only extension path where relevant.

## 8. Testing
FE (Vitest + RTL + MSW, both `pnpm test` and `VITE_USE_MOCK=true pnpm test`), and —
if backed — backend ITs (`AbstractIntegrationTest`/`ApiIntegrationTest` + Postgres, populators,
`ResetDatabase`). Name representative tests and the commands.

## 9. Decisions, gotchas & deferred
Key decisions (link specs/ADRs), load-bearing gotchas, and what is explicitly deferred /
Phase-3 (with bd issue ids where they exist).

## 10. Key files
A grouped pointer list (FE views/components, data/hooks, API contract, backend, tests, docs) —
absolute-from-repo-root paths so the next contributor can navigate straight in.
```

**The rule (restated, because it is enforced):** per root `CLAUDE.md` and [`docs/README.md`](../README.md), any new or changed feature — new view/flow, new domain, mock→real hook swap, new sub-feature, or a cross-feature integration — **MUST** add or update its `docs/features/` doc in the same change. If a finished piece of work leaves no trace here of how the feature now works, the work is **not done** — update the doc before closing the `bd` issue.
