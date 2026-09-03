# Meal-score javítások + meal-breakdown UI — Implementation Plan (1/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A meal-score három bejelentett hibájának javítása (kcal nem számít a makró-dimenzióban; a súlyok nem renormalizálódnak degraded dimenziónál → progress-bar bug; üres per-dimenzió próza-fészkek) + a meal-breakdown UI Mozaik 2.0 átépítése a jóváhagyott prototípus szerint.

**Architecture:** A determinisztikus motor (`MealScoringService`, ADR 0006) marad a számok egyetlen forrása; a meal-coach (`MealCoachService`, 1 olcsó LLM-hívás/nap, cache az envelope-ban) bővül per-dimenzió jegyzetekkel. A FE a meglévő `mozaik`/`clay` shared kitre épít.

**Tech Stack:** Spring Boot (Java 21 records), Liquibase NEM kell (jsonb envelope bővül, séma nem), OpenAPI contract-first (`api/feature/meal/meal.yml` → `api.gen.ts`), React + Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-09-03-daily-score-redesign-design.md` · **bd:** mezo-jcpt (szelet-issue-t nyiss alá)

## Global Constraints

- Backend fókuszált tesztek lokálban (`./mvnw test -Dtest=...`); a teljes suite a CI dolga (self-PR gate). Teljes lokál futtatáshoz `-Dmezo.test.use-testcontainers=true` kellene — ne futtasd.
- FE tesztek MINDKÉT módban: `VITE_USE_MOCK=false pnpm test` ÉS `pnpm test` (unset = mock).
- Contract-változás: `api/feature/meal/meal.yml` + regenerált `frontend/src/data/_client/api.gen.ts` UGYANABBAN a commitban (drift-gate).
- `MealScoringProperties.Weights` startup-validáció: a meal-részhalmaz (all−portion) ÉS a template-részhalmaz (all−context) is 1.0-ra összegződik — súlyt nem változtatunk ebben a tervben.
- ArchUnit: layer-alcsomagok (entity/repository/service/controller/mapper/config) kötelezők; `node scripts/gen-codemap.mjs --check` a CI-ben — új fájl után `node scripts/gen-codemap.mjs`.
- UI: KIZÁRÓLAG Mozaik 2.0 nyelv (CLAUDE.md „Design direction”): wash-csempék, clay ikonok (emoji tilos), sring gyűrűk. Jóváhagyott prototípus: https://claude.ai/code/artifact/c9aada04-9149-429e-ad16-b0a0fc8d3be2 (3. képernyő).
- Konvencionális commit-subject a szelet bd-idjével.

---

### Task 1: macroDim — a kcal-jelentőség ténylegesen számítson

A hiba: egy pici (pl. 100 kcal) étkezés fura P/C/F arányai ugyanakkora levonást kapnak, mint egy főétkezéséi, pedig a kcal-hatásuk elhanyagolható. A fix: az arány-eltérés büntetése a meal kcal-jelentőségével skálázódik — `significance = min(1, kcalShare / significanceRefShare)`. Egy nap ≥25%-át adó étkezés teljes súllyal számít, egy 5%-os snack ötödével. A kcal-share így már nem display-only: ő a jelentőség-tényező.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java:261-296` (macroDim)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/MealScoringProperties.java` (új mező)
- Modify: `backend/src/main/resources/application.yml` (~:1279, a `macro-protein-surplus-penalty` alá)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: meglévő `Dim macroDim(List<ScoredLine>, double kcal, int tp, int tc, int tf, DailyTargets base)`.
- Produces: változatlan szignatúra; új property `mealScoringProperties.macroSignificanceRefShare()` (double, 0..1, default 0.25). A `MacroDetail` változatlan.

- [ ] **Step 1: Failing test** — a meglévő tesztfájl mintáit követve (nézd meg, hogyan épít `ScoredLine`-t és propertyt a fájl eleje):

```java
@Test
void macroDim_tinySnack_ratioDeviationIsScaledByKcalSignificance() {
    // Egy ~100 kcal-os, csupa-zsír snack (P0/C0/F11g): korábban score ~0 volt.
    // 2600 kcal-os napcélnál kcalShare ≈ 0.038 → significance ≈ 0.038/0.25 ≈ 0.153,
    // deviation×slope×significance ≈ 1.0×2.0×0.153 → score ≈ 0.69, NEM 0.
    List<ScoredLine> lines = List.of(line("Vaj", kcal(99), p(0), c(0), f(11)));
    MealBreakdownJson b = service.scoreMeal("snack", lines, LocalTime.of(16, 0));
    Dimension macro = dim(b, "macro");
    assertThat(macro.score().doubleValue()).isBetween(0.6, 0.8);
}

