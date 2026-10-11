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
`.vs-in` / `kmIn` / `doneIn` (indented lines under a step, Mai), `.vs-leg` and everything of the in-workout flow (slice F4).
