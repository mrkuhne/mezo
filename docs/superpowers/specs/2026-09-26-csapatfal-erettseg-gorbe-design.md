# Csapatfal — the real maturity curve ("Így érik a képe rólad") — design

**Bead:** `mezo-a9bo7.11` (epic `mezo-a9bo7`, the programme's last planned item) ·
**Date:** 2026-09-26 · **Status:** owner-approved design (brainstorm 2026-09-26)

## 1. Problem

The character room (A3, `CharacterRoomPage`) draws "Így gyűlik a tudása rólad": the character's
cumulative weekly post count. That was the honest stand-in while no maturity history existed
(ADR 0049). The approved prototype (`uveg-uzenofal.html` `szoba()`) draws "Így érik a képe rólad",
a curve of how ripe the character's picture of the user is, week by week. This slice builds that
curve for real: a weekly per-dimension maturity record, a history read, and the room curve.

## 2. Owner decisions (brainstorm 2026-09-26, do not re-litigate)

1. **Only the new curve.** The post-count curve goes away entirely; the new one replaces it.
2. **Text + dots.** Below 4 weekly points, show an honest line of text plus the discrete dots with
   no connecting line. From 4 points on, draw the line. A missing week breaks the line; it is never
   bridged and never zero-filled.
3. **Quiet caption on a drop.** When the latest point is lower than the previous one, one muted
   line under the curve names the dimension that fell and why. No push, no wall post.
4. **One line per room.** The curve is the mean of the room's dimensions, the same rule as the
   room's maturity ring (`roomMaturity`). The per-dimension detail lives only in the caption.
5. **Live weekly point.** The current week's point is always live ("ez a hét eddig"). A nightly
   job persists it, so it becomes final once the week ends. The curve's last point therefore always
   equals the ring.
6. The owner waived a separate prototype review for this slice ("írd le a tervet aztán mehet a
   végrehajtás és merge és deploy").

## 3. Design

### 3.1 Maturity becomes deterministic (targeted fix)

Today `character_dimension.maturity` is written only by `PortraitWriter` (LLM portrait rewrite),
and it is reset to 0 by the daily council (`CharacterCouncilService`, every touched dimension),
undo/revise (`CharacterClaimRevisionService.invalidatePortrait`) and a new CHAPTER. So the room
ring can sit at 0 for days while the character holds active claims. Snapshotting that column
would record fake drops.

Fix: extract the formula into a pure helper **`MaturityFormula.compute(List<CharacterClaimEntity>)`**
(`min(100, round(20 × activeCount + 40 × meanActiveConfidence))`, 0 for no claims). It is used by:
- `PortraitWriter` (unchanged behaviour; it keeps writing the column that the prompt assembler reads),
- `CharacterService.overview` and `.dimension` — the **read** now returns the formula over the
  dimension's ACTIVE claims instead of the stored column,
- the snapshot and history (§3.2–3.3).

The stored column stays: `CharacterPromptAssembler` keeps gating the portrait digest on it (the
portrait is blanked together with it, so the gate is still coherent). Only reads change.

### 3.2 Storage — `character_maturity_week`

A Kimball periodic snapshot, one row per (owner, dimension, ISO week):

| column | type | note |
|---|---|---|
| `id` | uuid pk | |
| `created_by` | uuid fk app_user, on delete cascade | owner |
| `created_at`, `is_deleted` | | house columns |
| `dimension_id` | uuid fk character_dimension, on delete cascade | |
| `week_start` | date | ISO Monday, Europe/Budapest |
| `maturity` | smallint, check 0..100 | the formula |
| `claim_count` | smallint, check ≥ 0 | active claims at snapshot time |
| `mean_confidence` | numeric(4,3), nullable | null when `claim_count = 0` |
| `updated_at` | timestamptz | last live refresh |

Unique `uq_character_maturity_week` on `(created_by, dimension_id, week_start) where is_deleted=false`.
No filler rows, and no backfill: `character_portrait_revision` stores no maturity, so no history
exists to reconstruct.

### 3.3 Writer — `CharacterMaturityJob` + `CharacterMaturityService.snapshot`

- A nightly cron at `0 55 23 * * *` in zone `Europe/Budapest`. The slot is free: the council ticks
  at 21:00–23:30 and the dawn slots are all ≥ 02:20. It is configured by
  `CharacterMaturityProperties(cron, zone)` under `mezo.character.maturity`.
- Its own switch is `mezo.techcore.cron.character-maturity-job.enabled`
  (`FeaturesConfiguration.CHARACTER_MATURITY_JOB_SWITCH`). The job bean also requires
  `CHARACTER_SWITCH`. No LLM is involved, so it does not need COMPANION. The switch is `true` in
  `application.yml` and `false` in the test properties.
- For each active user (`UserFanOut`), `snapshot(owner, today)` upserts the row for every
  dimension of the owner (CORE, META, CHAPTER) for `weekStart(today)`: find, then update or
  insert. A unique-index race is caught and ignored. The job is idempotent: a rerun overwrites the
  same week, and the Sunday 23:55 run makes the week final. A missed Sunday leaves the week at
  Saturday's value. That is honest: a real, slightly early reading.

### 3.4 Read — `GET /api/character/maturity-history?weeks=8`

- `weeks` must be between 1 and 26 (default 8). Anything else returns 400 `CHARACTER_RUN_RANGE_INVALID`.
- Response `CharacterMaturityHistory { weeks: [ { weekStart, live, dimensions: [ { key, title,
  expertKey|null, maturity, claimCount } ] } ] }`, oldest first.
- Past weeks (`weekStart < currentWeekStart`) come from the table, only for weeks that have rows.
  The current week is always computed **live** by the same formula over the owner's current
  dimensions (`live: true`). That makes the curve's last point equal the ring exactly.
- It is gated by the controller's `CHARACTER_SWITCH` only (read-only, no job dependency). Rows of a
  soft-deleted or retired dimension still show in past weeks, which is the honest picture of that week.

### 3.5 Frontend

- `characterApi.maturityHistory(weeks)`, `useMaturityHistory()` (a `useDualQuery`, re-exported
  from `data/hooks.ts`). In mock mode it returns `{ weeks: [] }`, matching the empty mock overview.
- `logic/teamRooms.ts`:
  - `roomMaturitySeries(history, id): (number|null)[]` — 8 slots aligned to the calendar
    weeks ending with the latest week, null for a week without rows for this room. A room value is
    the mean of the room's dimensions via `characterForPersona(expertKey ?? '')`, the same as
    `dimensionsFor`. The Szkeptikus/self-audit falls outside all five rooms.
  - `maturityDropNote(history, id): string | null` — when the latest room value is below the
    previous non-null one, name the dimension with the largest drop:
    `"{title}: {n} állítás kikerült a képből, ezért halványult."` when its claim count fell,
    otherwise `"{title}: a meglévő állítások bizonyossága csökkent."`.
  - `growthPoints` accepts `(number|null)[]`: min/max over the non-null values, null slots return
    null points.
  - `weeklyGrowth` is removed.
- `CharacterRoomPage` `MaturityWell`:
  - Section title "Így érik a képe rólad".
  - Hint `+N% · 3 hét` (signed) only when the latest and the 3-weeks-earlier slots are both present.
  - Fewer than 4 points: dots only, plus the text "Most kezdtem el hétről hétre feljegyezni, mennyire
    ismerlek — a 4. héttől vonal köti össze a pontokat."
  - 4 or more points: the line and area, broken into segments at null slots, and the latest dot.
  - 0 points: the text only.
  - `matnow` shows the latest value in %. The drop note sits under the well in `.tf-note`.
  - Reduced motion follows the existing `tf-draw` rules.

## 4. Error handling

- A job failure for one user is logged, and the fan-out continues. A failure on one dimension does
  not abort the user's other dimensions.
- The read never 404s: no rows gives only the live current week.

## 5. Testing

- Unit: `MaturityFormulaTest` (empty → 0, cap at 100, rounding).
- Unit: `CharacterMaturityServiceTest` week derivation (Sunday → the same week's Monday).
- IT: the snapshot is idempotent (twice gives one row, updated); the history returns past rows plus
  a live current week; a foreign owner's rows are never returned; `weeks` out of range gives 400;
  the overview maturity equals the formula even after the stored column is zeroed.
- FE: `teamRooms.test.ts` for series alignment, gaps, room mean, and the drop note (both reasons);
  `CharacterRoomPage.test.tsx` for the text, dots-only and line states, and the note.
- Gates: FE in both modes plus build; the character ITs; ArchUnit; the CODEMAP check; the contract drift check.

## 6. Prior art

- **WHOOP / Oura calibration** ([WHOOP](https://support.whoop.com/hc/en-us/articles/360019622573-What-is-the-Recovery-calibration-period-),
  [Oura](https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors)):
  "still learning you" wording and no invented history. Adopted as the tone of the early-weeks text.
- **Garmin HRV status ladder** ([Garmin](https://www.garmin.com/en-US/blog/fitness/understanding-the-hrv-status-on-your-garmin-smartwatch/)):
  gated on the count of observations ("No Status" → average → baseline). Adopted as the
  text → dots → line ladder, gated on the number of points and not on calendar time.
- **Sparse-series honesty** (line interpolation fabricates the gaps; an empty axis
  [looks buggy](https://gitlab.com/gitlab-org/gitlab-ui/-/issues/3137)): adopted as dots before 4
  points and broken segments at missing weeks.
- **Kimball periodic snapshot** ([Kimball](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/)):
  adopted with the grain (owner, dimension, week) and an idempotent upsert. **Rejected:** Kimball's
  dense filler rows, because a gap must stay a gap. Event-sourcing is rejected as overkill for a
  derived score.
- None of the apps surveyed has a "picture ripening" curve, so this is new ground.

## 7. Codebase terrain

- Maturity today: `PortraitWriter.computeMaturity` (`service/PortraitWriter.java:152`) writes it.
  It is zeroed by `CharacterCouncilService.java:123-126`, `CharacterClaimRevisionService.java:95-104`
  and `ClaimLifecycle.java:177`, and restored only by the weekly konzílium. That is why §3.1
  switches reads to the formula.
- Dimension → character: `TeamCharacter.PERSONA` (BE) and `team.ts` `characterForPersona` (FE).
  CHAPTER dimensions (null expertKey) fall to Mezo. Szunya: recovery; Mocor: athletic + discipline;
  Falat: nutrition; Derű: mental + physical; Mezo: life + chapters; self-audit: no room.
- Templates:
  - `team_edition` migration, entity and repository;
  - `CharacterConferenceJob` for the cron job shape (its missing `zone` is an anti-pattern we do not copy);
  - `CharacterService.editions` for the read with range validation;
  - `useTeamEditions` for the dual-mode hook.
- Traps:
  - ArchUnit stereotype packages, and `@Validated` properties records instead of `@Value`;
  - regenerate the CODEMAP in the change and again after the merge;
  - the contract drift gate;
  - `VITE_USE_MOCK` must be explicit in both FE runs;
  - `ResetDatabase` TRUNCATE list gains the table;
  - anchor IT fixtures to the queried week, never to now minus N;
  - `docs/features/insights.md` §rooms and `docs/features/character.md` §4 must be updated.
