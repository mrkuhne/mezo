# Growth-tab design iteration — round 1 (2026-09-02)

Daniel reviewed the first-ship `growth-tab` prototype (published artifact) and approved it
without a second round — *„jó lesz, perfekt."* This file records **what was decided, why, and
what it means for implementation** — `prototypes/src/growth-head.html` +
`prototypes/src/growth-body.html` (assembled into
[`prototypes/growth-tab.html`](prototypes/growth-tab.html), published as artifact
[`393bca87-9095-42dd-ac55-127162ad0412`](https://claude.ai/code/artifact/393bca87-9095-42dd-ac55-127162ad0412))
are the visual truth; the approved design spec,
[`docs/superpowers/specs/2026-09-02-growth-hub-design.md`](../superpowers/specs/2026-09-02-growth-hub-design.md),
is the implementation contract. Read together with
[`docs/features/growth.md`](../features/growth.md) (the XP-economy backend/frontend ground
truth), [`habit.md`](../features/habit.md) (the Rutin page's real owner), [`me.md`](../features/me.md)
(the Én hub + tile), and `prototypes/README.md` (current final state).

## 1. Brainstorm decisions (IA = A, hero = A, Ma-csík = A)

Three questions were brainstormed before the first prototype pixel was drawn, each with option
**A** picked outright — no B/C variant reached the prototype stage:

- **IA = A — hero + Ma-csík + 2×2 mozaik, minden csempe saját aloldal.** The alternative
  (keep the 4-way segmented control that shipped with `mezo-rmhr`'s `GrowthPage`, just re-skin
  it) was rejected for the same reason the Karakter tab's round 1 rejected an 8-tile hub
  (`2026-08-31-karakter-design-iterations.md` §1): a segmented control hides three-quarters of
  the surface behind a tap and forces one long panel per tab, while a hub + flat sibling routes
  matches the **Fuel**/**Edzés** hub idiom already established by ADR 0032 (dissolved section
  shells → full-page siblings) and ADR 0033 (the Mozaik tile language). Growth was the one
  remaining `/me/*` surface still on the old segmented-control pattern; this round brings it in
  line.
- **Hero = A — XP count-up + Szint/Fegyelem/Ritmus sávok.** The hero keeps the three-trait
  anatomy the segmented-page hero already had (Össz XP + Fegyelem % + Ritmus hét), but the XP
  number **count-ups** on load and **continues** from its last shown value (not 0) after a chip
  tap or a saved activity — the `KeretHero` rAF recipe from Fuel, generalized into
  `useContinuingCountUp` in the shared `mozaik/motion` primitives so both surfaces can use it.
- **Ma-csík = A — küldetés-chipek + `＋ Tevékenység`, a fejléc a `/nap/kuldetesek`-re visz.**
  The alternative (keep the two full `DailyQuestsCard`/`ActivityLogCard` management cards on
  the hub, as the segmented page did) lost to a compact chip-row: today's quests and today's
  activities in one glanceable strip, with the full management surface staying one tap away on
  `/nap/kuldetesek` (where reroll, smart actions, and the honest per-quest state line already
  live). This is the same "hub shows the live datum, the full surface is one tap away" principle
  the tile-anatomy rule already applies everywhere else on Growth's own mosaic.

## 2. v1 prototype

The prototype (`growth-tab.html`, §2–§6 of the handoff walk each page) built the hub + four
pages 1:1 at ×1.18 scale against the phone frame, verified to fit the hub in one ~390px
viewport with no scroll (330px content height against the frame, ~110px of headroom to spare).
Two things the prototype demoed that the approved spec explicitly walked back before
implementation (data-layer reality checks, not aesthetic changes — §3 below covers both in
detail): the Ma-csík's chip-tap was a local `toggle()` demo with no real completion semantics,
and the Rutin page's two counter-tiles were drawn as a **calendar day-grid** with a
milestone-pill + flash animation at 7/30 "perfect days." Both were caught during the spec's
data-layer verification pass (`docs/superpowers/specs/2026-09-02-growth-hub-design.md`
"Codebase terrain" — the "data-réteg ellenőrzés után" notes in spec §2 and §4) rather than in a
second design round, which is why this file records one round, not several: Daniel approved
the *visual and interaction* prototype once, and the spec's own verification pass — not a
Daniel review cycle — is what produced the two implementation flags below.

## 3. Implementation flags (deviation from the prototype)

The spec's own §9 lists five flags; a sixth (the LIFE clay-icon fallback) was pinned during
implementation and is folded in here for completeness. All five/six are PR-description material
— none of them are Daniel-requested changes, all of them are "the prototype demoed something the
real contract can't honestly back yet," resolved the ADR 0010 way (honest state over a fabricated
number) rather than by inventing backend surface.

1. **`PageHero` nincs-alcím szabály.** The Skillek/Rutin/Napló/Kitüntetések hero `sb` subtitle
   line from the prototype (e.g. `három sáv · 8 LIFE · 12 atlétikus · 13 izom`) has nowhere to
   go on the real `PageHero`, which carries no subtitle slot by design (every other Mozaik
   sub-page follows the same rule). The line moved into a `StatStrip` under the hero (Skillek)
   or into the `PageBody principle` line (Rutin/Napló/Kitüntetések) instead of being dropped.
2. **Rutin: a 30 cella egy SZÁMLÁLÓT mutat, nem naptári rácsot; a mérföldkő-pill + villanás
   elmarad.** `HabitSummary` carries only `perfectMorningDays30`/`perfectEveningDays30` (scalar
   counts), no daily bitset — so `GrowthRutinPage`'s two `.gr-covtile` strips fill left-to-right
   by count, with no "today" cell, no day→cell mapping, and no 7/30-day milestone-pill + flash
   (inventing a "consecutive perfect days" streak the contract doesn't carry would violate ADR
   0010's honest-derivation rule). **Follow-up bd issue `mezo-11nm`** tracks widening
   `GET /api/habit/summary` with daily bits + a `perfectStreak` field; once that lands, the real
   day-grid + milestone pill can replace the counter-cells verbatim, prototype-faithful.
3. **Ma-csík: a chip-toggle valós szemantikát kapott.** The prototype's chip tap was a local
   demo toggle with no real completion path. The data layer has **no explicit "done" mutation**
   anywhere in the quest/activity domain — a DERIVED quest closes itself off the logs, never off
   a tap — so the real chip branches on `completionMode`: **`ACTIVITY`** opens the existing
   `ActivityLogSheet` with the quest attached (the same `Naplózz` flow as everywhere else in the
   app); **`DERIVED`** navigates to `/nap/kuldetesek`, where the quest's own honest state line
   (`folyamatban · a logjaidból záródik magától`) and the `Csere` reroll already live. A
   completed or expired chip is never a button — there is nothing to un-complete or retry.
4. **A prototípus lokális `toast`-jai helyett a meglévő sheet-visszajelzés.** The prototype's
   demo toasts (save confirmations, etc.) are replaced end to end by the real `ActivityLogSheet`
   and `DailyQuestsSheet`'s own in-sheet feedback — no new toast surface was built for Growth.
5. **`LV {n}-TŐL` a `🔒` helyett a zárt létra-címeknél.** `GrowthAwardsPage`'s `TitlesSection`
   (re-homed from the retired `TitleShopSheet`) renders a locked ladder title's unlock level as
   text (`LV {n}-TŐL`) rather than a padlock glyph — glossary-consistent with how locked content
   reads elsewhere in the app, and a11y-friendlier than a bare emoji.
6. **LIFE-sorok soha nem esnek vissza emojira** — pinned during implementation, not in the spec's
   own §9 list, but the same honest-derivation family: `LIFE_SKILLS[].clayIcon` is a required
   field (`features/progression/logic/levelUpMeta.ts`), and if a key ever missed the lookup the
   row falls back to the same two-letter-initials treatment the athletic/muscle rows use — never
   the plain-text emoji, which stays data-only (a guard test bans the 8 LIFE emojis from the
   rendered output on every Growth surface).

## 4. Prior art adopted/rejected

Copied from the spec's own "Prior art (researcher)" section — the sourcing and reasoning are
unchanged from the brainstorm-recon pass, reproduced here so this log stands alone as the design
record:

- **Finch — egy élő napi sáv hajtja a hero-t** (deconstructoroffun.com, Finch elemzés): a hub
  egy domináns „ma" állapotot mutat, nem statikus pontszámot. **Átvéve** a hero három sávja + a
  Ma-csík formájában; a kisállat/energia-mechanika **elvetve** (Mezo-hang, ADR 0010).
- **Duolingo mérföldkő-animáció** (blog.duolingo.com/streak-milestone-design-animation): a
  napi pipa csendes, a nagy ünneplés csak mérföldkőnél. **Átvéve**: a Rutin csempe `flash`-e
  7/30 napnál, a streak-sáv; naponta ismétlődő ünneplés **elvetve**.
- **Smashing Magazine, streak-UX (2026/02)**: lánc-rács + számláló, kegyelmi mechanika,
  veszteség-lágyító szöveg („kimaradt — folytatódik"). **Átvéve** a 30 cellás rács és a
  Rutin-copy; „streak mindenre" **elvetve** (a Napló idővonal, nem streak).
- **Duolingo lineáris út** (blog.duolingo.com/new-duolingo-home-screen-design): csomópont-
  állapotok, egység-fejlécek, nincs elágazó fa. **Átvéve**: párhuzamos sáv-kártyák + perk-
  mérföldkő jelzés; a teljes lineáris út **elvetve** (a sávok nem-lineárisan böngészhetők).
- **Strava trófea-vitrin** (support.strava.com/…/the-strava-trophy-case) + Apple Fitness
  awards: teljes rács, a részben teljesített jelvény haladás-gyűrűvel. **Átvéve** a ring;
  a „friss 4" sor **elvetve** (nincs unlock-dátum a kontraktusban).

## Net effect / what's unchanged

- Every XP-economy hook, mutation, and honest-state rule carried over **verbatim** from the
  segmented-page era — this round changed the render layer (hub + flat routes replacing a
  segmented control), not the model. See [growth.md](../features/growth.md) §2/§9 for the full
  before/after and the newly-orphaned `DailyQuestsCard`/`ActivityLogCard` note.
- The Rutin page's data contract and branching (today vs. past day) are unchanged from
  `RoutinesTab`'s — only the shell moved from a segmented panel to its own routed page; see
  [habit.md](../features/habit.md) §2.
- `TitleShopSheet`/`StreakSheet` are not merely re-homed but **deleted** — their content lives on
  in `StreakCard`/`TitlesSection` (`features/progression/components/ProgressionHome.tsx`),
  mounted by `GrowthAwardsPage`, closing the "orphaned sheets" gap the pre-`mezo-rmi0.1` version
  of `growth.md` had flagged.
