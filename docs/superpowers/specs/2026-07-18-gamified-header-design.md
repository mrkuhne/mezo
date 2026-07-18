# Gamified Unified Header (AppHero) + Account Progression — Design

- **Date:** 2026-07-18
- **Driving bd issue:** `mezo-k7rn` (backend fast-follow: `mezo-huzd`, blocked by this)
- **Status:** approved design (brainstorm session 2026-07-18, visual companion mockups B1 + MIX)
- **Scope:** frontend-first on the mock layer; backend-ready hook signatures; no backend changes in this slice

## 1. Problem & goal

Every main tab currently has a different header idiom:

| Tab | Header today |
|---|---|
| Ma | `BrandRow` (Mezo wordmark + search + ✨ Insights link) + daypart `GreetingHeader` |
| Edzés | `.pghead-np` eyebrow + title (coral), inside the leaf page, under `TrainSubNav` |
| Fuel | `.pghead-np sage` + `+ Log` action, inside the leaf page, under `FuelSubNav` |
| Én | `MeHead` (64px initials avatar + name + biometrics line + ⚙️) |

Goal: one shared identity header ("AppHero") on all 4 main tabs, and a light account-wide
progression layer behind it — XP for **everything** the user logs, an account level,
unlockable + purchasable **titles**, a **coin** soft currency, a daily-quest counter and a
**daily streak** counter. The gamification substrate that already exists (skill XP,
athleteLevel, daily quests, badges/perks, LevelUp overlay) is reused, not duplicated.

## 2. Decisions (brainstorm outcomes)

| Decision | Choice | Rejected alternatives |
|---|---|---|
| Delivery | **Frontend-first on mocks**, hook signatures backend-ready | full-stack now; header-only from existing data |
| XP model | **One XP stream**: every XP award credits the account total; existing skill-XP awards count 1:1; new flat XP for logs that award nothing today | separate account ledger; reuse `athleteLevel` |
| Purchasable titles | **New coin soft currency** | spendable XP; unlock-only (no shop) |
| Streak | **Daily streak, any XP-earning log keeps the day alive** | quest-gated daily streak; existing weekly `streakWeeks` |
| Header layout | **B1 identity hero**: XP ring ON the avatar + corner level badge; hero right side free for per-tab utilities | A status strip above existing headers; C one-line fusion; B2 separate XP ring |
| Uniformity | **Fully uniform hero** on all 4 tabs — the Me biometrics line moves out of the header into ProfilePage content | per-tab hero variants |
| Title tone | **MIX**: ladder = serious Hungarian epithets, shop = playful gym-humor | all-serious (T1), RPG ranks (T2), all-humor (T3) |
| Streak safety net | **Streak saver purchasable for coins** (200 🪙, max 2 held, auto-consumed) | free monthly grace day; no saver |

## 3. AppHero — anatomy & mounting

### 3.1 Anatomy (top → bottom)

```
[avatar w/ XP ring + level badge] [name / EQUIPPED TITLE]      [per-tab utilities]
[🔥 {streakDays} nap] [⚡ {done}/{total} quest] [🪙 {coins}]
```

- **Avatar:** initials (as today), 50px, wrapped by a coral **XP-progress ring**
  (progress = `xpInLevel / xpForNext`); replaces the lavender static ring from `MeHead`.
  Corner **level badge** (coral pill, Bricolage). On account level-up the ring completes
  and the existing LevelUp celebration runs.
- **Name:** Bricolage 20px/800. **Title line:** equipped title, lavender-deep, uppercase, 11px/800.
- **Per-tab utilities (prop):** Ma → 🔍 search chip + ✨ `/insights` link (relocated from
  `BrandRow`); Én → ⚙️ settings (relocated from `MeHead`); Edzés/Fuel → none.
- **Stat chips:** surface pills (shadow-row): 🔥 daily streak (amber-deep), ⚡ daily quests
  done/total from `useDailyQuests` (coral-deep), 🪙 coins (sage-deep).
- **Tap targets:** avatar/name → `/me` · ring/level badge → `/me/growth` · ⚡ → `/me/growth`
  (quests section) · 🔥 → `StreakSheet` · 🪙 or title line → `TitleShopSheet`.

### 3.2 Mounting (section level, MeHead precedent)

The hero renders once per tab shell, so **every sub-page of a tab gets it** (exactly how
`MeHead` behaves today):

