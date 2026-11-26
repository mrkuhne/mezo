# Boop — hiányzó kiegészítő mozgások jelzése a blokképítőben (coverage hints)

**Date:** 2026-11-25 · **Issue:** `mezo-r36n9.114` · **Status:** short design (owner: „mehet a hiányjelzés a
blokképítőben”), owner OK on spike + design („Jó, építsd”, 2026-11-25) · Parent programme: personalised exercise selection (`mezo-r36n9.66`, spec
`2026-11-17-boop-gyakorlatvalasztas-design.md` §6.4 — this doc supersedes its placement) and the full block builder
(#60). Owner decision **#59**: hint **and** a one-tap add.

## What he gets
On the block builder's **Izmok** tab, a muscle card whose week lacks a complementary movement carries a quiet hint box:
a one-line verdict, a „miért?” with one or two plain sentences, ONE proposed exercise (the familiar small card with
photo, sub-muscle and a fixed-phrase reason) placed on a named day with its prescription, and **Hozzáadom** /
**Mást választok**. It is advice: it never turns on „Igazítsd a sávba”, never blocks saving, and is silent for
*Tartás* muscles and muscles the block does not train. Added rows behave like any added row (undo, Mentés).

## Rules (pure, server-side, table-tested)
Evaluated per coarse group over the draft week, from each row's catalogue `pattern` (custom rows count as unknown,
never as a gap):

| Group | Has | Missing → hint | Proposed pattern |
|---|---|---|---|
| Combhajlító | `hinge` | no `knee-flexion` | knee-flexion |
| Combhajlító | `knee-flexion` | no `hinge` | hinge |
| Comb | `squat` / `lunge` | no `knee-extension` | knee-extension |
| Hát | `vertical-pull` | no `horizontal-pull` | horizontal-pull |
| Hát | `horizontal-pull` | no `vertical-pull` | vertical-pull |
| Bicepsz | (work only as a secondary of pulls) | no `elbow-flexion` row | elbow-flexion |
| Tricepsz | (work only as a secondary of presses) | no `elbow-extension` row | elbow-extension |
| Váll | `vertical-push` | no `raise` for shoulder-side | raise (shoulder-side) |
| Mell | pressing only | no `fly` | fly (lowest priority) |

At most one hint per group (the first matching row of the table); at most three cards show a hint (priority order of
the table). Wording: fixed Hungarian phrases per rule — no digits, no „legjobb”, no coach names, no study figures.

## The proposal
- Exercise: the existing ranker over catalogue rows of the target pattern in that group (gym profile, discomfort
  history, goal, trackability — `rankForTokens`-style), top one; none available → the hint says so and offers
  „Mást választok”.
- Day: among the draft days that already train the group, the one with the shortest estimated session; if none, the
  training day with the shortest session. Prescription from the style (as the add sheet does).

## Shape
- Server: a pure `CoverageRules` + a thin service behind a new read on the block (draft days in, findings with the
  proposed exercise/day/prescription out) — kept OUT of the plan evaluator, whose files belong to `mezo-r36n9.113`.
  Contract-first in `train.yml` (one writer at a time).
- Phone: `BlockBuilderModel` asks for coverage together with the evaluation (debounced, same draft); `BuilderMuscleCard`
  renders the hint box; Hozzáadom → `BlockDraft.add(day:catalog:prescription:)`; Mást választok → the add sheet with
  that sub-muscle pre-picked. Offline / failure: no hint (silent), never an error on the card.

## Left out
Persisting a dismissal („Most nem”), compound/isolation ratios, history-based balance (what was logged), the weekly
review deck.

## Approved look
Spike branch `spike/boop-hianyjelzes` (`ios/Boop/HianyDemo/`), screenshots `assets/hianyjelzes/1-lista … 6-kicsi.png`:
the glance line under the body map („2 hiányzó kiegészítő mozgás ›”, jumps to the next card with a hint; such a
muscle shows as an empty ring in the dot strip); the hint box (thin outline, „KIEGÉSZÍTŐ MOZGÁS”, „miért?” top-right,
verdict sentence, one proposal card with day + prescription, **Hozzáadom** / **Mást választok**); after adding, the
box is replaced by „Hozzáadva <nap>hoz · visszavonom”; never turns on the main button. The spike's free-text reason
on the proposal card is replaced by the fixed phrase set.

## Kész, ha…
- Izmok cards show the hint per the rules table, at most one per group, at most three overall; silent for Tartás,
  untrained groups and custom-only rows; the glance line counts them and jumps; dot strip ring.
- Hozzáadom adds the proposed exercise to the named day with the style prescription (draft add → Mentés enables),
  undo line works; Mást választok opens the add sheet pre-filtered to the target sub-muscle; no hint → nothing shown;
  failure/offline → silent.
- Server: pure rules table-tested (each rule both directions where applicable, Tartás silence, custom rows unknown,
  caps), service IT (draft in → findings with exercise/day/prescription; gym profile filters; none available →
  finding without proposal), contract-first, ArchitectureTest; phrases guard (no digits/„legjobb”/names).
- 375 pt and reduced motion; BoopKit + Boop tests; backend focused ITs; codemap; lint-docs 0/0.
- Shipped: merged, deploy green + version live, installed on the phone; handbook 16 + boop-ios.md + train.md;
  release row; Notion check 0.
