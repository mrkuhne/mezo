# Train Titanium T10 — Plan library pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Edzéstervek library speaks Titanium — the Most fut / Következnek / Új terv
landing with its two doorways, a refaced Sablonjaid list + a read-first template story page,
a Lezárt futamaid list, and the closed-run report enriched with the star hero and the
then-vs-now-against-the-active-plan block — all over EXISTING endpoints; plus the carried
T9 residue sweep (`mezo-obqw3`).

**Architecture:** pure FE slice. Stars for a closed run are FE-DERIVED from the report's
real `completionPct` (the delivery share) through the shipped `starsFor` halves math — no
contract change, no invented backend field. Two new read-first routes
(`train/templates/:id` story, `train/mesocycles/futamok` list) layered over
`useMesoTemplates`/`useMesoReport`/`useTrain`; the konyvtár landing and templates list
reface in place. The then-vs-now block composes client-side (the `mesoCompare.ts`
precedent). New CSS is the prototype's library `pl-` families ported fresh.

**Tech stack:** React + RTL, prototype.css `pl-` extension (registered), pure logic modules
with table tests.

**Driving artifacts:** prototype `plan-pages.js:335-566` + `plan-state.js:161-222` +
`plan.css:443-688`, recon `t10-recon.md` (2026-09-16, verified anchors), bd `mezo-88iwa.11`
(+ the könyvtár-reface note), `mezo-obqw3` (residue), branch `feat/train-titanium-library`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **No contract change.** Stars/say are derived from real wire data only:
  `stars = starsFor(completionPct/100)` (import from `logic/cerScore.ts` — one star math),
  the verdict sentence from a delivery ladder over the same share. Every derived figure's
  copy names its source ("a teljesített edzések aránya"); missing report data = em dash.
- **Honesty:** the closed-run "összsúly" fact renders ONLY if the report carries a real
  volume figure (check `MesocycleReportResponse` — if no total-volume field exists, the
  fact is omitted, never invented); muscle journeys draw start→peak from the report's real
  per-muscle data; then-vs-now compares the CLOSED run's peak sets to the ACTIVE meso's
  current-week sets per shared muscle (client-side, `useMesoReport` + `useTrain`), reusing
  the shipped `.pl-versus` family.
- **Design:** posters + `.pl-lhero` hero with the back pill docked in-hero (option A);
  reveal-on-scroll idiom of the sibling pl- pages; clay icons never emojis; star rows via
  the shared sprite; down/incomplete never red; `ArchivedMesoCard`'s no-nested-button
  constraint honored on any card with footer actions.
- **CSS:** new families ported `pl-`-prefixed into the EXISTING `terv titanium` section (or
  a clearly-marked `terv library` sub-block inside it): `.pl-lib*`, `.pl-lhero*`,
  `.pl-stars`, `.pl-tpl-*`, `.pl-row`; the prototype's `.wz-load` bars port renamed
  `.pl-wload*`; add the missing `.pl-mrow-art` rule (residue item 5). Structure-test
  assertions extended; collision grep as a named gate.
- **Copy:** Hungarian, jargon ban (blokk→terv etc.) in ALL NEW copy. The kalauz fogalom
  card "A blokk a motor." stays untouched (in-file ruling from the T9 review,
  `tutorial/registry/train.ts:258-262`) — the open owner question is recorded in the PR
  body, not resolved here.
- **Residue sweep discipline:** every deletion grep-verified on the current tree first
  (line anchors drifted — recon has the corrected ones); conservative in doubt.

Verified anchors: prototype `plan-pages.js:335-389` (planLibrary), `:393-416`
(templateCard/closedCard), `:418-452` (the two list pages), `:456-515` (template story),
`:519-566` (closed-run story incl. `.pl-versus` then-vs-now), `plan-state.js:161-222`
(LIBRARY shape + closedShare); production `MesoKonyvtarPage.tsx` (DS-era face; skeleton
gate :48; kalauz anchor :102), `MesoTemplatesPage.tsx` (DS face; `train.nav.test.tsx` pins
its shell), `MesoTemplateEditorPage` (raw editor, stays), `MesoReportPage.tsx` +
`mesoReportHooks.ts:19,50-56` (fixtures + synthesizer), `MesoComparePage` +
`logic/mesoCompare.ts` (client-side composition precedent), `train.yml:2302-2394`
(`MesocycleReportResponse` — NO stars; `completionPct` is the share),
`router.tsx:280-313` (route order — `:id/report` and `compare` before `:id`),
`prototype.css` pl- block `~14680-15060` (ported through `.pl-versus*`; `pl-lib/lhero/
stars/tpl/row/wz-load` all 0 hits), residue anchors: dead `.mz-w*` `:8877-8906`, six
unused pl- families (re-verify `.pl-poster-foot` — the new library hero may claim it),
`ActiveMesoCard.tsx` orphan, `MesoDayPage.tsx:158-159` literals vs `setBudget.ts:38`
(`SESSION_MUSCLE_CAP`), `MesoMusclePage.tsx:62` nudgeFor, `MesoKonyvtarPage.test.tsx`
skeleton gap, `train.ts:106,207` stale labels + missing konyvtar kalauz entry.

