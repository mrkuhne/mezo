# Boop — the home screen and the navigation map (design)

- **Status:** **approved by the owner 2026-11-13** (the ring, round 3; the map, the same day) ·
  **Issues:** `mezo-r36n9.47` (the home screen), `mezo-r36n9.51` (the map), `mezo-r36n9.37` (the shared
  area-page kit that follows from it) · **Epic:** `mezo-r36n9`
- **Amends:** `2026-11-11-boop-standalone-design.md` §3 (the spine's first screen) and
  `2026-11-13-boop-life-dashboard-design.md` §2 decision #3 (*"Terv is the home of the areas"*).
- **Decisions log:** `docs/superpowers/research/boop-standalone/14-decisions.md` #32, #33.
- **Look:** Napkelte (`2026-11-10-boop-napkelte-design.md`) + the photo guideline
  (`2026-11-13-boop-kepek-design.md` §3.3).

## 1. Why there is a map at all

Three home designs were approved separately and each answered *"what do I see first, and where are the
areas"* differently: the **seven-orb ring**, **Terv as the home of the areas**, and **Ma as a living wall**.
Two of them do the same job. The owner settled it: **the ring does what the Terv area grid was invented
for, and the ring's middle leads to the living wall.**

## 2. The map

```
          ┌─────────────────────────────┐
          │  KEZDŐLAP — the ring        │   ← the app opens here
          │  boop                       │
          │     7 area orbs in a circle │ ──► the area's own page (the L0 kit)
          │     Boop's orb in the middle│ ──► Ma
          │     his line for the day    │
          └─────────────────────────────┘
   bottom bar (unchanged, four items + "+"):
   Ma · Terv · Napló · Boop
   Ma    = today (the Nap page now; the living wall of decisions #13/#14 later)
   Terv  = HIS PLAN: the life goal, the diet plan, the training plan — not a second area menu
   Napló = what happened
   Boop  = I ask
```

- **The entrance is the ring.** `Ma` is the bar's first place and the ring is that place's first screen;
  tapping `Ma` in the bar while Ma is already open brings the ring back from anywhere.
- **The seven areas**, clockwise from the top: **Alvás · Étel · Edzés · Energia · Forma · Pénz · Levél**
  (the life-dashboard vocabulary, decision #6 there). Pénz and Levél are not built yet (L4–L6): they sit
  faint and say *"még nem él"* on tap.
- **The middle is Boop's own orb** — a pale luminous pearl, bigger than the seven, no number, with his
  day's verdict in a line under the ring. It opens **Ma**, which is unchanged: the morning brief, the day,
  the proposals. The Nap page was not replaced; it moved one level in.
- **Terv keeps its bar button and changes its job.** This is the one decision the map overturns
  (life-dashboard #3): the areas are the ring's, so Terv is his plan. Nothing reachable today becomes
  unreachable.
- **No fifth bar button** (life-dashboard decision #2 holds): money and mail are areas in the ring and
  rooms behind it, not bar items.

## 3. The home screen itself

**Backdrop.** A photographed misty mountain ridge (`NKPhoto.hegy`, the Forma world's mood photo) filling
the screen under the **cool blue** world's own gradient (Képek §3.3 rule 2) — the lilac wash is gone. Over
the photo, **three bands of drifting fog** (`DriftingFog`), each a pre-blurred strip two screens wide that
slides one width and starts over, so the loop has no seam; one band drifts against the others.

**The ring** (`NKOrbRing`). Seven orbs of 62 pt on a circle, the first at the top and the rest clockwise;
each shows its score inside and its name under it, and breathes on its own phase (`BreathingOrb` — no
motion manager: they are doors, not the hero). The centre is Boop's `LivingOrb` at 122 pt.

**Motion** (every piece has a still branch under Reduce Motion):

| When | What happens |
|---|---|
| The screen opens | Each orb **arrives out of the fog** — blurred, small and invisible, settling into place, Boop's first and the seven following 90 ms apart (`FogArrival`). |
| An orb is tapped | The ring **grows out of that orb** (scale 3.4 at the orb's own point on the screen) and fades, while the area's page cross-fades in over it. The **backdrop does not move** — only the ring layer. |
| Coming back | The area fades out and the ring settles back. The room is **the page itself, with no navigation stack under it**, so nothing slides off sideways first. |

**Performance rules learned the hard way** (round 3, the owner felt every one of them):
1. Never animate a `blur` over the live orbs.
2. Never scale the backdrop: a blurred fog canvas at 6.5× is what the phone could not keep up with.
3. Freeze the orbs for the duration (`NKOrbRing(live:)`, and `BreathingOrb`'s paused timeline holds its
   last frame, so freezing is seamless).
4. Give the incoming page one run-loop turn to be built before anything moves.
5. A room opened from the ring gets no `NavigationStack` (`\.closeRoom` in the environment replaces
   `dismiss()` for its back button).

Simulator review: `-previewHome nap|alvas|etel|edzes|energia|forma` opens the home already moved on;
`-previewSlow 5` runs every arrival and transition five times slower, so a screenshot catches them.

## 4. What this does not change

The bottom bar's four places and the `+`, the Napkelte look, the one voice, the rooms themselves, the
Ma page's content, Napló, Boop, and the B-slice order. The living wall (decisions #13/#14) is still
`L0/b` and is not built here — the middle of the ring opens today's Ma until it is.
