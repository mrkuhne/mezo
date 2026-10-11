# Edzés · Folyadék pieces — prototype helper → React piece

Build target: `docs/design_2.0/prototypes/vilagos/edzes.js`. Code from this table; never re-draw a piece locally.
Kit = `import { … } from '@/shared/ui/folyadek'` (CSS `folyadek-kit.css`, `.fo-`).
Edzés-shared = `import { … } from '@/features/train/components/folyadek'` (CSS `folyadek-edzes-kozos.css`, `.ex-`).
Icons are sprite ids (`Icon3DName`, e.g. `t-dumbbell`). Every kit piece owns its 44 px hit area — add none per page.

## Page skeleton (kit)

| Prototype | React | Props |
|---|---|---|
| `page('edzes', o, html)` | `Page` | `foot?` (floating action bar), `nonav?`, `tone?: 'dusk'`, + div attributes. Title bar / tabs come from the frame (`useFrameTitle`, `FrameBack`) |
| `hero({lbl,v,sub,acts,warn,art})` | `Hero` | `label? verdict sub? warn? left? actions?` + `children` (the graphic); no `actions` = closed liquid strip |
| `sec(n, title)` | `Section` | `n? title link?` |
| `card(inner)` | `Card` | section attributes, `ref` |
| `head(icon, title, link)` | `Head` | `icon? title titleId? link? onLink?` |
| `row(o)` / `rw(o)` | `Row` | `icon? left? title sub? more? value? right? onClick? to? as?: 'div' state?: 'now'｜'done'｜'dim'` — `rw({m})` → `left={<Mchp muscle sm />}`; inner buttons → `as="div"` |
| `ls(...rows)` | — | put the `Row`s straight into the `Card` (the kit draws the hairlines) |
| `step(o)` | `Step` | `time? icon? title sub? right? now? onClick?` |
| `btn` / `ve` | `Btn` | `ghost? sm? wide? grow? icon?` + button attributes |
| `lk` / `vl` | `Lk` | button attributes |
| `acts(...)` | `Acts` | `center?` |
| `two(label)` (sheet foot: primary + „Mégse") | `SheetActs` | `label onSave? onCancel cancelLabel? disabled? submit?` |
| two equal buttons / fields | `TwoBtn` | `three?` |
| `seg(a)` / `segw(a)` | `Seg` | `items: {key,label,dot?}[] value onChange tabs?` — directly under `Page` it gets the Edzés well (`segw`) by itself |
| `pills` / `chips(a,on)` | `Pills` + `Pill` | `Pill`: `on? icon?` + button attributes |
| `st(label, kind)` | `St` | `tone?: 'q'｜'ok'｜'warn'｜'bad'｜'plan'` |
| `fh-chips` with drops (Nap style) | `Chips` | `items lead?` |
| `tags(a)` (`.tx` / `.ic`) | `Tags` | `items: (string ｜ {label, icon?, left?})[]` |
| `mchips()` (muscle chip + name) | `MuscleTags` (Edzés) | `items: {muscle,label}[]` |
| `facts(a)` | `Facts` | `items: [big, small][]` |
| `note` / `txt` | `Note` / `Txt` | p attributes |
| `lab(t)` / `blk(label, inner)` | `Lab` (+ the content after it) | `htmlFor? id?` |
| `fld(text)` | `Input` / `TextArea` / `Select` | native attributes |
| `fh-big` | `Big` | `value unit? note? left? right? onClick?` |
| `box(icon, title, body, colour)` | `Box` | `icon? color? left? title` + `children` (the body, usually `<p>`) |
| `pair([[icon,label,…]])` | `Pair` | `items: {icon, label, small?, onClick?, to?, ariaLabel?}[]` |
| `bub(icon,{s,c})` | `Bub` | `icon size? color?` |
| `msg(k, text, meta)` | `Msg` | `member meta? size?` |
| `emptyTank(icon, text, acts)` / `ghost(...)` | `EmptyTank` (in a `Card` for `ghost`) | `icon? actions?` + `children` (the sentence) |
| `fh-empty` | `Empty` | `icon? actions?` |
| `skel(o, blocks)` | `Skel` | `blocks?: number[]` (px heights, default 320/130/190) `label?` |
| load error row | `ErrorRow` | `message onRetry? retryLabel?` |
| `scale(v)` (1–10) | `Scale` + `Ends` | `value onPick aria-label` — the kit's one scale recipe (the prototype's `.vs-scale` is the same control) |
| `stp(label, value, sub)` | `Stepper` | `label? sub? value onDec onInc n? min? max? auto? name? decDisabled? incDisabled?` — with `label` a whole row, without it the bare − value + |
| `.vs-rng` (RPE range) | `Slider` | `value min? max? step? onChange unit?` + `aria-label` |

