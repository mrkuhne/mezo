# Me · Growth Page — Design

**Date:** 2026-07-12 · **Status:** validated in brainstorm (browser mockups, variant B approved) · **Driving issue:** set at plan time (child of the shipped gamified-growth work, umbrella `mezo-52vz`)

**Approved mockup:** [`2026-07-12-growth-page-mockup.html`](2026-07-12-growth-page-mockup.html) (variant B, all skills, no radar diagrams).

## 1. Summary & intent

A dedicated **Growth** page under the Me section: the single home of the whole XP universe — every skill of all three bands, XP, computed traits, savings, a 30-day quest+activity journal, and achievements (computed badges + the existing perk milestones). The Profile tab's three progression cards (athletic radar, muscle levels, LIFE GrowthCard) are **replaced by one compact summary card** that links here; **radar diagrams retire from the app entirely** (user decision — "engedjük el a diagramot").

## 2. UX structure (per the approved mockup)

- **Navigation:** new `Growth` item in the Me subnav, right after `Profil` (`/me/growth`). The Profile summary card also tap-throughs here.
- **Page skeleton:** page header (ME · GROWTH) → **hero stat trio** (always visible): `Össz XP` (sum of cumulativeXp across ALL skills, FE-computed from the profile response) · `Fegyelem` (`traits.disciplinePct`, `–` when null) · `Ritmus` (`traits.consistencyWeeks` hét) → **segmented control** with three states (local component state, `Skillek` default).
- **Skillek tab:** three band cards, each listing ALL skills sorted by (level desc, cumulativeXp desc); row = icon · HU name · `Lv n` · progress bar (progressPct) · cumulative XP (mono, tertiary, hu-HU grouped). Card header chips: LIFE `8 skill · {sum} XP`; Atlétikus `12 skill · átlag {athleteLevel}`; Izom `13 izom · legjobb Lv {max}`. The LIFE card's footer row is `Megtakarítás (30 nap)` (hidden when null/0, same rule as today). The Izom card's footer is the existing "legtöbb tartalék" line. Icons: LIFE from `LIFE_SKILLS`, athletic from `ATHLETIC_META` (exported), muscle 💪.
- **Napló tab:** one card, "Utolsó 30 nap", header chip `{completed} ✓ · {expired} — · {activities} ✎`. Day groups descending (`Ma · Júl 12`, `Tegnap · …`, then `Júl 10`…), each with a right-aligned day XP total. Entries: quests (✓ success-green when completed — incl. "tevékenységgel teljesült" sublabel when `sourceActivityId` present —, `—` quaternary + "csendben lejárt" when expired, XP `0`), activities (✎ brand-glow, skill icon+name sublabel, `amountHuf` appended for financial). Offered (still-live) quests are NOT shown — they live on Today. Fixed 30-day window in v1, no pagination (the trailing "továbbiak betöltése" affordance from the mockup is dropped in v1 — YAGNI).
- **Kitüntetések tab:** two cards. (1) `Badge-ek` — 3-column grid of the 9 computed badges: achieved = brand border/tint + ✓; unachieved = progress bar + `current / target` mono caption; never-startable states don't exist (all 9 always visible). **No unlock dates in v1** (badges are derived on read, there is no unlock ledger — a deliberate deviation from the mockup's `✓ Júl 11` labels; a persistent achievement table with dates + celebration overlay is a recorded future upgrade). (2) `Perkek — mérföldkövek` — the user's unlocked perks (name, effectCopy, `SKILL · LVn` tag), newest first, header chip `{n} feloldva`.

## 3. Badge catalog (computed on read, no new tables)

| key | icon | HU name | achieved when | progress shown |
|---|---|---|---|---|
| `first_quest` | 🏁 | Első küldetés | ≥1 completed daily quest (all-time) | — |
| `quests_10` | 📜 | 10 küldetés | ≥10 completed | current/10 |
| `quests_50` | 🎖️ | 50 küldetés | ≥50 completed | current/50 |
| `first_activity` | ✍️ | Első tevékenység | ≥1 activity-log entry (all-time) | — |
| `rhythm_4w` | 🔥 | 4 hetes ritmus | `consistencyWeeks` ≥ 4 | current/4 |
| `all_life_active` | 🌈 | Mind a 8 LIFE aktív | all 8 LIFE skills cumulativeXp > 0 | active/8 |
| `life_lv5` | 🧠 | LIFE Lv 5 | best LIFE skill level ≥ 5 | best/5 |
| `life_xp_10k` | 🏛️ | 10 000 LIFE XP | Σ LIFE cumulativeXp ≥ 10 000 | current/10000 |
| `savings_100k` | 💰 | 100k megtakarítás | Σ financial amountHuf (all-time) ≥ 100 000 | current/100000 |