@Test
void macroDim_mainMealSignificanceCapsAtOne() {
    // Egy 900 kcal-os ebéd (share ~0.35 > 0.25) teljes súllyal számít — a régi képlettel azonos.
    List<ScoredLine> lines = List.of(line("Ebéd", kcal(900), p(20), c(150), f(20)));
    MealBreakdownJson b = service.scoreMeal("lunch", lines, LocalTime.of(13, 0));
    Dimension macro = dim(b, "macro");
    // referencia-érték: számold ki kézzel a teszt tetején kommentben (deviation → 1−dev×2.0)
    assertThat(macro.score().doubleValue()).isLessThan(0.65); // a torz arány főétkezésnél büntet
}
```

- [ ] **Step 2: Run test — FAIL** · `./mvnw test -Dtest=MealScoringServiceTest` (a két új teszt bukjon: az első score≈0-t kap, a property még nem létezik → előbb compile-hiba, azt a Step 3 oldja).

- [ ] **Step 3: Implementáció**

`MealScoringProperties`-be (a `macroProteinSurplusPenalty` mező alá):

```java
    /** kcal-share of the day at (or above) which a meal's macro-ratio deviation counts in full;
     *  smaller meals scale linearly (a 100-kcal snack can no longer tank the macro dimension). */
    @DecimalMin("0.05") @DecimalMax("1.0") double macroSignificanceRefShare,
```

`application.yml` (a `macro-protein-surplus-penalty: 0.0` alá):

```yaml
      # A meal's ratio-deviation counts in full at/above this kcal-share of the day; below it the
      # penalty scales down linearly (the "tiny snack can't tank the macro dim" fix, mezo-jcpt).
      macro-significance-ref-share: 0.25
```

`macroDim`-ben a score-sor cseréje (`kcalShare` felkerül a deviation elé):

```java
        double kcalShare = kcal / base.kcal();
        double significance = Math.min(1.0, kcalShare / props.macroSignificanceRefShare());
        double score = Math.max(0, 1 - deviation * props.macroDeviationSlope() * significance);
```

(A metódusvégi régi `double kcalShare = ...` sort töröld — feljebb került.)

- [ ] **Step 4: Run test — PASS** · `./mvnw test -Dtest=MealScoringServiceTest` (a RÉGI makró-tesztek közül ami főétkezés-méretű, változatlanul zöld; ha egy régi teszt kicsi kcal-lal tesztelt arány-büntetést, igazítsd az elvárását és kommentben indokold).

- [ ] **Step 5: Commit** · `git add -A && git commit -m "fix(nutrition): macro dim scales ratio deviation by kcal significance (mezo-jcpt)"` (a szelet-issue idjével, ha külön nyitottad).

---

### Task 2: scoreMeal súly-renormalizálás degraded dimenziónál

A hiba: `scoreMeal` a `toJson`-ban a NEM renormalizált súlyokat emitálja (degraded dim súlya 0, a többi config-súlyon marad → Σ ≠ 1), miközben a template-path (`recipeTemplateBreakdown` :212–215) helyesen hívja `d.renormalized(weightSum)`-ot. A FE (`ScoreLedger`) 1-re összegződő súlyokat feltételez.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java:140-142`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Produces: a `MealBreakdownJson.dimensions` súlyai MINDIG 1.0-ra összegződnek az élő dimenziókon (degraded: weight 0 marad, score 0, "Nincs adat" detail — a sor megmarad az envelope-ban, csak súlytalanul). Downstream: a FE `Σ weight·score·100 == value·100` invariánsra építhet (Task 5).