| Where | Change |
|---|---|
| `TodayPage` | `BrandRow` **removed** (Mezo wordmark intentionally retired); `AppHero` on top; `GreetingHeader` stays below |
| `TrainSection` | `AppHero` above `TrainSubNav`; leaf `.pghead-np` headers unchanged |
| `FuelSection` | `AppHero` above `FuelSubNav`; `FuelMaiPage` header + `+ Log` unchanged |
| `MeSection` | `MeHead` **replaced** by `AppHero`; biometrics line (age · height · weight · BF%) moves into `ProfilePage` content as a small stat row; ⚙️ becomes the hero utility |

Insights (`/insights/*`) and all sub-page headers keep their current idioms — the hero is
a main-tab surface only. Dark mode comes free via the existing token flips.

### 3.3 Component & styling

- `frontend/src/features/progression/components/AppHero.tsx` — lives in the progression
  feature (same reasoning as `LevelUpProvider`): it consumes `@/data/hooks`, so it cannot
  be `shared/ui` (domain-free rule). Utilities arrive as a `ReactNode` prop from each shell.
- CSS: new `.apphero` block in `prototype.css` following the existing idiom family
  (`.mehead` spacing, `.statchip` pills reuse `--np-shadow-row`, ring is inline SVG).

## 4. Data layer — new `data/gamification/` domain

New domain folder (per-domain convention), re-exported through the `data/hooks.ts` barrel:

```
frontend/src/data/gamification/
  gamificationHooks.ts   # useGamification, useTitles, useGamificationActions
  gamificationApi.ts     # real-mode fetchers (interim: derive/ghost — see §8)
  gamificationMock.ts    # seed: profile, titles, coins
  gamificationStore.ts   # mock-mode mutable state + awardGamificationEvent(type)
  xpValues.ts            # XP table + daily caps (pure, unit-tested)
  levelCurve.ts          # xpToNext / levelFromTotalXp (pure, unit-tested)
```

### 4.1 Types (FE, backend-ready shapes)

```ts
type GamificationProfile = {
  level: number
  totalXp: number
  xpInLevel: number
  xpForNext: number
  coins: number
  streakDays: number
  streakSavers: number      // held savers, 0..2
  activeTitleKey: string
  ownedShopTitleKeys: string[]
  lastActiveDate: string | null   // last local-ISO day that earned XP; null = seeded state
  dayCounters: { date: string; counts: Partial<Record<XpEventType, number>> }  // daily-cap bookkeeping (§5.1)
}
type Title = {
  key: string
  name: string
  kind: 'LADDER' | 'SHOP'
  unlockLevel?: number      // LADDER only
  priceCoins?: number       // SHOP only
  owned: boolean
  equipped: boolean
}
type XpEventType =
  | 'MEAL' | 'WEIGHT' | 'SLEEP' | 'CHECKIN' | 'MEDICATION'
  | 'GYM' | 'RUN' | 'SPORT' | 'QUEST' | 'ACTIVITY'
```

### 4.2 Hooks

- `useGamification(): { profile: GamificationProfile, isPending }` — dual-mode read
  (`useDualQuery`; real-mode interim in §8). Quest counts are NOT here — the hero reads
  them from the existing `useDailyQuests(today)`.
- `useTitles(): { titles: Title[] }` — ladder + shop with owned/equipped state.
- `useGamificationActions(): { buyTitle(key), equipTitle(key), buyStreakSaver() }` —
  mutations; mock mode mutates the store, real mode will POST (stubs typed now).

### 4.3 Mock-mode XP awarding (the "everything gives XP" loop)

`gamificationStore.awardGamificationEvent(type: XpEventType, xpOverride?: number)`:
adds XP (respecting §5 caps), updates coins/streak/level, invalidates the gamification
query key, and **emits its own toast** via `toastBus` (level-up > streak milestone >
saver notice > plain XP priority) — it does not return data for callers to fire an
overlay. It also returns `{ leveledUp, newLevel }` for callers that need the raw result.