## Liquid graphics (kit)

| Prototype | React | Props |
|---|---|---|
| `tank(...)` | `Tank` | see `Tank.tsx` |
| `level(p,{c,h,val,label})` / `lv(p,c,h)` | `Level` | `pct color? height? value? label?` |
| `wlv(p, c, marks, h)` | `LevelMarks` | `pct color? height? marks?: {at, dashed?, label?}[]` |
| `split(a, b, c)` | `Split` | `a b color? big?` (`big` = the 26 px one under a `Big`) |
| `pour(parts)` | `Pour` | `parts: {n, color, label?}[] sm? empty? aria-label?` — colour = `deepMuscle(key)` |
| `.vs-lg` / `.vs-wlk` (keys under a graphic) | `Legend` | `items: {label, color?, kind?: 'drop'｜'hatch'｜'line'｜'dash'｜'vessel'}[] center?` |
| `caps(n, d, c, {cur, cls})` | `Caps` | `n done? cur? color? size?: 'wide'｜'big'｜'xs' label?` (`cls:'bem'` → `size="xs"`) |
| `weekCaps(on)` | `Caps` | `n={7} on={[…]} size="wide" labels={['H','K','Sze','Cs','P','Szo','V']}` |
| `tubes(a,{h,cls,gap})` | `Tubes` | `items: VialItem[] height?` (112) `size?: 'sm'｜'wk' gap? className? aria-label?` |
| tube option `l v s p c mark` | `VialItem` | `label value note pct color mark` |
| tube option `wl now ghost hatch over sel` | `VialItem` | `wl now ghost hatch over sel` |
| tube option `m` / `ic` / `on` | `VialItem` | `node={<Mchp muscle size={28} />}` / `icon` / `onClick` (+ `ariaLabel`, `pressed`) |
| `vials(a)` (the tall Nap ones) | `Vials` | `items height? size?: 'sm'｜'xs'` |
| `drops(n, of, c)` | `DropsMeter` | `n of? color? label?` |
| `fill(shape, …)` | `Fill` | `d viewBox? pct size? color? color2?` |
| `area(v, o)` | `Area` | `values dots? target? labels? width? height? min? max? color? color2?` |
| `areaM(v, o, marks)` | `Area` | + `marks: {i, label?, kind: 'now'｜'pr'}[]` |
| `linked(...)` | `Linked` | (removed from the Edzés prototype — do not build) |

## Sheets (kit)

| Prototype | React | Props |
|---|---|---|
| sheet | `<Sheet className="fo-sheet" labelledBy>` (`@/shared/ui/Sheet`) | children may be `(close) => …` |
| `sh(lbl, title, sub)` | `FoSheetHead` | `eyebrow={lbl} title titleId sub? onClose` |
| `shm(key ｜ icon, lbl, title, sub)` | `FoSheetHead` | `eyebrow title sub?` + `icon="t-…"` or `left={<Mchp muscle />}` |
| `info(label, key)` → `tinfo` / `info` sheet | `InfoButton` (`@/features/train/components/InfoButton`) | `title copy eyebrow? link? icon?` — `link` = the „Mit mutat a sáv?" text link; default = the round ⓘ beside a heading |
| an info sheet with extra content | `InfoSheet` | `title eyebrow? copy? icon? onClose` + `children` |

## Edzés-shared (`@/features/train/components/folyadek`)

