# ADR 0010 — Gamified growth: XP is feedback, not payment

- **Status:** accepted · 2026-07-11
- **Driving issue:** mezo-df7q (epic mezo-52vz)
- **Context:** The Phase-3 mapping (roadmap 2026-07-03) parked an "XP-vs-narrative tension":
  the companion philosophy is "a try maga a jutalom" (no FOMO, no penalty), while the old
  Phase-7 idea was a motivation/XP system. The gamified-growth spec
  (`docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md`) now expands XP from
  workouts to daily quests and (E2) life activities, so the tension must be resolved.

## Decision

1. **XP is feedback, not payment.** XP certifies that a real-life action happened; quest copy
   names the real-life benefit first, XP second. No XP-gated content, ever.
2. **Quests are offers.** No accept ceremony, no penalty; an uncompleted quest silently
   expires (status `expired`, no failure styling). One reroll/day preserves autonomy.
3. **Economy proportions guard intrinsic motivation.** Quest XP is 15–40 per quest
   (≈10–15% of weekly XP potential); workouts stay the primary source. Amounts are config
   under `mezo.quest`/catalog, never code.
4. **Traits are computed, never self-claimed.** Discipline/consistency are derived from the
   ledger (E2); there is no "do a discipline" quest.
5. **Ethical boundary.** No loot boxes, no variable-reward gambling, no countdowns, no
   loss-aversion mechanics, never pay-to-win or real money. Coins ship only with a shop (E4);
   XP is never spendable.
6. **One economy.** No parallel player-XP currency: quests/activities feed the same
   `skill_progress` bands (ATHLETIC/MUSCLE now, LIFE from E1's `recovery` onward) through the
   idempotent `award(...)` tail with new sources `QUEST` (and `ACTIVITY` in E2).

## Consequences

- `level_up_event.source_type` CHECK gains `QUEST` (E1) and `ACTIVITY` (E2).
- `skill_progress.skill_kind` CHECK gains `LIFE` in E1 (first LIFE skill: `recovery`),
  because quest XP must not route to `robustness` — the award tail recomputes robustness to
  an absolute streak target and would erase additive quest XP.
- The narrative voice keeps ownership of copy; LLMs may later rewrite quest flavor copy but
  never targets or XP amounts.
