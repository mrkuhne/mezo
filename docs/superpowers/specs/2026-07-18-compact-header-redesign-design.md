# Compact Single-Row Header (AppHero v2) + SubNav Dropdown — Design

- **Date:** 2026-07-18 (afternoon — same-day redesign of the morning AppHero spec)
- **Driving bd issue:** `mezo-ugqb`
- **Status:** approved design (brainstorm session 2026-07-18, visual companion: layout option A + popover dropdown)
- **Scope:** frontend-only; no data-layer or backend changes (all hooks unchanged)
- **Supersedes (visually):** the header anatomy of
  `2026-07-18-gamified-header-design.md` §3.1. That spec stays authoritative for the
  progression substrate (XP, coins, titles, streak, sheets); only the header's layout
  and the sub-nav idiom change here.

## 1. Problem & goal

The morning AppHero shipped as three stacked bands: hero row (62px avatar + name/title),
a chip row (🔥 x nap · ⚡ d/t quest · 🪙 n), and the per-section `.np-pills` sub-nav row.
Together ~150px before content starts — too tall, and the pill row duplicates a whole
band that a compact dropdown can replace.

Goal: **one avatar-height header row** on every section, counters inline with the
avatar (numbers only, no labels), the sub-nav pills replaced by a **dropdown in the
header**, and a **separator line** marking where the header ends and content begins.

## 2. Decisions (brainstorm outcomes)

