# Boop Étel — receptértékelés: gazdagabb felület, étel-specifikus AI, a napod és a receptjeid

> bd `mezo-r36n9.199` · epic `mezo-r36n9` · B4 Étel · 2026-11-27

## 1. Intent — why

The owner, 2026-11-27, on the recipe evaluation in the recipe sheet: the retired web app's was „gazdagabb, színesebb
és szebb … jobb volt ránézni, több infót adott … nem volt generikus hanem étel specifikus … az én adataimhoz is
specifikus, hogy a napomban hol helyezkedik el, többi ételhez képest".

Investigation (this session):
- **The AI is unchanged** since the web: `RecipeBreakdownProseService` (system prompt last touched 2026-10-12) writes
  `summary`, one `details.<id>` sentence per dimension and `improve[]`. Live: 7 of 30 recipes carry cached prose
  (avg. summary 253 chars), the rest generate on first open. The prose is accurate but templated — every summary opens
  „Ez egy … recept, amely …" / „Ez a sablon …"; `tagline` is always null for recipes (`RecipeBreakdownProseService`
  l.180), and `improve.impact` is a bare tag („+rost").
- **The Boop UI shows less than it receives.** `RecipeDetail.swift` `score()` renders ring + fitsFor pills + (null)
  tagline + summary + a grey `DimensionGrid` of numbers + tips. The web's `FuelScoreSurface` (git `a88c6327a^`,
  `frontend/src/features/fuel/components/FuelScoreSurface.tsx`) additionally showed: each dimension's sentence inline
  under its row, a coloured bar per dimension, weakest (amber) / strongest marks, weight %, a confidence level, a
  verdict headline (fallback when tagline is null), a dimension sheet with weight + coverage chips, and „Hasznos volt?"
  feedback.
- **„Hol van a napomban" was never on the web recipe page** — it was the *logged meal* evaluation (the day-aware
  `context` dimension, `MealScoringService` mezo-jcpt.19). The recipe template surface deliberately has no context.
  So for recipes this is new, not a restore.

## 2. Goals · non-goals · anti-goals

**Goals**
1. **Richer, colourful score card** in the recipe sheet (web parity, Napkelte look): verdict headline, score ring,
   confidence, contributor rows with a coloured bar + the AI sentence inline, weakest/strongest marked, weight shown.
2. **Food-specific AI text** in Boop's voice: names the actual ingredients, concrete swaps with amounts, a one-line
   verdict (tagline) for every recipe; banned openers („Ez egy … recept", „Ez a sablon …").
3. **„Ha ma megennéd"** — a computed block: today's eaten → after this serving, against today's targets (kcal,
   protein, carbs, fat), plus one generated (template, not LLM) sentence. Instant, free, always fresh.
4. **„A receptjeid között"** — a computed block: where this recipe ranks among the owner's scored recipes (overall
   score, and its standout macro, e.g. protein per serving), and how often it was eaten (logs already loaded).
5. **„Hasznos volt?"** feedback on the AI text (feedback kind `recipe_breakdown` already exists on the server).

**Non-goals:** a new scoring formula or new dimensions; a live per-open LLM call (owner chose computed + cached AI,
2026-11-27); engine-computed point deltas for tips (the template engine emits no `improve` rows — the tip shows its
qualitative tag and which dimension it lifts); the logged-meal evaluation page (it may adopt the same card later);
the recipe list rows.

**Anti-goals** (failure even if it works): a number in the AI text that contradicts the engine; a „Ha ma megennéd"
figure that disagrees with the Étel Ma page; red/error colour for a weak dimension (shame-free — amber, as on the
web); the sheet opening slower than today (cached prose shows instantly; the day/rank blocks are local math);
any personal health value in docs/Notion examples.

## 3. Constraints

- Napkelte canon: colour only in the sky and the orbs → dimension bars use the fuel hue (`Hue.fuel`) at varying
  intensity, weakest in amber; no new colour family. Dark glass cards (`EtelSheetCard`).
- Owner gates: spec OK → **simulator spike OK** (the card is visible) → plan OK.
- Dynamic Type at the largest sizes, VoiceOver label per row (name, value, weakest/strongest, sentence), reduced
  motion (bars appear without animation), smallest iPhone width; no emoji; never „Mezo" in a visible string.
- Day numbers come from the same `FoodDay` (targets + consumed) the Étel Ma page uses — one source.
- Recipe prose stays cached per recipe; a prompt change must invalidate old cached prose (today the cache check
  `RecipeBreakdownService.matches()` compares numbers only).

## 4. Approaches (the „napom" part)

| Approach | What | Trade-off |
|---|---|---|
| **A · Computed + cached AI** (picked) | Day and rank blocks computed in the app from data already loaded; the AI writes the recipe text once and it is cached | Instant, free; the day sentence is template-built, simpler than LLM prose |
| B · Live AI each open | An LLM sentence on today's context per open | 2–4 s wait, a cost per open, can drift from the numbers |
| C · Recipe only | Prettier card + better text, no day/rank | Cheapest; drops what the owner stressed |