- [ ] **Step 1: Failing test**

```java
@Test
void scoreMeal_weightsRenormalizeWhenADimensionDegrades() {
    // Nincs micro-facts, nincs nova, nincs kategória, nincs amountG → micro/who/fat_quality/
    // nova/plant_diversity/energy_density degraded; csak macro+context él.
    List<ScoredLine> lines = List.of(new ScoredLine("Rizs", "100 g",
        BigDecimal.valueOf(350), BigDecimal.valueOf(7), BigDecimal.valueOf(77), BigDecimal.ONE,
        null, null, null, null, null, false, null, null));
    MealBreakdownJson b = service.scoreMeal("lunch", lines, LocalTime.of(12, 30));
    double liveWeightSum = b.dimensions().stream()
        .mapToDouble(d -> d.weight().doubleValue()).sum();
    assertThat(liveWeightSum).isCloseTo(1.0, within(0.02)); // round2 miatt tolerancia
    // és a ledger-invariáns: Σ(weight·score) == value
    double ledger = b.dimensions().stream()
        .mapToDouble(d -> d.weight().doubleValue() * d.score().doubleValue()).sum();
    assertThat(ledger).isCloseTo(b.value().doubleValue(), within(0.03));
}
```

- [ ] **Step 2: Run — FAIL** · `./mvnw test -Dtest=MealScoringServiceTest` (a súly-összeg ~0.34 lesz, nem 1.0).

- [ ] **Step 3: Implementáció** — a `scoreMeal` return-je a template-path mintájára:

```java
        List<Dimension> jsonDims = weightSum == 0
            ? dims.stream().map(Dim::toJson).toList()
            : dims.stream().map(d -> d.renormalized(weightSum).toJson()).toList();
        return new MealBreakdownJson(round2(value), round2(confidence), null, null,
            jsonDims, List.of(), tools(slot, lines, dims, localTime, base));
```

- [ ] **Step 4: Run — PASS**, majd a TELJES scoring-tesztfájl: `./mvnw test -Dtest='MealScoringServiceTest,MealCoach*Test'` — ha egy régi teszt konkrét súly-értéket assertel (pl. `0.22`), frissítsd a renormalizált értékre kommenttel.

- [ ] **Step 5: Commit** · `git commit -m "fix(nutrition): scoreMeal renormalizes dimension weights over live dims (mezo-jcpt)"`

---

### Task 3: Per-dimenzió jegyzet a contractban + envelope-ban

Az 1-2 mondat minden dimenzió alá: a `Dimension` rekord kap egy nullable `note` prose-mezőt (egységes, egyszerűbb, mint detail-típusonkénti fészkek; a meglévő `MacroDetail.notes` marad, de nem használjuk — deprecated kommentet kap).