Deterministic, retroactive (a returning user's history counts), zero migration cost. The catalog lives in backend code (an ordered list in the achievement service — 9 entries don't warrant a JSON master file).

## 4. Data & backend architecture (contract-first, no DDL)

**Reused as-is (no backend change):** `GET /api/progression/profile` already carries everything the hero + Skillek tab needs (athletic/muscle/life SkillLevel lists with kind/level/cumulativeXp/progressPct, traits, savingsHuf30d).

**New reads (3 endpoints, all owner-scoped, honest-empty arrays):**

1. `GET /api/quest/history?from={date}&to={date}` (tag Quest) → `QuestResponse[]` — non-rerolled quests in the inclusive range, newest date first. Repository: new derived finder `findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc`.
2. `GET /api/activity/history?from={date}&to={date}` (tag Activity) → `ActivityResponse[]` — entries in range, newest first. Repository: E3's `findByCreatedByAndOccurredOnBetween` + ordering.
3. `GET /api/progression/achievements` (tag Progression) → `AchievementsResponse { badges: BadgeResponse[], perks: PerkUnlockResponse[] }`.
   - `BadgeResponse { key, icon, name, achieved, current (int64), target (int64) }` — current/target also populated for achieved badges (FE shows ✓ only).
   - `PerkUnlockResponse { perkKey, name, effectCopy, skillKey, milestoneLevel, unlockedAt }` — from `perk_unlock` joined with the `PerkCatalog` content (name/effectCopy); newest first.
   - New `AchievementService` in `feature/progression`: badge inputs via the EXISTING seams — `QuestLedgerSource.closedQuestStats` (wide all-time range) for quest counts, `ActivityLedgerSource.stats` (wide range) for activity count + all-time savings, `TraitCalculator.traits(...)` for consistency, `SkillProgressRepository` for LIFE levels/XP; both ports via `ObjectProvider` (switch-off ⇒ those badges report current=0, honest). No new ports, no cycles.

**FE data layer:** `useQuestHistory(from,to)` in `data/quest/questHooks.ts`, `useActivityHistory(from,to)` in `data/activity/activityHooks.ts`, `useAchievements()` in `data/progression/progressionHooks.ts` — all `useDualQuery`, barrel-exported, deterministic mock seeds + MSW defaults (history: small representative sets; achievements: mirror the mockup's 4/9 state). Journal merging/grouping/day-totals = pure function `buildGrowthJournal(quests, activities)` in `features/me/logic/growthJournal.ts` (colocated unit tests).

## 5. Profile consolidation (radars retire)

- `ProfilePage`: `AthleticRadarCard` + `MuscleLevelsCard` + `GrowthCard` are replaced by ONE `GrowthSummaryCard` (tap → `/me/growth`): compact card with the hero trio (Össz XP · Fegyelem · Ritmus), athlete-level + streak line, top-3 skills across all bands (icon + name + Lv), and the savings row when >0. Ghost state when no XP anywhere (prompt mirrors today's ghost copy).
- **Deleted** (git history keeps them): `AthleticRadarCard.tsx`, `GrowthCard.tsx`, `features/me/logic/radarGeometry.ts` (+ their tests, + the now-unused `.progress-radar-*` CSS block). `MuscleLevelsCard` is also deleted — its content lives on in the Growth page's Izom band card. `docs/features/me.md` + `growth.md` updated accordingly.

## 6. Testing

- **Backend:** ITs per new endpoint (history ranges: inclusive bounds, rerolled excluded, owner-scoped; achievements: a seeded matrix asserting achieved flags + current/target math for at least first_quest/quests_10/all_life_active/savings_100k; switch-off honesty for port-dependent badges).
- **FE:** both vitest modes green; `buildGrowthJournal` unit tests (grouping, day totals, HU day labels Ma/Tegnap, financial sublabel); page/tab tests (segmented switching, all-band rows render, badge grid states, perk list); GrowthSummaryCard test (+ ghost); MeSubNav/router test updates; deleted-card test cleanup. Visual verification in the running app (house rule).

## 7. Decisions log (brainstorm 2026-07-12)

1. Variant **B** (segmented Skillek/Napló/Kitüntetések) over single-scroll dashboard and hero-radar variants — **user choice on browser mockups**.
2. **All skills listed, radar diagrams dropped app-wide** — user choice; Profile consolidates to one compact summary card linking to `/me/growth`.
3. Achievements v1 = **computed badges + existing perks**, derived on read, no new tables; unlock dates deferred to a future persistent-achievements upgrade.
4. Journal = fixed **30 days**, quests + activities merged client-side from two per-domain history endpoints; no pagination in v1.
5. Hero `Össz XP` computed on the FE from the profile response (no backend change).