Call sites (mock-mode mutation hooks; real mode no-ops — the server will award):
meal log, weight log, sleep log, check-in, medication log (fuel/me domains), gym
workout finish, run/sport log (train domain), quest complete (quest domain — uses the
quest's own XP), activity log (uses its `xpAwarded`). Mock state is session-local
(TanStack Query cache), consistent with every other mock domain.

## 5. XP economy

### 5.1 XP values (`xpValues.ts`)

| Event | XP | Daily award cap |
|---|---|---|
| MEAL | 10 | 5× |
| WEIGHT | 10 | 1× |
| SLEEP | 10 | 1× |
| CHECKIN | 10 | 1× |
| MEDICATION | 5 | 3× |
| GYM | 40 | 1× |
| RUN | 30 | 2× |
| SPORT | 30 | 2× |
| QUEST | quest's own `xp` (15–35) | 3 quests/day (existing) |
| ACTIVITY | entry's `xpAwarded` | existing activity rules |

Caps exist to make farming pointless (20 meal logs ≠ 200 XP); the cap counter resets at
local midnight. Values live in one table so tuning is a one-file change.

### 5.2 Level curve (`levelCurve.ts`)

`xpToNext(n) = 80 + 40·(n−1)` — Lv1→2 costs 80 (first success lands on day one), then
linear growth. Cumulative thresholds: Lv5 = 560 XP, Lv12 = 3 080 XP, Lv20 = 8 360 XP,
Lv30 = 18 560 XP. No level cap; titles top out at Lv30 for now.

## 6. Coin economy & daily streak

### 6.1 Coin sources

| Source | Coins |
|---|---|
| Daily quest completed | +10 each |
| All 3 daily quests in a day | +20 bonus |
| Account level-up | +50 |
| Streak milestone 7 / 30 / 100 days | +50 / +150 / +500 |

The two quest rows are **implementation-deferred**: quest completion is DERIVED
server-side (evaluated over already-logged data, never self-claimed — the existing
Growth quest model), so there is no mock-mode "quest completed" event for
`awardGamificationEvent` to hook. These coin awards land with the backend slice
(`mezo-huzd`), which computes them server-side alongside the XP ledger. Every other
row above IS mock-implemented today (level-up + streak milestone coins fire from
`gamificationStore.awardGamificationEvent`).

### 6.2 Coin sinks

Shop titles (§7.2) and the **streak saver**: 200 🪙, max 2 held.

### 6.3 Daily streak rules

- A calendar day counts if **≥1 XP-earning event** was logged that day (any type).
- Missed day: if a saver is held, one is auto-consumed and the streak survives (the
  StreakSheet shows "mentő elhasználva"); otherwise the streak resets to 0.
- Streak state (`streakDays`, `streakSavers`, last-active date) lives in the gamification
  profile; mock mode evaluates rollover lazily on the **first AWARD of the day** (not the
  first read) — a day with no XP-earning log never touches the streak, so simply opening
  the app cannot silently roll it over or burn a saver.

## 7. Title system (MIX)

### 7.1 Ladder — unlocked by account level (serious epithets)

| Level | Title |
|---|---|
| 1 | Az Újonc |
| 3 | A Lendület |
| 5 | A Következetes |
| 8 | A Hajnalmadár |
| 12 | A Fegyelmezett |
| 16 | A Vasakarat |
| 20 | A Mérföldkő |
| 25 | A Gépezet |
| 30 | A Legenda |

### 7.2 Shop — purchasable with coins (playful gym-humor)

| Title | Price |
|---|---|
| Kezdő Kanál | 100 🪙 |
| Csirkemell Csodája | 150 🪙 |
| Kardió Kapitány | 240 🪙 |
| Szénhidrát Szelídítő | 240 🪙 |
| Protein Próféta | 400 🪙 |
| Bicepsz Báró | 400 🪙 |
| Gainz Nagyúr | 600 🪙 |

Ladder titles unlock automatically (never lost); shop titles are one-time purchases.
Exactly one title is equipped at a time; equipping is free and instant (hero updates
immediately). Default at Lv1: "Az Újonc".

## 8. Real-mode interim (until `mezo-huzd` lands)

Real mode must never show mock seeds (dual-mode invariant). Until the backend slice:

- `totalXp` / `level`: **derived** — Σ `cumulativeXp` over the real
  `/api/progression/profile` skill list, fed through `levelFromTotalXp`.
- Quest chip: fully real already (`/api/quest/day`).
- `coins`, `streakDays`, `streakSavers`, titles: **ghost** (0 / empty / default title);
  TitleShopSheet renders a "backend hamarosan" empty state in real mode.
- `awardGamificationEvent` is a no-op in real mode; server-side awarding arrives with
  `mezo-huzd` (XP ledger, coin awards, streak computation, titles — contract-first
  `api/feature/gamification` fragment; FE hook signatures unchanged).

This mirrors the sanctioned `useProfile` name exception (mezo-lfw): documented,
temporary, invisible to the hook consumers.

## 9. Sheets & feedback

- **`TitleShopSheet`** (`features/progression/sheets/`) — bottom sheet, app sheet pattern;
  two segments: *Létra* (ladder list with lock states + unlock levels) and *Bolt* (shop
  titles + streak saver, price chips; disabled when coins are insufficient); any owned
  title is equippable from either segment. Coin balance pinned in the sheet header.
- **`StreakSheet`** — bottom sheet: current streak, next milestone + coin reward, saver
  count + buy button (shares `buyStreakSaver`). The "mentő elhasználva" notice does
  **not** live here as sheet-internal state — it surfaces as the award engine's own
  info toast at the moment the saver is auto-consumed (see the XP toast bullet below);
  the sheet itself only shows the current saver count + the buy affordance.
- **XP toast** — the award function (`awardGamificationEvent`) emits exactly ONE toast
  per award via the shared `toastBus`, in priority order: **level-up** (`🎉 Szint N —
  +50 🪙`) > **streak milestone** (`🔥 N napos sorozat — +M 🪙`) > **saver notice**
  (`🧊 Streak-mentő elhasználva — a sorozat megmaradt`) > **plain XP** (`+N XP`).
  **Amendment (implementation finding):** account level-up celebrates via this success
  toast (`🎉 Szint N — +50 🪙`), **not** the existing LevelUp overlay. The existing
  `LevelUpScreen` stays reserved for skill/quest/activity level-ups: its layout is
  gains-driven, and an account-level payload with empty `gains` would render the
  "no level-up" headline instead (`LevelUpScreen.tsx:61`).

## 10. File map (planned)

```
NEW  frontend/src/features/progression/components/AppHero.tsx (+ .test.tsx)
NEW  frontend/src/features/progression/sheets/TitleShopSheet.tsx (+ .test.tsx)
NEW  frontend/src/features/progression/sheets/StreakSheet.tsx (+ .test.tsx)
NEW  frontend/src/data/gamification/{gamificationHooks,gamificationApi,gamificationMock,
       gamificationStore,xpValues,levelCurve}.ts (+ tests)
EDIT frontend/src/data/hooks.ts                      # barrel re-exports
EDIT frontend/src/features/today/pages/TodayPage.tsx  # BrandRow → AppHero(+🔍✨)
EDIT frontend/src/features/train/pages/TrainSection.tsx
EDIT frontend/src/features/fuel/pages/FuelSection.tsx
EDIT frontend/src/features/me/pages/MeSection.tsx     # MeHead → AppHero(+⚙️)
EDIT frontend/src/features/me/pages/ProfilePage.tsx   # biometrics stat row moves here
EDIT mutation hooks (meal/weight/sleep/checkin/medication/train/quest/activity) → award calls
EDIT frontend/src/styles/prototype.css                # .apphero block
DEL  frontend/src/features/today/components/BrandRow.tsx
DEL  frontend/src/features/me/components/MeHead.tsx
```

## 11. Testing & gates

- Unit: `levelCurve` (curve values, level boundaries), `xpValues` (caps, midnight reset),
  streak rollover incl. saver auto-consume.
- Component: AppHero renders on all 4 tab shells with correct utilities and not on
  Insights; tap targets navigate/open sheets; TitleShopSheet buy/equip flows incl.
  insufficient-coins disabled state; ghost rendering in real mode (dual-mode guard).
- Both-mode gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

## 12. Docs to update (same change)

`docs/features/growth.md` (account progression, titles, coins, streak), `today.md`,
`train.md`, `fuel.md`, `me.md` (header + file maps), `_platform-design-system.md`
(AppHero pattern), `_platform-data-layer.md` (new domain). Run `node scripts/lint-docs.mjs`.

## 13. Out of scope

- Backend implementation (→ `mezo-huzd`), including any Liquibase/API work
- Avatar image upload (initials stay; identity backend still doesn't exist)
- Hero on Insights or sub-pages; changes to sub-page headers
- Coin sinks beyond titles + streak saver; XP for retroactive/imported data
- Push/notification nudges for streak danger