**Files:**
- Modify: `api/feature/meal/meal.yml` (~:184-271, `MealDimension` schema + `MealCoachVerdict`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/MealBreakdownJson.java` (Dimension + MacroDetail komment)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java` (Dim.toJson: note=null)
- Regen: `frontend/src/data/_client/api.gen.ts` (a repo contract-regen scriptjével — nézd meg: `grep -rn "api.gen" package.json api/README* Makefile` a pontos parancsért; jellemzően `pnpm gen:api` vagy hasonló)

**Interfaces:**
- Produces: `MealBreakdownJson.Dimension` új utolsó mezője: `String note` (null a determinisztikus írásnál); contract `MealDimension.note: { type: string, nullable: true }`; `MealCoachVerdict` új mezője: `dimensionNotes: { type: object, additionalProperties: { type: string }, nullable: true }` (dim-id → 1-2 mondat). Task 4 írja, Task 6 rendereli.

- [ ] **Step 1: Contract-módosítás** — `meal.yml` `MealDimension` properties-éhez:

```yaml
        note:
          type: string
          nullable: true
          description: 1-2 mondatos AI-jegyzet ehhez a dimenzióhoz (meal-coach tölti; determinisztikusan null)
```

és a `MealCoachVerdict`-hez:

```yaml
        dimensionNotes:
          type: object
          nullable: true
          additionalProperties: { type: string }
          description: dim-id → 1-2 mondat; a breakdown dimension.note tükre a frissen generált verdictben
```

- [ ] **Step 2: Backend record-bővítés** — `MealBreakdownJson.Dimension` kap `String note` utolsó mezőt; `MealScoringService.Dim.toJson()` `null`-t ad át; a `MacroDetail.notes` javadocjába: `@deprecated a dim-szintű {@code Dimension.note} váltja (mezo-jcpt); olvasni senki nem olvassa`. Minden `new Dimension(...)` hívóhely (grep: `rg "new Dimension\(" backend/src`) megkapja a `null` utolsó argumentumot.

- [ ] **Step 3: Build + regen** · `./mvnw compile -q -pl backend` zöld; contract-regen fut; `git diff --stat frontend/src/data/_client/api.gen.ts` mutat MealDimension.note-ot.

- [ ] **Step 4: Fókuszált tesztek** · `./mvnw test -Dtest='MealScoringServiceTest,MealCoachServiceTest'` zöld (mechanikus bővítés, új teszt nem kell — a viselkedést Task 4 teszteli).

- [ ] **Step 5: Commit** · `git commit -m "feat(meal): dimension-level note socket in envelope + contract (mezo-jcpt)"`

---

### Task 4: MealCoach — per-dimenzió jegyzetek generálása és perzisztálása

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachService.java` (SYSTEM_PROMPT, ExtractedVerdict, persist, toVerdict)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealCoachStore.java` (`writeProse` szignatúra-bővítés)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/MealCoachServiceTest.java` (meglévő minták szerint — fake `MealCoachLlm` válasszal)

**Interfaces:**
- Consumes: Task 3 `Dimension.note` mezője.
- Produces: `MealCoachStore.writeProse(UUID userId, UUID mealId, String summary, String tagline, List<ImproveRow> improve, Map<String, String> dimensionNotes)` — a notes a breakdown dimensions listájába íródik (id-egyezés alapján, ismeretlen id-k csendben eldobva); `MealCoachVerdict.dimensionNotes` kitöltve.

- [ ] **Step 1: Failing test** — a meglévő MealCoachServiceTest fake-LLM mintájával:

```java
@Test
void coach_writesDimensionNotesIntoEnvelope() {
    // A fake LLM válasza tartalmaz dimensionNotes-t; elvárás: a meal breakdown-jában a
    // "macro" dimenzió note-ja kitöltődik, ismeretlen id ("bogus") eldobódik.
    fakeLlmAnswer("""
        {"meals":[{"mealId":"%s","tagline":"Jó ebéd","summary":"Rendben volt.",
          "improve":[],"dimensionNotes":{"macro":"A fehérje erős ehhez az adaghoz.",
          "bogus":"eldobandó"}}]}""".formatted(mealId));
    service.generateForMeal(userId, mealId);
    MealBreakdownJson stored = reloadBreakdown(mealId);
    assertThat(dim(stored, "macro").note()).isEqualTo("A fehérje erős ehhez az adaghoz.");
    assertThat(stored.dimensions().stream().map(Dimension::note)
        .filter(n -> "eldobandó".equals(n))).isEmpty();
}
```

- [ ] **Step 2: Run — FAIL** (compile-hiba az ExtractedVerdict-en → add hozzá, majd asszertáció-bukás).

- [ ] **Step 3: Implementáció**
  1. `ExtractedVerdict` bővül: `Map<String, String> dimensionNotes`.
  2. SYSTEM_PROMPT JSON-sémája bővül: `"dimensionNotes":{"<dim-id>":"1-2 mondat"}` + szabály-sorok:
     `- dimensionNotes: a kapott dimenzió-id-khez (macro, micro, who, fat_quality, nova, plant_diversity, energy_density, context) írj 1-2 mondatot — MINDIG az adott dimenzió számaiból indulj ki, és ahol tudsz, köss át más adatra (edzés-szerep, napi keret állása, a nap többi étkezése). A "Nincs adat" (weight 0) dimenziókhoz NE írj.`
  3. `persist(...)`: `store.writeProse(userId, mealId, v.summary(), tagline(v.tagline()), improve(v), notes(v))` ahol `notes(v)` null-safe, blank-értékeket szűr, max 240 char/note trim.
  4. `MealCoachStore.writeProse` a dimensions listát átírja: `dimensions.stream().map(d -> notes.containsKey(d.id()) ? withNote(d, notes.get(d.id())) : d)` — `withNote` a rekord összes mezőjét másolja + note. (A store rövid tranzakciós mintája változatlan.)
  5. `toVerdict` kitölti a `dimensionNotes`-t a stored dimensions note-jaiból.
- [ ] **Step 4: Run — PASS** · `./mvnw test -Dtest='MealCoachServiceTest,MealCoachApiIT'` (az IT-t nézd meg: ha fix LLM-válasz JSON-t assertel, bővítsd). A SwitchOff IT (`MealCoach*SwitchOff*IT` — grep a pontos névért) változatlanul zöld: kikapcsolt coachnál note-ok nélkül jön az envelope.
- [ ] **Step 5: Commit** · `git commit -m "feat(meal): coach fills per-dimension notes (mezo-jcpt)"`

---

### Task 5: FE — ScoreLedger javítás + note-renderelés a DimensionCard-ban

**Files:**
- Modify: `frontend/src/features/fuel/components/ScoreLedger.tsx`
- Modify: `frontend/src/features/fuel/components/ScoreBreakdownBody.tsx:24`
- Modify: `frontend/src/features/fuel/components/DimensionCard.tsx`
- Test: `frontend/src/features/fuel/components/ScoreLedger.test.tsx` (új), meglévő `MealScoreSheet.test.tsx` bővítés

**Interfaces:**
- Consumes: renormalizált súlyok (Task 2) + `MealDimension.note` (Task 3 regen).
- Produces: `ScoreLedger` a weight-0 (degraded) dimenziókat kihagyja a sávból és a %-sorból, helyettük egy halk „Nincs adat: <label · label>” sort tesz a sáv alá; a Σ mindig a fejléc-számmal egyezik. `DimensionCard` a `dim.note`-ot a determinisztikus `detail` mondat ALATT rendereli (12.5px, `var(--text-secondary)`, sparkle-ikonnal).

- [ ] **Step 1: Failing test** (`ScoreLedger.test.tsx`):

```tsx
it('kihagyja a degraded dimenziót a sávból és Nincs adat sorként mutatja', () => {
  const dims = [
    { id: 'macro', label: 'Kcal & makró', weight: 0.65, score: 0.8, color: '#8FAF7E' },
    { id: 'context', label: 'Időzítés', weight: 0.35, score: 0.9, color: '#4E8FB8' },
    { id: 'nova', label: 'NOVA', weight: 0, score: 0, color: '#C9962E' },
  ] as MealDimension[]
  render(<ScoreLedger dimensions={dims} />)
  expect(screen.getByText(/Nincs adat/)).toHaveTextContent('NOVA')
  // a %-sor csak az élő dimenziókat sorolja
  expect(screen.queryByText('0%')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run — FAIL** · `VITE_USE_MOCK=false pnpm test ScoreLedger`

- [ ] **Step 3: Implementáció** — `ScoreLedger`:

```tsx
export function ScoreLedger({ dimensions }: { dimensions: MealDimension[] }) {
  const live = dimensions.filter(d => d.weight > 0)
  const degraded = dimensions.filter(d => d.weight === 0)
  const sum = live.reduce((s, d) => s + d.weight * d.score * 100, 0)
  return (
    <div className="sb-ledger" aria-label="Pontszám-összetétel">
      <div className="sb-ledger-bar">
        {live.map(d => (
          <span key={d.id} className="sb-ledger-seg" style={{ flexGrow: d.weight, flexBasis: 0 }}>
            <i style={{ width: `${Math.round(d.score * 100)}%`, background: d.color }} />
          </span>
        ))}
      </div>
      <div className="sb-ledger-sum">
        <span>
          {live.map((d, i) => (
            <span key={d.id}>
              {i > 0 && <em> · </em>}
              <b style={{ color: d.color }}>{Math.round(d.weight * 100)}%</b>
            </span>
          ))}
        </span>
        <span><em>Σ</em> <b>{hu1(sum)}</b> / 100</span>
      </div>
      {degraded.length > 0 && (
        <div className="sb-ledger-mut">
          Nincs adat: {degraded.map(d => d.label).join(' · ')} — nem számít bele a pontba
        </div>
      )}
    </div>
  )
}
```

(`.sb-ledger-mut` a prototype.css meglévő ledger-blokkja mellé: `font: 500 10px/1.4 var(--ff-body); color: var(--text-muted); margin-top: 4px;` — keresd a `.sb-ledger` szelektort és tedd mellé.) `ScoreBreakdownBody:24` fallback-total ugyanígy `live`-ra szűr. `DimensionCard`: a `detail` sor alá:

```tsx
{dim.note && (
  <p className="dim-note" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: 6 }}>
    <Icon name="sparkle" size={10} color="var(--lav-deep)" /> <SafeMarkdown text={dim.note} />
  </p>
)}
```

- [ ] **Step 4: Run — PASS mindkét módban** · `VITE_USE_MOCK=false pnpm test features/fuel` és `pnpm test features/fuel`. A fuel mock-adatban (`grep -rn "breakdown" frontend/src/data/fuel/*ock*`) adj note-okat 1-2 dimenzióhoz, hogy a mock-mód is renderelje.
- [ ] **Step 5: Commit** · `git commit -m "fix(fuel): honest ledger (degraded dims out of the bar) + dimension notes (mezo-jcpt)"`

---

### Task 6: FE — meal-breakdown Mozaik 2.0 átépítés

A jóváhagyott prototípus 3. képernyője: dimenziónként wash-csempe (clay ikon + súly-eyebrow + sring + saját grafika + note), Mezo-kártya improve-chipekkel, Σ-csempe. A meglévő 8 valós dimenzióra fordítva: macro (sage, gbar-sávok), nova (amber, meglévő NovaDetail stack → stackbar+legend), context (sky, ContextRow-k + időzítés), micro/rost (rose, MicroRow gbar), who + fat_quality + plant_diversity + energy_density (kompakt fehér csempék ContextRow-kkal), degraded → ghost-csempe.

**Files:**
- Modify: `frontend/src/features/fuel/components/ScoreBreakdownBody.tsx` (csempe-elrendezésre vált)
- Modify: `frontend/src/features/fuel/components/DimensionCard.tsx` (wash + sring + clay ikon; a collapsible viselkedés marad)
- Modify: `frontend/src/features/fuel/sheets/MealScoreSheet.tsx` (Mezo-kártya: lila revcard-stílus + improve-chipek felköltöznek a summary alá)
- Test: `frontend/src/features/fuel/sheets/MealScoreSheet.test.tsx` bővítés
- NEM módosul: `RecipeScoreSheet` hívási felülete (ugyanazt a `ScoreBreakdownBody`-t kapja — pixel-azonosság a két felületen automatikus).

**Interfaces:**
- Consumes: `MealDimension` (note-tal), `NovaDetail.stack`, `MicroRow`, `ContextRow`, `MealCoachVerdict.improve`, a `mozaik`/`clay` shared kit (`import { ClayIcon } from '@/shared/ui/clay'` — a pontos exportokat nézd meg: `frontend/src/shared/ui/clay/index.ts`).
- Produces: vizuális átépítés, viselkedési contract változatlan (ugyanazok a dimenziók, ugyanaz a collapsible minta).

- [ ] **Step 1: Failing test** — `MealScoreSheet.test.tsx`-be:

```tsx
it('improve-javaslatok pont-chipként a Mezo-kártyán jelennek meg', () => {
  // mock meal breakdown-nal + verdict improve-vel ("+0.04 score" impact)
  // elvárás: a summary-kártyán belül van a chip, "+4 pont" szöveggel
  ...render a sheet a meglévő teszt-fixture mintájára...
  const card = screen.getByText(/Mezo · olvasat/).closest('.card')!
  expect(within(card).getByText(/\+4/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — FAIL** · `VITE_USE_MOCK=false pnpm test MealScoreSheet`
- [ ] **Step 3: Implementáció** — a prototípus CSS-mintáit (predtile-wash, sring, stackbar, impch) a fuel feature meglévő stíluscsatornáján keresztül valósítsd meg (nézd meg, hogyan stílusoz a `DimensionCard` ma: ha inline+utility, maradj annál; ha van fuel-szintű css, oda kerüljenek `.dim-tile.sage/.amber/.sky/.rose/.ghost`, `.dim-sring`, `.dim-stackbar`, `.imp-chip` osztályok a prototípus értékeivel — wash-gradiensek és színes árnyékok a prototype.css `--mz-wash-*`/`--mz-shadow-*` tokenjeiből, SOHA nem új literálokból). Dimenzió→szín/ikon térkép egy helyen:

```tsx
const DIM_FACE: Record<string, { wash: string; icon: ClayIconName }> = {
  macro: { wash: 'sage', icon: 'fuel' }, nova: { wash: 'amber', icon: 'termes' },
  context: { wash: 'sky', icon: 'idozito' }, micro: { wash: 'rose', icon: 'eletjel' },
  who: { wash: 'white', icon: 'rend' }, fat_quality: { wash: 'white', icon: 'lombik' },
  plant_diversity: { wash: 'white', icon: 'kamra' }, energy_density: { wash: 'white', icon: 'erme' },
}
```

(Az ikon-neveket ellenőrizd a clay kit tényleges készletéből — `frontend/src/shared/ui/clay`; ha egy név hiányzik, a legközelebbi meglévőt használd és jegyezd fel.) A NOVA-csempe a `NovaDetail.stack`-ből épít stackbart (szín: sage/gold/sky/terrakotta a 4 csoportra), a macro-csempe 3 `gbar`-t a ratioP/C/F vs target-sávokból, a context-csempe a ContextRow-kat chipsorként.

- [ ] **Step 4: Vizuális ellenőrzés + tesztek** — `pnpm test features/fuel` mindkét módban zöld; majd runtime-ellenőrzés a `verify` skill receptje szerint (mock-mód PWA, fuel napló → meal chip → sheet): képernyőkép a sheetről, vesd össze a prototípussal.
- [ ] **Step 5: Commit** · `git commit -m "feat(fuel): Mozaik 2.0 meal-breakdown tiles + improve chips (mezo-jcpt)"`

---

### Task 7: Kapuk + szelet-zárás

- [ ] **Step 1: Backend fókusz-suite** · `./mvnw test -Dtest='MealScoringServiceTest,MealCoachServiceTest,MealCoach*IT,MealScore*IT'` zöld.
- [ ] **Step 2: FE mindkét mód + build** · `VITE_USE_MOCK=false pnpm test && pnpm test && pnpm build` zöld.
- [ ] **Step 3: Codemap + ArchUnit** · `node scripts/gen-codemap.mjs` (ha új fájl keletkezett, a diff bekerül); `./mvnw test -Dtest='*ArchUnit*'` (a pontos tesztosztály-nevet grep-peld) zöld.
- [ ] **Step 4: fuel.md doksi-frissítés** — `docs/features/fuel.md`: a score-szekcióban (a) a macro-dim új jelentőség-skálázása, (b) a renormalizált súly-emisszió, (c) a dim-note próza-réteg; a header elavult „PROSE null until P8” sorát is javítsd. Commit: `docs(fuel): score fixes + dimension notes`.
- [ ] **Step 5: bd + push** — a szelet-issue zárása (`bd close <id>`), majd a repo PR-flow-ja szerint: push branch → self-PR → CI zöld → `--no-ff` merge lokálban → push main.