| Prototype | React | Props |
|---|---|---|
| `mchp(key, 'sm')` | `Mchp` | `muscle sm?` (32 px; default 40) `size?` — always use this on a Folyadék surface, never a bare `MuscleChip` |
| `stk(keys)` | `MuscleStack` | `muscles max?` (3) |
| `dk(key)` | `deepMuscle(key)` | → CSS colour string; `muscleLiquid(key)` = the plain region colour |
| `mus(key, label, value, pct, colour)` | `MuscleRow` | `muscle label sub? value? pct? color? split?: {a,b} right? onClick? ariaLabel?` |
| `bodyLiq(view, entries, cls)` | `BodyLiq` | `view: 'front'｜'back' entries: {muscle, done?, planned?}[]` (0..1) `width?` (84) `ariaLabel? off?` |
| `.vs-hb` (body + caption) | `BodyLiq` | + `caption` (`width` then defaults to 96; the Mai hero uses 112) |
| `duo(entries, cls)` | `DuoBody` | `entries size?: 'sm'｜'md'｜'xl' ariaLabel?` |
| `rcap(prev, colour)` | `Rcap` | `prev?` (% of the old record, none = no line) `color?` (gold) |
| `num(n)` | `DayNum` | `children` |

## Not in the kit (one screen only — build locally with your prefix)