| Decision | Choice | Rejected alternatives |
|---|---|---|
| Row composition | **A — everything stays, dense**: avatar + name/equipped title + inline counters + right slot | B location-first (name out, subpage title as dropdown); C counters under the name (title out) |
| Dropdown pattern | **Anchored popover** under the chip, dim backdrop, ✓ on active | full-width "shade" panel; bottom sheet (existing Sheet primitive) |
| Scroll behavior | **Whole header sticky** (top: 0); separator = the sticky edge | scrolls away; auto-hide on scroll-down |
| Scope | **All 5 sections** — Ma, Edzés, Fuel, Én, **Insights included** (its `pghead-np` header retired) | main-4 only (morning spec's boundary) |
| Me settings ⚙️ | **Menu item at the bottom of the dropdown** (separator + "Beállítások") | icon squeezed into the row |
| Counter labels | **Emoji + number only** (🔥 0 · ⚡ 1/3 · 🪙 0); full text stays in `aria-label` | keep "nap"/"quest" words |

## 3. AppHero v2 — anatomy

```
[avatar 48px: XP ring + level badge] [Daniel ⏎ AZ ÚJONC]   [🔥 0  ⚡ 1/3  🪙 0] [Gym ▾]
──────────────────────────────── 1px var(--line) separator ────────────────────────────
```

Single flex row, height = the avatar ring (48px) + minimal vertical padding (~8px
top/bottom → ~64px total incl. separator).

- **Avatar block:** ring shrinks 62→48px (`RING_R` 28→22, stroke 3.5→3), initials
  avatar inside, corner level badge (16px). Tap targets unchanged: avatar/name → `/me`,
  ring badge → `/me/growth`.
- **Identity column:** name (Bricolage, ~16px/800 — down from 20px so two lines fit
  the 48px column) over equipped title (11px/800 uppercase lavender, tap →
  `TitleShopSheet`). Both lines must fit inside the avatar height.
- **Inline counters** (replace `.apphero-chips`): plain emoji+number text buttons,
  right-aligned before the nav slot, colors as today (🔥 amber-deep, ⚡ coral-deep,
  🪙 sage-deep). Tap targets unchanged: 🔥 → `StreakSheet`, ⚡ → `/me/growth`,
  🪙 → `TitleShopSheet`. `aria-label`s carry the full wording (pl. "0 napos sorozat",
  "1/3 napi quest", "0 érme").
- **Right slot** (existing `utilities` prop, unchanged API): each section passes either
  its `SubNavDropdown` or its utility icons (see §5).
- **Separator + sticky:** `.apphero` gets `position: sticky; top: 0`, opaque
  `var(--canvas)` background, `border-bottom: 1px solid var(--line)`, z-index above
  content (the retired `.np-pills` was z-5; reuse that layer). Leaf-page headers
  (`.pghead-np`, `.page-header`) scroll under it unchanged.

## 4. `SubNavDropdown` — the new primitive

`frontend/src/shared/ui/SubNavDropdown.tsx` — domain-free (no `@/data/*` imports,
serves 4 sections → `shared/ui` is the correct layer per the conventions).

- **Props:**
  ```ts
  {
    label: string                       // aria-label of the nav ("Train alnavigáció")
    items: Array<{ to: string; label: string; end?: boolean }>
    extraAction?: { label: string; icon?: ReactNode; onSelect: () => void }
    accent?: string                     // CSS color value for the active item / chip
  }
  ```
- **Chip (closed):** pill showing the ACTIVE item's label + caret (`Gym ▾`); active =
  the item whose route matches (same `NavLink`/`end` semantics as the old pills,
  resolved via `useLocation` + `matchPath`). Section accent colors the chip text.
- **Popover (open):** small panel anchored under the chip (right-aligned), dim
  backdrop, one row per item (`NavLink`, navigating closes it), ✓ suffix + accent
  color on the active row. `extraAction` renders after a separator as a button row
  (Me: "⚙️ Beállítások" → opens `SettingsSheet`).
- **Behavior/a11y:** `aria-expanded` + `aria-haspopup="menu"` on the chip,
  `role="menu"`/`menuitem` in the panel, Escape + backdrop tap + outside click close,
  focus returns to the chip on close. No new dependency — hand-rolled like `Sheet`.
- **CSS:** new `.subnav-dd` block in `prototype.css`; the popover reuses the sheet
  surface tokens (`--surface-1`, `--line`), accent arrives as `--subnav-accent`.

## 5. Mounting per section

| Section | Right slot content | Notes |
|---|---|---|
| `TodayPage` | 🔍 search chip + ✨ `/insights` link (as today) | no sub-pages → no dropdown; `GreetingHeader` stays in content |
| `TrainSection` | `SubNavDropdown` (items from `TRAIN_TABS`, coral accent) | `TrainSubNav` deleted |
| `FuelSection` | `SubNavDropdown` (existing Fuel list, sage accent) | `FuelSubNav` deleted; the Fuel SUBNAV array moves into `FuelSection` |
| `MeSection` | `SubNavDropdown` (Me list, lav accent, `extraAction` = ⚙️ Beállítások → `SettingsSheet`) | `MeSubNav` deleted; ⚙️ leaves the row |
| `InsightsSection` | `SubNavDropdown` (`visibleInsightsTabs()`, lav accent) | **new**: AppHero replaces the `pghead-np` big header + `InsightsSubNav`; leaf pages gain no new titles — the chip carries location. `InsightsTab.title` loses its only consumer → drop the field |

`/train/session` is a **sibling** route of the sections (`router.tsx:63`), not a child
— the full-screen workout view stays header-free. AnchorMode on Today is untouched
(AppHero placement inside `TodayPage` doesn't move).

## 6. Deletions

- `TrainSubNav.tsx`, `FuelSubNav.tsx`, `MeSubNav.tsx`, `InsightsSubNav.tsx` + their tests
- `.np-pills` / `.np-pill` CSS block (`prototype.css:1290–1294` + dark override) — the
  4 sub-navs are its only consumers (verified by grep)
- `.apphero-chips` / `.apphero-chip` CSS block (chips merge into the row as text buttons)
- `InsightsSection`'s `pghead-np` header markup + the `INSIGHTS_TABS[].title` field

## 7. Testing

- `AppHero.test.tsx`: single-row render, label-less counter texts + full `aria-label`s,
  unchanged tap targets (avatar/badge/🔥/⚡/🪙/title), sticky class present.
- New `SubNavDropdown.test.tsx`: closed chip shows active label; open lists all items;
  active gets ✓; navigation closes; Escape/backdrop close; `extraAction` renders after
  separator and fires `onSelect`.
- Per-section: the 4 section shells mount AppHero with the right dropdown items/accent
  (replaces the deleted `*SubNav` tests); `insights.nav.test.tsx` + `navigation.test.tsx`
  updated for the dropdown idiom; Me: settings opens via the menu item.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.

## 8. Docs to update (same change)

`_platform-design-system.md` (AppHero pattern + new SubNavDropdown primitive + np-pills
retirement), `today.md`, `train.md`, `fuel.md`, `me.md`, `insights.md`, `growth.md`
(header anatomy + file maps). Run `node scripts/lint-docs.mjs`.

## 9. Out of scope

- Any data-layer/backend change (hooks, gamification substrate — morning spec's §4–§8
  stand as-is)
- Auto-hide scroll behavior (rejected; may revisit if the sticky row feels heavy)
- Avatar image upload; changes to leaf-page content headers
- Bottom `TabBar` (unchanged)