Owner picked **A** on 2026-11-27.

## 5. Design

### 5.1 The card, top to bottom (in the recipe sheet, replacing today's „BOOP ÉRTÉKELÉSE" content)

```
BOOP ÉRTÉKELÉSE                                   egy adagra
 (72)   Fehérjében erős reggeli, a só húzza le.        ← verdict (tagline), serif
 ring   ▓▓▓▓▓▓░░ megbízhatóság 80%                     ← confidence level
        [Reggelire] [Edzés után]                       ← fitsFor pills
 Summary — 2–3 food-specific sentences.

 MIBŐL ÁLL ÖSSZE
 ● Makró arány           84  ███████████░░  súly 25%
   A 30 g fehérje a tojásból és a túróból jön…
 ● Só és cukor · WHO     41  █████░░░░░░░░  LEGGYENGÉBB  (amber)
   A sót főleg a feta viszi: 1,4 g egy adagban…
 ● Feldolgozottság       92  ████████████░  LEGERŐSEBB
   …
 (a degraded dimension: „—  még tanulom", no bar)

 HA MA MEGENNÉD
 kcal     1 240 → 1 650 / 2 400   ▓▓▓▓▓▓▓░░
 fehérje    96 → 126 / 176 g      ▓▓▓▓▓▓▓░░
 szénh.   …     zsír …
 „Ezzel a fehérjecélod 72%-án lennél, és még 750 kcal maradna vacsorára."

 A RECEPTJEID KÖZÖTT
 A 30 receptedből a 4. legjobb pontszámú · fehérjében a 2. · 6× etted (utoljára nov. 22.)

 ÍGY LENNE JOBB
 ✦ Cseréld a feta felét túróra (−0,7 g só).   [+ Só és cukor]
 ✦ …

 HASZNOS VOLT?   [Igen] [Nem]
```

Example values above are invented (például). Order rationale: verdict → why (contributors) → my day → my
recipes → what to change → feedback.

- **Contributor rows** replace the `DimensionGrid` in the recipe sheet; tapping a row still opens `DimensionSheet`,
  which gains weight + coverage chips (web `DimSheet` parity). Rows sorted in the engine's order (stable), weakest
  and strongest labelled (only when they differ; degraded dimensions excluded) — web `extremes()` rule.
- **Verdict:** the new `tagline`; while missing (old cache / prose off) a local fallback built from the score band
  and the weakest dimension, never invented facts.
- **Ha ma megennéd:** exactly **one serving** (`Recipe.perServing` — `Recipe.macros` is the whole dish), labelled
  „1 adaggal" (no portion picker — *builder call*), added to `FoodDay.consumed`, against `FoodDay.targets`;
  shown only when today's `FoodDay` is loaded (offline/missing → the block is hidden, not zeroed). Over-target shows
  the number in the same hue with „felett" wording, not red. The sentence is assembled from 3–4 templates in the app
  (protein share, kcal left, over-target case, kímélő day = eaten only, mirroring Étel Ma).
- **A receptjeid között:** ranks over the owner's recipes with a non-nil `fit` from the room's already-loaded recipe
  list (the full list, not paged); `fit` is recomputed on every read like the fresh envelope, so it equals the hero
  score; ties share a rank (*builder call*); the standout macro = the per-serving macro where this recipe ranks best among them (protein per serving
  first); hidden when fewer than 3 scored recipes. Eaten count + last date from the already-loaded `RecipeLog`s.
- **Tips:** text + the dimension it lifts (pill, from the new `dimension` field below; omitted when absent or
  unknown); the impact tag shown when non-empty.

### 5.2 The AI (backend, `RecipeBreakdownProseService`)

- Output gains `"tagline": string` — one sentence, ≤ 70 characters (prompt-enforced; the app shows up to 90 and
  falls back to the local verdict beyond that — *builder call*), food-specific („Fehérjében erős reggeli, a só
  húzza le."). Persisted in the envelope's `tagline` (today hard-coded null for recipes).
- Prompt rewritten in Boop's voice: name concrete ingredients from HOZZÁVALÓK; each tip a concrete swap/add with an
  amount and the dimension it lifts; quote only numbers present in the input; banned openers listed explicitly;
  summary leads with the most telling fact, not a category label.
- Each `improve` row gains `"dimension": string` (one of the dimension ids) — additive on the wire
  (`MealBreakdownJson.ImproveRow` + DTO + openapi, optional; old clients ignore it).
- **No daily targets in the prompt** (*builder call*): cached text quoting „a napi fehérjéd harmada" would drift
  from Étel Ma when targets change (anti-goal). The personal, today-relative part is the computed day block; the AI
  text stays about the food — its ingredients, its role, its weakest/strongest dimension.
- **Cache invalidation:** the stored envelope carries an optional `proseVersion` (JSON column — an old row reads it
  as null); `RecipeBreakdownService.matches()` treats null/older as stale → regenerates lazily on next open (≈30
  recipes, one cheap LLM call each, spread over use). No manual DB write. Additive fields → no breaking change for
  the installed app.

### 5.3 Feedback

„Hasznos volt?" — new small BoopKit client for the existing `/api/companion/feedback` endpoints (kind
`recipe_breakdown`, artifact = recipe id): read the existing vote on open (`GET /feedback/{kind}/{id}`), vote
optimistically, revert + toast on failure. Shown only when there is AI prose (web mezo-76f6 rule).