---

### Task 1: The library CSS + the pure story/stars logic

**Files:**
- Modify: `frontend/src/styles/prototype.css` (the library families into the terv section,
  as a marked `terv library (T10)` sub-block; + the `.pl-mrow-art` rule),
  `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` (extend the terv describe:
  `.pl-lib-card`, `.pl-lhero`, `.pl-stars`, `.pl-tpl-ex`, `.pl-wload`, `.pl-row`)
- Create: `frontend/src/features/train/logic/libraryStory.ts` + test

**libraryStory.ts (produces, consumed by Tasks 2-4):**

```ts
export interface RunStars { share: number; stars: number; say: string }
/** Delivery share → halves stars via cerScore.starsFor; say ladder (adherence-neutral):
 *  ≥0.95 'Végigvitted.' / ≥0.75 'Erős futam volt.' / ≥0.5 'A nagyobb fele megvan.' /
 *  >0 'Elindult, aztán másfelé vitt az élet.' / 0 'Ez a futam nem indult el.' */
export function runStars(completionPct: number | null): RunStars | null  // null in → null out
export interface TemplateStory { activeNow: boolean; plannedCount: number; closedCount: number }
/** Which runs came from a template (match by templateId when the wire has it, else by
 *  name — read the mesocycle list shape and document the chosen key in a comment). */
export function templateStory(templateId: string, templateName: string,
  mesocycles: Mesocycle[]): TemplateStory
```

- [ ] **Step 1:** Failing tests — structure-test classes; runStars table (null→null,
  0/49/95/100 boundaries, halves come from starsFor), templateStory matching precedence +
  counts. **Step 2:** Port the CSS (renames applied; every selector `.pl-`-prefixed).
  **Step 3:** Implement logic. **Step 4:** PASS + `pnpm build` + collision grep.
  **Step 5:** Commit `feat(train): library CSS families + run-stars/story logic (mezo-88iwa.11)`.

### Task 2: The library landing reface (MesoKonyvtarPage)

**Files:**
- Modify: `frontend/src/features/train/pages/MesoKonyvtarPage.tsx` (full Titanium reface)
  + `MesoKonyvtarPage.test.tsx` (rewrite + the missing skeleton test),
  `frontend/src/features/tutorial/registry/train.ts` (a konyvtar kalauz entry anchored to
  the page's real anchor; fix the two stale `Mesociklusok` link labels at `:106,207` to
  the current names — landing 'Terv', library 'Edzéstervek'; reverse-lint passes)

Anatomy (prototype `planLibrary`, real data): `.pl-lhero` hero (back pill in-hero; facts
row `1 fut · N következik · N sablon · N lezárva` from `useTrain().mesocycles` +
`useMesoTemplates` — each count real, 0 renders as 0 here because it IS a real count),
"Most fut" card (`is-now`, the active meso → `/train/mesocycles`), "Következnek" cards
(`is-queued`, planned mesos with start/weeks/split + the existing start affordance —
KEEP the `MesoStartSheet` flow), "Új terv" (`.pl-lib-new` → `/train/mesocycles/new`),
then the two doorways (`.pl-dest is-plans` → `/train/templates`; `is-done` →
`/train/mesocycles/futamok`). The compare-mode toggle + `ArchivedMesoCard` Történet
section MOVES to the futamok page (Task 4) — this landing keeps no list of closed runs.

- [ ] Failing tests (hero facts; the four card kinds; doorway routes; skeleton on pending;
  start flow preserved) → implement → kalauz entry + label fixes (tutorial tests) → both
  modes → commit `feat(train): Edzéstervek landing — Most fut, Következnek, Új terv (mezo-88iwa.11)`.

### Task 3: Sablonjaid + the template story page

**Files:**
- Modify: `frontend/src/features/train/pages/MesoTemplatesPage.tsx` (Titanium list reface:
  `.pl-lib-card` per template with split/weeks/days/minutes + the story line
  `templateStory` gives — 'Most is ebből fut egy' / 'N lezárt futam'), update
  `train.nav.test.tsx`'s shell pin in the same change
- Create: `frontend/src/features/train/pages/MesoTemplateStoryPage.tsx` + test at NEW
  route `train/templates/:id` (router order: BEFORE any conflicting sibling — check;
  navModel Terv `owns` already covers `/train/templates`)

