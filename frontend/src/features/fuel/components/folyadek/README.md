# Fuel · Folyadék pieces — prototype helper → React piece (`mezo-n4wf5.5`, slice F5)

Build target: `docs/design_2.0/prototypes/vilagos/fuel.js` (owner OK 2026-10-12). Plan and area cut:
`docs/superpowers/plans/2026-10-12-folyadek-f5-fuel.md`. Code from these tables; never re-draw a piece locally.

- Kit = `import { … } from '@/shared/ui/folyadek'` (CSS `styles/folyadek-kit.css`, `.fo-`). The full kit table is in
  `features/train/components/folyadek/README.md` (page skeleton, liquid graphics, sheets) — it holds for Fuel as it is.
- Fuel-shared = `import { … } from '@/features/fuel/components/folyadek'` (CSS `styles/folyadek-fuel-kozos.css`, `.fx-`).
- Words = `useM().fuelKozos…` (shared), `m().fuelLogika…` (the logic label maps), `useM().fuel<Area>…` (your own area).
- Numbers and dates = `@/shared/lib/format` only. Icons are sprite ids (`Icon3DName`). Every kit / shared piece owns its 44 px
  hit area — add none per page.
- Colours: macros and water are tokens on `:root` — `var(--fx-protein)`, `--fx-carb`, `--fx-fat`, `--fx-fiber`, `--fx-water`,
  `--fx-lilac` (= `MACRO_COLOR.protein` … in code). State colours are the kit's `--fo-ok / --fo-warn / --fo-bad`.

## (a) Kit — what the Fuel prototype uses

| Prototype (`fuel.js` / `F.`) | React | Props / note |
|---|---|---|
| `page('fuel', o, html)` | `Page` + `useFrameTitle` / `FrameBack` | title bar and top tabs come from the frame |
| `hero({lbl, verdict, sub, acts, art})` · `gHero({lbl, g, verdict, sub, body, acts})` | `Hero` | `label verdict sub? warn? art? actions?` + `children` = `g` / `body` (the graphic). `gHero` IS the kit hero with the graphic as children |
| `nh({n, unit, verdict})` (big number, then the verdict) | `Hero big` with `<Big value unit />` as the first child, or `NumG` (below) when a graphic stands beside the number | |
| `sec(n, title)` · `card(inner)` · `head(icon, title, link)` | `Section` · `Card` · `Head` | |
| `row(o)` | `Row` | `icon? left? title sub? more? value? right? onClick? to? chev? state? bad? disabled? as?` |
| `irow(o)` (two-storey row) | **`ItemRow`** (Fuel-shared) | see (b) |
| `step(o)` | `Step` | |
| `btn` · `lk` · `closeLk()` · `acts(h)` | `Btn` · `Lk` · `Lk` (close) · `Acts` | sheet foot „primary + Mégse" = `SheetActs` |
| `seg(a)` · `servSeg(...)` | `Seg` | `items value onChange` |
| `pick(opts, on)` · `ipills(a)` · `pills` | `Pills` + `Pill` | `Pill`: `on? icon?`; a count goes in the label as `<b>` |
| `st(label, kind)` | `St` | `tone?: 'q'｜'ok'｜'warn'｜'bad'｜'plan'` |
| `note` · `txt` · `lab(t)` | `Note` · `Txt` · `Lab` | |
| `fld` / `inp` · `sel` · textarea | `Lab` + `Input` · `Select` · `TextArea` | `.fx-two` (two fields a row) = `TwoBtn` |
| `stp(v, u)` (− value +) | `Stepper` | bare (no `label`); a typed amount = `input={{ value, onChange }}` |
| `sw(on, label)` | **`Switch`** (new, F5) | `on onChange label disabled?` — `role="switch"`, 46 × 28 track, 44 px hit area |
| `srch(text, value)` | **`SearchField`** (new, F5) | `value onChange placeholder? aria-label?` + input attributes; the clear button appears with text |
| `stat({k, icon, n, unit, pct, c, s})` | **`Stat`** (new, F5) | `label value unit? icon? pct? color? note? onClick?` — with `pct` the tile fills to that level in `color` |
| `grid([...stat])` | **`StatGrid`** (new, F5) | `three?` |
| `empty(icon, text, acts)` | `Empty` / `EmptyTank` | |
| `bub(icon, {s, c})` · `hi(id)` | `Bub` | `icon size? color?` (`hi` = `size={64}`) |
| `facts(a)` | `Facts` | `items: [big, small][]` |
| `vials(a, {h})` | `Vials` | `items: VialItem[] height? size?`; a vial that is a button: `onClick` + `ariaLabel` |
| `mini({p, c, v, l})` | `Mini` | `pct color? value? label?` |
| `level(p, {c, h})` | `Level` | `pct color? height? value? label?` |
| `fill(shape, {vb, p, s, c, c2, inner})` | `Fill` | `d viewBox? pct size? color? color2?` + `children` (= `inner`) |
| `area(v, o)` | `Area` | `values dots? target? labels? marks? …` — the weight chart's goal waterline = `target` |
| `linked(...)` | `Linked` | Trendek only |
| `JAR` | `Jar` | |
| `sh(icon, title, sub)` (sheet head) | `<Sheet className="fo-sheet" labelledBy>` + `FoSheetHead` | `eyebrow? title titleId sub? icon? onClose` |
| `tip(...)` in a tinted box | `Box` | `icon? color? title` + children |
| `msg(...)` | `Msg` | team voice: field name is a label (bible §2.3) |
| loading face (`*.tolt`) · error face (`*.hiba`) | `Skel` · `ErrorRow` | |
| back pill / title row on a sub-page | `FrameBack` / `HistoryBackButton` / `useFrameTitle` | never a bare `navigate(-1)` (F1.4) |
| hero corner glyph · big verdict · row chevron · quiet under-line · danger / disabled link | `Hero art` · `Hero big` · `Row chev` · `.fo-under` · `Lk bad` / `Lk disabled` | second-level pieces that already exist |