### 5.4 Approved spike (owner OK 2026-11-28, decisions #139–#140) — this OVERRIDES §5.1 where they differ

Spike branch `spike/boop-receptertekeles` (`ios/Boop/ReceptDemo/ReceptErtekelesDemo.swift`, launch
`-previewRecept YES -previewReceptState full|loading|detail`); screenshots `assets/receptertekeles/`
(`2-napod-szempontok.png`, `3-szempontok-receptjeid.png`, `4-szempont-reszletek.png`).

1. **Order:** hero (rosette + verdict + confidence + fitsFor + summary) → **Ha ma megennéd** → **Miből áll össze** →
   A receptjeid között → Így lenne jobb → Hasznos volt?
2. **Hero mini graphic:** a rosette — one petal per dimension, length = points, each petal in its dimension's
   colour, degraded = faint stub; score number in the centre.
3. **Miből áll össze = 2 rows × 4 tiles** (the current grid's shape, owner liked it): coloured icon circle, number,
   a thin bar in the dimension's colour, short name; the weakest tile has a small amber dot. NOT a list.
4. **Tap = a detail page** rising from the bottom over the **blurred** recipe sheet (owner: „jöhet fel egy oldal ami
   mögött elhomályosul minden és kiírjuk részletesen"; the old `DimensionSheet` text was too short). Content: icon +
   name + big number, long bar, chips (leggyengébb/legerősebb · súly % · lefedettség), **MIT MÉR**, **MIÉRT ENNYI**
   (the full AI paragraph — the prompt's `details.<id>` grows to 3–4 sentences), **A SZÁMOK** (from the envelope's
   existing per-dimension payload: `context` rows, `micros`, `macro` ratio/targets, `nova` stack + items — today
   dropped by the iOS mapping), **HONNAN JÖN** (per-ingredient contribution, see 6), **ÍGY JAVÍTHATÓ** (the tips whose
   `dimension` is this one), Boop note, Kész; tapping the dim background closes it.
5. **Étel colours (decision #140, Étel-wide):** one main colour **green** `#3FBF8F` and two sub colours **honey**
   `#F4C860` and **coral** `#F28B6E`; every dimension its own shade of the three families (macro green, micro lime
   `#A9D86B`, who coral, fat_quality honey, nova mint `#7FDCC0`, plant_diversity leaf `#6CC46A`, energy_density
   apricot `#F5A65B`, portion rose `#F2A3B3`). Day bars: kcal green, protein coral, carbs honey, fat mint; „eddig ma"
   grey. Tip glyphs honey. This slice applies it to the recipe evaluation only; the rest of Étel follows later
   (own bd issue).
6. **HONNAN JÖN — new deterministic backend work:** per dimension that rests on a nutrient (who: salt + sugar;
   fat_quality: saturated fat; micro: fibre; nova: the processed items), the envelope gains the top contributing
   ingredients (name, amount in the nutrient's unit, share 0–1) computed from the recipe's line snapshots — never by
   the LLM. Additive optional field on the dimension (JSON column + DTO + openapi).
7. Largest Dynamic Type: rosette above the verdict (stacked), tiles 2 × 2.

## 6. What's left to the builder

Exact component split (a reusable score card the meal page could adopt later is welcome, not required); the
fallback-verdict wording; the day-sentence templates; where the prose version lives (envelope field vs.
`formulaVersion`-style stamp); test shape.

## 7. Kész, ha…

- Spike approved in the simulator; the built card matches it.
- New recipe opens: verdict, contributors with inline sentences, day block, rank block, tips, feedback all present;
  an old cached recipe regenerates its prose with a tagline on first open.
- No AI number contradicts the engine (spot-check 3 live recipes); day numbers equal Étel Ma's for the same day.
- Empty / loading / error / offline states: loading ring + „számolom", error retry, offline hides day block.
- Dynamic Type largest, VoiceOver per row, reduced motion, smallest width; no emoji, no „Mezo".
- Gates: backend focused tests for the prose service + breakdown cache + `ArchitectureTest`
  (`-Dmezo.test.use-testcontainers=true`); `xcodebuild test` BoopKit + Boop; `gen-codemap`; `lint-docs` 0/0.
- Docs: `docs/features/boop-ios.md`, the recipe feature doc, Boop handbook page; `_jegyek.json`, `_kiadasok.json`.
- Shipped: merged, deployed, live recipes show the new prose, app installed on the phone and walked through.