Story page (prototype `planLibraryTemplate`): hero (name, split, weeks×days, MuscleChip
row from the template's muscles), "A hét felépítése" — per-day `.pl-tpl-ex` cards with the
day's exercises spelled out (the template payload carries days/exercises — read
`useMesoTemplates`' shape), "Heti szettek izmonként" `.pl-wload` bars (sets per muscle
summed from the template days), "Futamok ebből a sablonból" `.pl-row` list (from
`templateStory` + the mesocycle list; each closed row links to its report), CTAs:
"Futam indítása ebből" (the EXISTING MesoStartSheet/start-endpoint flow) +
"Szerkesztés" (→ the raw editor route `train/mesocycles/templates/:id`).

- [ ] Failing tests (list cards + story line; story page: day cards spell every exercise,
  wload bars sum correctly — table-tested against a fixture template, runs list routes,
  both CTAs) → implement (list card taps → the story page) → both modes → commit
  `feat(train): Sablonjaid list + read-first template story page (mezo-88iwa.11)`.

### Task 4: Lezárt futamaid + the report's star hero and then-vs-now

**Files:**
- Create: `frontend/src/features/train/pages/MesoFutamokPage.tsx` + test at NEW route
  `train/mesocycles/futamok` (router: before `:id`; navModel owns via the mesocycles
  prefix — verify)
- Modify: `frontend/src/features/train/pages/MesoReportPage.tsx` (+test): the `.pl-lhero`
  star hero (runStars over the report's `completionPct` — stars + say + the share drawn,
  labelled 'A teljesített edzések aránya'), and the "A mostani tervedhez képest" block
  (shared muscles: the closed run's peak weekly sets vs the ACTIVE meso's current-week
  target, `.pl-versus` reuse; the block renders ONLY when an active meso exists AND
  shares ≥1 muscle — else absent entirely); compare/`ArchivedMesoCard` affordances move
  here from the old konyvtár section (rerun/Sablonná/Összevetés preserved — the
  no-nested-button constraint).

Futamok page (prototype `planLibraryClosedList`): hero totals (Σ done sessions, Σ record
count across closed runs — only from real report/mesocycle data; a total whose inputs are
missing is omitted), `.pl-lib-card is-closed` per run: star row (runStars), name, dates,
`N edzés a M-ből`, record count when known; tap → the report.

- [ ] Failing tests (list + stars from completionPct; hero totals honesty; report hero +
  say; then-vs-now presence/absence rules; compare toggle still works from its new home;
  the old konyvtár Történet section gone with no orphan route) → implement → both modes →
  commit `feat(train): Lezárt futamaid + the closed-run star hero and then-vs-now (mezo-88iwa.11)`.

### Task 5: The T9 residue sweep + docs + gates (ship = controller)

- [ ] **Sweep (each item grep-verified first, recon's corrected anchors):** dead `.mz-w*`
  block (`prototype.css:~8877-8906`); the six unused pl- families EXCEPT any this slice
  now consumes (re-grep `.pl-poster-foot` — the library hero may claim it; keep what's
  used, delete the rest); delete `ActiveMesoCard.tsx` (+ purge the four stale prose
  mentions); `MesoDayPage.tsx:158-159` → `SESSION_MUSCLE_CAP` (import from
  `setBudget.ts`; the `--at` pin becomes `(SESSION_MUSCLE_CAP-… )` — derive, don't
  hardcode; keep visual parity); `nudgeFor` merged-caption overlap — extend the clamp to
  separate captions within a minimum gap (small pure fix + test in `MesoMusclePage`'s
  logic).
- [ ] **Docs:** `docs/features/train.md` — the Edzéstervek/Sablonok/report sections
  rewritten to the new IA (landing, story page, futamok, report hero + versus block,
  FE-derived stars with their source named); CODEMAP regen.
- [ ] **Gates FOREGROUND:** both-mode full `pnpm test`, `npx tsc -b`, `pnpm build` +
  pl- collision grep, `pnpm test:layout`.
- [ ] Ship (controller): push, PR (`--body-file`, the PR body records the "A blokk a
  motor." open owner question), CI, detached merge, post-merge CODEMAP, close
  `mezo-88iwa.11` + `mezo-obqw3`.

## Self-review notes

- Stars derivation is deliberately FE-only over `completionPct` — the honest wire
  equivalent of the prototype's fixture `stars`; the say ladder is new copy (the
  prototype's fixture `say` strings are demo prose), written adherence-neutral.
- The prototype's `volumeKg` fact has no wire analogue → omitted (recon-confirmed gap);
  record counts come from the report's records section where present.
- The raw template editor and the wizard routes are untouched (T11's ground).
- Route order matters twice (`futamok` and `templates/:id`) — both called out in tasks.
- Type check: `RunStars`/`runStars`/`templateStory` names consistent across Tasks 1-4;
  `.pl-wload` naming consistent between Task 1's CSS and Task 3's page.