`ivl` (interval profile, Futás), `cyl` (the standing cylinder, Izom page), `.vs-hf` (hero fact column, Mai),
`.vs-in` / `kmIn` / `doneIn` (indented lines under a step, Mai). The in-workout flow's pieces are in the F4 chapter below; local there: `.vs-stepnav` (the review's previous / next pair), `.vs-now` (the „ma …" line on the records sheet), `.vs-ro` (the read-only set sheet), `.vs-vid` (the video frame).

---

# F4 · Edzés közben — the in-workout flow (`mezo-n4wf5.4`)

Build target: the F4 routes of `docs/design_2.0/prototypes/vilagos/edzes.js` (owner-approved, round 1 included). Foundation
(this chapter's pieces, the page cut, the focus model, the derivations) is on the branch; the five areas below convert the
screens. **Read (e) before you write a floating element.**

## (a) Prototype helper / class → React piece → props

### Kit (`@/shared/ui/folyadek`, CSS `folyadek-kit.css`)

| Prototype | React | Props |
|---|---|---|
| `rangeBar(lo, hi)` / `.vs-range` | `RangeBand` | `lo hi unit? step?` (30) `pending?` — decorative; the hero's sentence says the range |
| `vopt(options, on, line)` / `.vs-vo` | `OptionVessels` | `items: {label, pct, color?}[] value onChange line? aria-label` |
| `.vs-dots` (corner three-dot button) | `DotsBtn` | button attributes + `aria-label`. As a DIRECT child of `Hero` it takes the top right corner and the hero's text row keeps clear of it |
| `.vs-fcol` + `.vs-fsub` | `FootCol` | `sub?` + `children` (the button) — goes into `Page foot` |
| `.vs-shg` | `SheetGraphic` | `note?` + `children` (capsules, a vessel) |
| `card(…, {cls:'vs-gold'})` | `Card gold` | `gold` |
| `cstars(spill)` + `.vs-cer` | `CupStage` | `pass label? spill?` + `children` (wrap the verdict in `CeremonyReveal beat={1}`) |
| `#cerroot` + `runCer` | `useCeremonyPass` + `CeremonyRoot` | `useCeremonyPass({ ratio, settled?, reducedMotion? })` → `pass`; `<CeremonyRoot pass>` wraps the whole screen |
| `.vs-cres` / `.vs-ccard` | `CeremonyReveal` | `beat: 1 ｜ 2` (1 = with the verdict, 2 = with the numbers) |
| `cnt(key, value, label)` | `CeremonyCount` | `pass value` — put it in `Facts` as the big value |
| star thresholds (`starCls`) | `starState(i, progressed)`, `ratioStars(ratio)` | pure |
| `.vs-lg` under the bowl | `Legend` (F3) | `items: {label, color}[]` |
| `tubes`, `caps`, `wlv`, `facts`, `box`, `pair`, `rw`, `st`, `shm` … | as in the F3 table above | — |

Second-level pieces that ALREADY exist (reuse, do not redraw): the standalone back pill = `HistoryBackButton` / `FrameBack`
(or just `useFrameTitle` — see (e)); the hero's corner glyph = `Hero art`; the big verdict = `Hero big`; a row's chevron =
`Row chev`; the quiet line under a row = `.fo-under`; a disabled / danger link = `Lk disabled` / `Lk bad`; a dim, switched-off
row = `Row disabled`; label–value lines = `KnobLine` / `StepLine` (this folder); status pill = `St`; error strip = `Box` with
`color="var(--fo-bad)"`; skeleton = `Skel`; the 0–5 RIR chips = `Pills` + `Pill`.

### Edzés-shared (`@/features/train/components/folyadek`, CSS `folyadek-edzes-kozos.css`)

| Prototype | React | Props |
|---|---|---|
| `qcap(c, on)` / `.vs-qc` | `QuestCapsule` | `on confidence?` (0–1; `null` = still learning → dashed, no level) `full?` (outcome capsule) |
| `.vs-qb` (the capsule as a switch) | `QuestTick` | `on confidence? label onClick disabled?` — put it in `Row left` with `as="div"` |
| `.vs-qt` | `QuestType` | `icon color?` + `children` (also the record kind on the ceremony) |
| `.vs-ql` | `QuestLine` | `label target released? onClick aria-label` |
| `.vs-why` | `QuestWhy` | `why glory?` |
| `dchip(chg)` / `.vs-dchip` | `DeltaChip` | `tone: 'up'｜'down'｜'hold'` (= `progressionChip().tone`) |
| `.vs-pv` | `ProgressVessels` | `items: {id, label, done, planned, color, off?}[] activeId onPick` — numbers from `progressVessels(session)`, `color = deepMuscle(muscle)` |
| `.vs-tools` | `ToolRow` + `ToolBtn` | `ToolBtn`: `icon` + button attributes |
| `.vs-tg` (one state cell · two cells on the records sheet) | `Cells` + `Cell` | `Cell`: `label value target? children?` (a `DeltaChip`) |
| `.vs-xl` | `InfoLine` | `icon onClick? aria-label?` + `children` |
| `.vs-leg` | `VerdictLegend` | — (+ `VERDICT_WORD`, `VERDICT_ICON`, `VERDICT_COLOR`, type `SetVerdict`) |
| `.vs-side` | `SidePicker` | `value: 'L'｜'B'｜'R'｜null onChange disabled?` (Bal / Mindkettő / Jobb) |
| `setRow` + `.vs-sets` + `.vs-adj` | `SetGrid` | `name color rows: SetGridRow[] rirMax? side? adjust?` — rows: `{kind:'done', kg, reps, rir, verdict, busy?, onEdit?}` · `{kind:'cursor', kg, reps, rir (draft strings), weightless?, disabled?, onKg, onKgBlur?, onReps, onRir, onSubmit}` · `{kind:'pending', kg, reps, rir}` |
| `dock()` / `.vs-rest` / `.vs-rv` | `SessionDock` | the props of today's `WorkoutDock` with `doneSets` / `plannedSets` from `dockNumbers(session)`; portals into `.phone-screen` itself |
| `mtoast(m)` | `RecordToast` | `eyebrow value note?` — FIRST child of the `Page` (sticky, zero height) |
| `retFab()` / `.vs-ret` | `ReturnFab` | `doneSets` + button attributes (only the disc; `app/FloatingReturnLayer` keeps placing it) |
| `kcalBowl(base, add)` | `KcalBowl` + `kcalBowlShares(dayKcal, addKcal)` | `base add` (%); `kcalBowlShares` → `null` = no bowl |
| `.vs-mt` | `MuscleStarRow` | `muscle label ratio done plan` |
| `stars5(r)` | `StarRow` (F3) | `stars={ratioStars(ratio)}` |
| `rcap(pp)` | `Rcap` (F3) | `prev={record.prevShare}` |

### Logic (pure, tested — no UI)

| Need | Helper | Where |
|---|---|---|
| which exercise is on top, „Most", how the focus moves | `heroExerciseId(session, focusedId)`, `nowExerciseId`, `nextFocus(focusedId, event)` | `logic/sessionFocus.ts` |
| row pill, finish button, dock, top vessels | `rowTag`, `finishState`, `dockNumbers`, `progressVessels` | `logic/sessionFocus.ts` |
| the old record's line on a capsule | `medalPreviousShare(medal)`; already carried as `CeremonyRecord.prevShare` by `ceremonyRecord` | `logic/medalLabels.ts`, `WorkoutCeremony.tsx` |
| the review hero's dashed line | `prevDoneByName(refStats?.exercises)` → `prevDoneLine(prevDone, plannedToday)` (0–1 or null) | `logic/workoutReviewDerive.ts` |
| „célsávban / cél alatt / cél fölött / bemelegítő" | `setBand({repMin, repMax}, {reps, warmup?})` | `logic/workoutReviewDerive.ts` |
| the day's quests incl. „nem vállaltad" | `questRows(challenges)` → `{rows, hit, rest}` | `logic/workoutReviewDerive.ts` |
| the kcal bowl's frame | `useFuelDay().fuel.energy?.baseKcal` → `kcalBowlShares(baseKcal, kcal.value)` | see below |

**The bowl's frame.** `useFuelDay()` (`data/fuel/fuelHooks.ts`) is one `GET` of the day (mock: the seed), `realStaleTime: 0`.
Read it in a SMALL connected child rendered only on the details step (so the ceremony's first step never waits on it and
`WorkoutCeremony` stays testable with props): frame = `fuel.energy?.baseKcal`. No `energy` (static target), pending or error
→ `kcalBowlShares` gets `null` → the no-frame face (`#w-edzes-cer.reszletek.keret-nincs`: a `Bub icon="t-bowl"`, no legend).
No kcal at all → the `…kcal-nincs` face.

**The focus model in the page (area B).** Hold `const [focusedId, setFocusedId] = useState<string | null>(null)` in
`ActiveWorkoutPage`; `heroExerciseId(session, focusedId)` is the hero. Dispatch through `nextFocus`: row / vessel tap →
`tap`; in `handleLogSet` → `logged`; in `advanceAfterFeedback` → `debriefClosed` (with the debriefed id); `handleSkip` →
`skipped`; un-skip → `unskipped`; `applyChange` success → `changed` with the created id. Every exercise keeps its OWN cursor
(`nextSetIdx`) — the hero's grid is that exercise's rows; nothing in `workoutState.ts` changes. The cursor row's draft
(weight text, reps, rir, side, the equivalent-reps adjust) is what `WorkoutCard` holds today: keep that logic, feed `SetGrid`.

## (b) The five areas — files each OWNS

Shared rule: one area = its files + its stylesheet + its tests. A piece missing from the kit → report it, do not grow a local
twin. Nobody deletes from `styles/prototype.css` (the controller does, with zero-usage proof).

| Area | Owns (components / pages) | Tests | Stylesheet |
|---|---|---|---|
| **A · Eligazítás** | `components/WorkoutBriefing.tsx`, `components/WorkoutOverloadLine.tsx`, `components/ChallengeGenerationLoader.tsx` | their `.test.tsx`, `logic/briefing.test.ts` | `folyadek-edzes-eligazitas.css` `.ei-` |
| **B · Session page** | `pages/ActiveWorkoutPage.tsx` (state + handlers; the ONLY area that edits it), `components/WorkoutSessionView.tsx`, `components/WorkoutCard.tsx` (becomes the hero + the rows), `components/WorkoutDock.tsx` (→ `SessionDock`), `components/MedalToast.tsx` (→ `RecordToast`), `components/MedalChip.tsx`, `app/FloatingReturnLayer.tsx` (→ `ReturnFab`), the dead `components/ProgressionBanner.tsx` (delete) | `ActiveWorkoutPage*.test.tsx` (5), `WorkoutCard`, `WorkoutDock`, `MedalToast`, `MedalChip`, `app/FloatingReturnLayer.test.tsx` | `folyadek-edzes-kozben.css` `.ek-` |
| **C · Session sheets** | `components/WorkoutSessionSheets.tsx`, `components/WorkoutMenuGlass.tsx` (menu, video, quest detail), `components/WorkoutRecordsGlass.tsx`, `components/FinishConfirmGlass.tsx`, `sheets/SetEditSheet.tsx` (+ `components/SetStepper.tsx`), `sheets/ExerciseScopeSheet.tsx`, `sheets/FeedbackModal.tsx`, `sheets/ExerciseNoteSheet.tsx`, `sheets/ExtraSetPrompt.tsx` | `WorkoutMenuGlass`, `WorkoutRecordsGlass`, `FinishConfirmGlass`, `SetEditSheet`, `SetStepper` tests | `folyadek-edzes-kozben-lapok.css` `.el-` |
| **D · Ceremonies** | `components/WorkoutCeremony.tsx`, `components/SportCeremony.tsx`, the ceremony wiring inside `pages/SportLogPage.tsx` (lines around `showLevelUp` / `setCeremony` only) | `WorkoutCeremony`, `SportCeremony`, `SportLogPage` tests, `logic/cerScore.test.ts`, `logic/sportScore.test.ts` | `folyadek-edzes-lezaras.css` `.ec-` |
| **E · Review** | `pages/WorkoutReviewPage.tsx`, `components/WorkoutSummary.tsx`, `components/ExerciseReview.tsx` | their tests, `workoutReviewTokens.test.ts` (re-point it at the new classes — the „no red in the comparison" rule stays), `logic/summaryStats.test.ts`, `logic/workoutComparison.test.ts` | `folyadek-edzes-osszegzes.css` `.eo-` |

How B and C meet: the page hands `WorkoutSessionView` one object `v` and `WorkoutSessionSheets` one object `s` (field names =
the page's locals; both interfaces are typed in the component files). C changes what the sheets LOOK like and keeps `s` as
it is; if C needs a field that is not in `s`, C reports it and B adds it. `FinishConfirmGlass` is rendered by the page in the
view's `after` slot — keep its name and props when it becomes a sheet. The records sheet now also shows „Múlt hét / Mai cél"
with the delta chip (`Cells`): both come from the exercise (`lastWeek`, the first working `prescribedSets`, `progressionChip`).
A needs nothing from the page: every value of the approved Eligazítás is already a prop of `WorkoutBriefing`. D needs nothing
from `ActiveWorkoutPage` either (`records[].prevShare` is already passed; the Fuel frame is read inside, see above).

**Controller-owned — nobody else edits, report instead:** `app/navigation.test.tsx`, `app/AppLayout.lightFirst.test.tsx`,
`app/AppLayout.threadScope.test.tsx`, `app/hubHeaders.test.tsx`, `app/TopTabs.test.tsx`, `features/tutorial/registry/*`,
`pages/train.nav.test.tsx`, `pages/train.emptyStates.test.tsx`, `pages/TrainTodayPage.test.tsx`,
`shared/ui/mozaik/GlassBox.test.tsx`, `shared/ui/mozaik/prototypeCssStructure.test.ts` (the five new sheets join its
`EDZES_SHEETS` list once they carry rules), `tests/layout/*`, `app/AppLayout.tsx`, the kit and this folder's pieces,
`styles/prototype.css`, `styles/folyadek-kit.css`, `styles/folyadek-edzes-kozos.css`.

## (c) Wording (live → new)

| Live | New |
|---|---|
| Mezociklusra is · Mezociklusban · a X helyett · Mezociklusba felvéve | A tervben is · A tervben is · a X helyett · Felvéve a tervbe |
| „…a mesociklus terve is eggyel több szettet ír elő" | „…a terved is eggyel több szettet ír elő" |
| „…nincs a mezociklus tervében…" | „…nincs a terved napjai között…" |
| Set debrief · RP feedback | Gyakorlat kész · hogy ment? |
| Pump · érzed? / Joint pain | Pumpa · érzed? / Ízületi fájdalom |
| Hagyjuk / Mentés · tovább / Edzés vége → | Hagyjuk / Mentés · tovább / Edzés vége |
| Side · OLDAL · L / B / R | Oldal · Bal / Mindkettő / Jobb (values stay L / B / R) |
| REP · rep · „kg × rep" · Rep-rekordok | ism · „kg × ism" · Ismétlés-rekordok |
| `+rep` / `−súly` (overload line) | `+ism.` / `−súly` |
| PR-kísérlet (quest type) | Rekord-kísérlet |
| ELVÉGZETT MUNKA · Lezárás → | Elvégzett munka · Lezárás |
| PIHENŐ · GYAKORLAT · +30s · Kész | pihenő · gyakorlat · +30 mp · Tovább |
| A javasolt rep-sávban / Cél alatt — … / Cél felett — … / sávon kívül | célsávban / cél alatt / cél fölött |
| MA MEGDÖNTVE · BECSÜLT 1RM · LEGJOBB SZETT · LEGTÖBB VOLUMEN egy alkalmon | ma megdöntve · Becsült 1RM · Legjobb szett · Legtöbb volumen egy alkalmon |
| ÚJ REKORD · SÚLY / REP / 1RM / VOLUMEN (toast) | Új rekord · súly / ismétlés / 1RM / volumen |
| Kihívások · skippelted · megcsináltad · nem teljesült | Küldetések · nem vállaltad · megvan · nem jött össze |
| „… nem AI-értékelés" | „… nem gépi értékelés" |
| „A riport sosem büntet … szellem-chip … kihagyott kihívás tompított" | „Az összegzés sosem büntet … üres kapszula … kihagyott küldetés halk" |
| Miért ezt? › / Kevesebb | Miért? / Kevesebb |
| EDZÉS LEZÁRVA | Így sikerült · N csillag az ötből |
| „óvatos, először warm-up" (fallback niggle text) | „Óvatosan, először bemelegítés" |
| Izomcsoportok fejlődése a mai edzésen | A mai edzésen · izomcsoportok |
| Gyakorlat műveletek (header ⋯) | „{gyakorlat} · további műveletek" on the hero's corner button |
| „… volt" under a comparison value | kept („4,1 t volt") |

Left as live on purpose: „Rep-rekord" as the medal's NAME (the Medálok page ships it), Túlterhelés, RIR, Ø RIR, XP, top szett.
One word for quests everywhere: **Küldetések**. Hungarian only in this slice.

## (d) Build target and the old CSS each area replaces

Prototype: `http://127.0.0.1:<port>/klinikai-iranyok.html?v=N` + hash. Old rules are all in `styles/prototype.css`
(23 560 lines; ranges measured on this branch — they hold until someone edits the file).

| Area | Routes / args / sheets | Old CSS (prefix · lines) |
|---|---|---|
| **A** | `#w-edzes-indulas` · `.kuld-keszul` · `.kuld-hiba` · `.kuld-nincs` · `.ido-keszul` · `.sajat` | `.wbr-` 13863–13915 (+ the shared `.wos-qc*` quest card rules inside 13518–13926, `.wo-overload` in 13259–13512) |
| **B** | `#w-edzes-session` · `.uj` · `.pihen` · `.rekord` · `.oldal` · `.igazitva` · `.kihagyott` · `.csere` · `.hozzaadva` · `.plyo` · `.mentes` · `.kesz` · `.hiba` · `.valt-hiba` · `.tolt`; return button: `#w-edzes-mai.folyamatban` | `.wk-top` / `.wkx-` 2005–2026, 4897–4904, 13214–13238 · `.wo-` 9705–10207, 13259–13512, 13574–13650, 23412–23427 (cards, rows, dock) · `.wos-` 13209–13367 · `.wos-medal` / `.toast-solo` 13834–13843 · `.float-` 1009–1072, 21780–21809 |
| **C** | sheets `menu(<i>)` · `demo(<i>｜nincs)` · `recs(<i>[.ures])` · `fin([nulla])` · `pick(swap:<i>｜add)` (already converted — `ExercisePickerSheet`) · `scope(csere｜csere-kesz｜add｜ma-kerult｜levezeto｜terv-nelkul｜utolso-het)` · `set(<i>.<j>[.var｜.utolso])` · `rp(<i>[.vege])` · `extra(<i>)` · `note(<i>)` · `qb(<i>[.hit｜.miss｜.inc])` — open them from `#w-edzes-session` | `.wo-menu*`, `.wo-rec*`, `.wo-last*`, `.wo-glass-*`, `.wo-confirm-*`, `.wo-video-*` inside `.wo-` 9705–10207 and 13574–13650 · `.wos-gb*`, `.wos-sheet*`, `.wos-choice*`, `.wos-scope*`, `.wos-qd*`, `.wos-pill`, `.wos-primary` inside `.wos-` 13518–13926, 23388–23410 |
| **D** | `#w-edzes-cer` · `.allo` · `.csendes` · `.reszletek` · `.reszletek.keret-nincs` · `.reszletek.kcal-nincs` · `#w-edzes-sportcer` · `.sajat-kcal` · `.kcal-nincs` · `.xp-nincs` · `.allo` | `.cer-` 10052–10113, 10245–10543, 13933–14212 (block header „uveg edzes zaras" at 13930). **NOT yours:** `.cer-` 21454–21496 (the meal ceremony reads the shared `.cer-stars` / `.cer-bar`) and `.levelup` 21504–21627 (progression) |
| **E** | `#w-edzes-review` · `.elso` · `.csendes` · `.kihagyott` · `.jegyzet-szerk` · `.tolt` · `.nincs` · `#w-edzes-review.gyak.<0–4>` · `.gyak.3` · `.gyak.0.elso` | `.wsum-` 2960–3024, 4910–4947, 14183–14449 · `.wr-` 3032–3122, 14216–14451 |

Not drawn in the prototype (keep what the live app does, in the new material): a warm-up row on the review's one-exercise
page (`setBand` gives „bemelegítő"), the „set failed to save" case (the app-wide error toast), the level-up overlay.

## (e) Structural traps — check each before you call an area done

- [ ] **A floating bar is portalled into `.phone-screen`** (the dock, the Indulás foot today). A sticky child of the
      scroller sits above its bottom padding. `SessionDock` portals itself; for a page foot prefer `Page foot` + `nonav`
      and check that it rests at the frame's bottom on a short AND a long page.
- [ ] **A phase flip is not a route change**: brief → active → ceremony swap the screen without navigation, so the page
      resets the scroller itself (`scrollToTop(screenScroller())`, already there). Keep it; the ceremony's own two steps too.
- [ ] **`/train/session` is chrome-free** (`AppLayout hideChrome`): no title bar is mounted, so `useFrameTitle` shows
      nothing there. The page draws its own head (back + title + „n / m szett kész" + kalauz `?`) — `FrameBack` /
      `HistoryBackButton`, never a bare `navigate(-1)` (F1.4). The kalauz anchor `data-kalauz-anchor="session-start"` stays on it.
- [ ] **The ceremony is ONE rAF pass** (`useCeremonyPass`): never a CSS transition for the level, the stars or a counter —
      a throttled webview freezes it at 0. Reduced motion and a settled re-entry paint the end state on the first render.
      In the in-app browser a screenshot round trip throttles rAF: read the classes (`b1 b2 b3 told`) before calling it frozen.
- [ ] **The level-up overlay does not cover a ceremony**: gym finish already does not raise it; D drops `showLevelUp` on
      the sport path and shows `+N szerzett XP` on the screen (`response.levelUp.totalXp`, no tile when absent).
- [ ] **The closing note saves on both exits AND on unmount** (`persistClosingNote` in the page): the field stays in flow
      above the button, so the keyboard pushes the button instead of covering it. Never PUT an empty draft.
- [ ] **`GlassBox` is shared with Fuel, Mezo and the character sheets**: do not restyle it. A workout glass becomes
      `<Sheet className="fo-sheet" labelledBy>` + `FoSheetHead`; keep each component's name and props.
- [ ] **A scrolling sheet scrolls its inside**, not its frame; never `overflow: hidden` on the page scroller (it kills sticky).
- [ ] **An entry point never hides itself**: the quest card keeps its place and says „készül / ma nincs / nem jött le + Újra".
- [ ] **Record and quest rows**: name, ONE chip line (`QuestType` + values), the outcome as a pill or capsule at the row's end.
- [ ] **Unique ids** for every clip / gradient (`useSvgId`); `fill: var(--c)` directly, never a shared-defs gradient that
      reads a variable; a kit rule addresses its own children (`>`).
- [ ] **No wake lock exists and a mid-rest reload loses the rest** (in memory only) — unchanged, do not promise otherwise.
- [ ] **Behaviour is frozen** except the approved ones: the focused-exercise layout, Technika = the exercise's video (no
      button without one), XP on the sport closing screen instead of the overlay, the idle dock's look.
- [ ] 320 px, the reduced-motion branch, and every state arg of (d) — say per route what you looked at in the browser and
      what only a test covers (F3.11). Mock mode has no failed start, no pending quests: those are test-only.

## (f) Deliberately NOT converted in F4

`VoiceField` (the mic tile inside the note fields — F8), `GlassBox` itself (other domains use it), the `LevelUpScreen`
overlay component and `LevelUpProvider` (progression), the meal ceremony's `.cer-*` rules, `ExercisePickerSheet` (already
light), `SportLogPage`'s form (F3), and the old rules in `styles/prototype.css` (deleted by the controller afterwards).