## (b) Fuel-shared (`@/features/fuel/components/folyadek`)

| Prototype | React | Props |
|---|---|---|
| `dayBowl(eatP, skipP, {s, over})` | `DayBowl` | `eatPct skipPct? over? size?` (152) — decorative, the caller names it |
| `bowlHero`'s `.fm-g` (eaten · bowl · remaining) | `BowlGauge` | `eaten target rem remLabel? skipped? over? plain? onClick? size?` — raw kcal numbers; `plain` = the empty bowl alone (closed day without data, loading, error); `onClick` makes the bowl the button to the energy sheet |
| `pour(before, add, {ghost, s})` | `PourBowl` | `before add ghost? size?` (168) — % of the day's bowl; `ghost` = a draft |
| `pk(a, b)` | `PourKey` | `before add` (nodes) |
| `slotCup(k, b, neutral)` | `SlotCup` | `kcal budget neutral?` — amber over 103 %; `neutral` on a gentle-mode day |
| `plainCup(k)` | `PlainCup` | `kcal: number ｜ null` |
| `potG(p, s)` | `Pot` | `pct size?` (92) — `pct={0}` = the empty pot with the dashed line (the Konyha hero's invitation) |
| `fill(GLASS, …)` in the water sheet | `Glass` | `pct nextPct? size? label?` — `nextPct` = where the chosen amount would reach |
| `dial(slot, at, size)` | `Dial` | `from? to? at? size?` — 'HH:mm'; the dot is amber outside the window. The ONE allowed circle: a real clock |
| `macroVials(p, c, f)` / `macroV(p, c, f)` | `MacroVials` | `p c f` (g, `null` = „—" + „nincs adat") `height? onPick?` |
| `mk(p, c, f)` | `energyShares(p, c, f)` | → `{p, c, f}` in % |
| `mealCells(m, fibT)` | `MealCells` | `protein carbs fat fiber fiberTarget` — levels = shares of the meal's OWN energy; fibre = share of the day's amount |
| `m3(p, c, f)` | `M3` | `p c f` (g or `null`) |
| `nutri([fib, sugar, salt, sat])` | `Nutri` | `fiber sugar salt satFat` (g or `null`) |
| `.fu-lnm` (a line's three macro cells) | `MacroTriple` | `p c f` |
| `scoreChip(id, m)` | `ScoreChip` | `score` (ten scale, `null` = „folyamatban") `onOpen? big?` — replaces `FuelScoreChip`; live passes `scorePct` → hand in `scorePct / 10` |
| `gluChip(id, m)` | `GlyChip` | `level: 'low'｜'mid'｜'high'` (= `GlycemicBand.level`) `onOpen? late?` |
| `gMini(l, late)` | `GlyMini` | `level late?` — draws in `currentColor`; replaces `GlycemicMiniCurve` |
| `gband(g)` | `GlyBand` | `level` |
| `GCV` / `GCOL` | `GLY_CURVE` / `GLY_COLOR` | the three paths + peaks, the band colours (for the big curve of the sheet — area C draws it) |
| `.fu-tags` + `TAGL` + `NOVA` | `LineTags` | `source?: 'pantry'｜'recipe'｜'estimate'` `ai? review? nova? extra?: ReactNode[] warnSource?` |
| `NOVA[n][2]` | `NOVA_COLOR[n]` | |
| `irow({icon, title, sub, v, l2, on})` | `ItemRow` | `icon? title sub? value? onClick? ariaLabel?` + `children` = the second line (`Level`, `St`, an amount) |
| `lineCard(o)` / `cLine(o)` | `EditLine` | `icon name tags? onRemove? amount unit onDec onInc decDisabled? incDisabled? kcal macros` + `children` (a `Nutri`, the „nézd át" note, tuning) — `amount` = the input's props; the caller owns the text state |
| `kv([[k, v]])` | `Kv` | `items: [label, value][]` |
| `tip(icon, title, sub, colour)` | `Tip` | `icon title color?` + children (the sentence) |
| `lgd([[cls, label]])` | `Lgd` | `items: [kind, label][]`, kind ∈ `liq over hatch line dash gap dot band ring tr water` |
| `numG(g, n, unit, lines)` | `NumG` | `graphic value unit?` + children (`<p>` lines, `MealCells`, `M3`) |
| `.fu-kms` (strip under the tabs) | `Strip` | `icon color? warn? onClick? ariaLabel?` + children — gentle mode, the diet suggestion, „booked to another day" |
| `split(parts, {h})` + `.fu-leg` | `SplitBar` | `parts: {label, pct, color, value?}[] height?` (the kit `Split` is the two-part done / planned bar — another thing) |

Not built here on purpose (one area only — build locally with your prefix): `tide` (the day as a tide, Fuel settings),
`gCurve` (the big response curve of the glycemic sheet — from `GLY_CURVE`), `dayNav` (area A converts `shared/ui/DayNavigator`,
whose only consumer is `FuelMaiPage`), `bandG` / the stack bands, `cyc` (the medication cycle), `learnSvg`, the week tubes
(`.fu-wk`: use kit `Tubes`), `.fx-pb` (the add wizard's three-step bar), `.fx-tot`, `.fu-shelf` (the Kamra tiles: `Stat`),
`.fx-cmp` (the composer field), `.fx-ph` (photo drop zone), `.fx-listen`.

## (c) Shared label maps (logic) — read, do not patch

The label maps and sentence builders of `features/fuel/logic` that several areas read were converted to call-time `m()` by the
foundation (catalog `fuelLogika`). Their list, and the single-area logic files each area converts itself, are in the plan
(§ Logic files). A word that must change (table (e)) is changed ONCE, at its source, by the area named there.

## (d) Icon map

See the plan (§ Icons): every glyph id the Fuel prototype uses and whether the app sprite has it.

## (e) Wording (live → new)

See the plan (§ Wording): the table with the file that owns each word and the area that changes it.
