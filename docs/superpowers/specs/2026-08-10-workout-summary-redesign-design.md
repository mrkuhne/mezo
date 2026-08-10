# Edzés-összefoglaló + lezárt edzés — egységes redesign — design spec

- **Dátum:** 2026-08-10
- **Driving bd:** `mezo-w943`
- **Előzmény:** a `WorkoutSummary` a 2026-07-15-ös finish-screen/done-day-review spec szürke, mono-soros változata; azóta a ház nyelve továbblépett — execution card v2 izomcsalád-témázás (`mezo-8xmf`), Napiv wash/tag pillek, Today/Fuel hero-szám + halo idióma (`mezo-jgh9`).
- **Mockup (validált):** [`assets/2026-08-10-workout-summary-redesign-mockup.html`](assets/2026-08-10-workout-summary-redesign-mockup.html) — a user az irányt jóváhagyta; a mockup nyílt kérdései a mockolt állapot szerint záródtak (Ø RIR cella marad; Kihívások a Medálok után), a jegyzet-perzisztálás **kikerült** külön issue-ba (`mezo-s52z`).

## 1. Cél

A két képernyő — az **edzés végi összefoglaló** (`mode: closing`, az „Edzés lezárása ✓" előtti képernyő az `ActiveWorkoutPage`-ben) és a **lezárt edzés részletei** (`mode: closed`, `/train/review/:workoutId` + a lezárás utáni `complete` fázis) — **egy váz, két mód** marad, de a szürke listák helyét a ház színes pill/chip nyelve veszi át. Frontend-only változás: **nincs API/backend módosítás**, minden adat meglévő forrásból jön.

## 2. A képernyő anatómiája (mindkét mód)

Fentről lefelé:

1. **Topbar** — closing: `✕ Bezárás` (roundel + mono felirat); closed: `← Vissza`.
2. **Hero + halo** — eyebrow (closing: `EDZÉS VÉGE` coral-deep; closed: `LEZÁRVA · {huMonthDayDow}` muted) + cím (a nap típusa, pl. „Pull Day") + **hero-szám**: `{doneSets}/{plannedSets} szett` (Geist 200, ~54px, tabular) + tény-subtitle: `{volumen} t összvolumen · {doneEx}/{összes} gyakorlat · ~{durationEst} perc`. A hero mögött **halo-blob** (a sziget-blob nyelve): closing → coral-amber „ünneplő", closed → sage-amber „nyugodt" (lassabb animáció); `prefers-reduced-motion` → állókép. Medál-cím-toldalék (` · N medál`) megszűnik — a strip Rekord cellája viszi.
3. **Izomrégió-pillek** — a session gyakorlatainak `muscle` mezőiből `muscleRegion()`-nel régióra aggregálva (Hát · Váll · Kar · …), wash/deep családszínnel + kész munkaszett-számmal, a hero-szám sorrendjében a legtöbb szett elöl. Az a régió, amelynek minden gyakorlata elmaradt (0 logolt szett), **áthúzott, halvány** `off` pillt kap. Ismeretlen/legacy muscle-kulcs (`muscleRegion() === null`) kimarad az aggregálásból.
4. **Mérleg-strip** — 4-cellás StatStrip (`1px` divider-rács, `r-lg`): `Volumen {t} t` · `Rekord {n} 🏅` (amber érték; 0 → neutrális szín) · `Célszett {n} ✓` (sage; 0 → neutrális) · `Ø RIR {x,y}` (a logolt szettek RIR-átlaga egy tizedesre; 0 logolt szett → `–`). A régi „Mai mérleg" 3 fehér doboza megszűnik.
5. **Medálok** (csak ha van) — a RECORD-tier medálok **amber ünneplő kártyák**: 🏅 roundel + típus-label (`MEDAL_TYPE_LABEL`) + gyakorlatnév, jobbra `medalValueLabel()` + `előző: {previousValue}` sor. A TARGET_HIT-ek **egyetlen sage összegzősorba** csomagolódnak: `✓ {n} célszett teljesítve` + gyakorlatonkénti darabszám-chipek (`{név} ×{n}`). A RECORD-first rendezést a szétválasztás váltja ki; a section-label mellé mono számláló kerül (`2 rekord · 9 cél`).
6. **Kihívások** (csak ha van) — soronként: állapot-roundel (hit: sage ✓ · miss: warning ◯ · skipped/inconclusive: neutrális ⊘/◌) + `typeLabel · exercise` + mono részletsor (`detail ?? target`) + jobbra **kimenet-chip** (`megvan` / `nem jött össze` / `skippelted` / `nem értékelhető`) a státusz wash-színében. Section-label számlálóval (`1 megvan · 1 kimaradt`).
7. **Gyakorlatonként — a szett-chip-térkép** (a redesign szíve) — gyakorlatonként **family-rail kártya** (5px bal rail + felül 10% family-gradient wash, az execution card v2 nyelve, szín: `muscleColor(muscle)`): fejsor = név + **izom-tag pill** (`MUSCLE_LABELS`-ből, wash/deep) + `n/m` mono szett-számláló (family-deep; részleges teljesítés → warning-hover). Alatta a szettek **chip-sora** (wrap): `{súly} × {reps} @{rir}` mono chipek. Kiemelések: a **rekord-szett** (RECORD medál `exerciseName`+`setIndex` egyezés) 🏅 amber chip; a **top szett** (legnagyobb súly, holtverseny → több rep) family-wash chip; a be nem fejezett tervezett szettek **egy** szellem-chipet kapnak (`— kimaradt`, szaggatott keret). Elhagyott gyakorlat (0 szett): halvány kártya, áthúzott név, `kihagyva` felirat, nincs chip-sor. A closing-mód eddigi „csak top-szett" nézete megszűnik: **a chip-térkép mindkét módban teljes** (a `showSetLines` prop kihal).
8. **Jegyzet** — csak closing: a mai presentational textarea új kártya-ruhában (mono label + Fraunces placeholder). Closed módban nincs jegyzet-blokk (perzisztálás: `mezo-s52z`).
9. **CTA-sor** — closing: coral gradient `Edzés lezárása ✓` (pill, `shadow-cta`) + ghost `← Vissza az edzéshez`; closed: ghost `← Vissza`. Viselkedés változatlan (`onFinish`/`finishPending`/`onBack`/`onExit`).

## 3. Módok — mi tér el

| | closing (összefoglaló) | closed (részletek / complete fázis) |
|---|---|---|
| eyebrow | `EDZÉS VÉGE` (coral) | `LEZÁRVA · {dátum}` (muted; complete fázisban `LEZÁRVA · MA`) |
| halo | `fire` (coral-amber, 9s) | `calm` (sage-amber, 14s) |
| jegyzet | textarea (presentational) | — |
| CTA | gradient finish + ghost back | ghost back |
| minden más | **azonos** | **azonos** |

## 4. Komponens-terv

- **`components/WorkoutSummary.tsx`** — marad az egyetlen megosztott komponens, teljes újraszabással. Prop-változások: `SummaryExercise` bővül `muscle: string`-gel; új `durationMin?: number | null` prop (closing: `W.durationEst`, closed: `detail.durationEst`); a `showSetLines` prop **törlődik** (mindig teljes chip-térkép). A `medals`/`challenges`/CTA-propok változatlanok.
- **`logic/summaryStats.ts`** (új, pure) — a képernyő összes derivációja egy helyen, táblás tesztekkel: `deriveSummaryStats(exercises, medals)` → { doneSets, plannedSets, volumeT, doneEx, totalEx, avgRir | null, regionPills (rendezett, off-flaggel), recordMedals, targetGroups (gyakorlatonként számlálva), perExercise: topSetIndex + recordSetIndexek + missingCount }. A rekord-szett párosítás kulcsa `exerciseName` + `setIndex`; `setIndex == null` → az érték-egyezés (weightKg+reps) a fallback, különben nincs chip-jelölés (a medál-kártya attól még él).
- **CSS** — a vocabulary a `prototype.css`-be kerül `wsum-` prefixszel (hero/halo, régió-pill, strip, medál-kártya, target-sor, kihívás-sor, gyakorlat-kártya + set-chip család), a mockup CSS-éből átemelve; a family-színezés a kártyákon inline `--fam-*` custom-propokkal (`muscleColor()`), az execution card v2 mintájára. Izom-label: a meglévő `MUSCLE_LABELS` (`frontend/src/data/train/train.ts`) újrafelhasználva.
- **Hívók** — az `eyebrow` prop szabad szöveg marad, a mode csak a színt/halot vezérli — `WorkoutReviewPage`: mapping bővül `muscle`-lel + `durationMin={detail.durationEst}`, eyebrow változatlanul `Lezárva · {huMonthDayDow}`. `ActiveWorkoutPage`: mapping bővül `muscle`-lel (`W.exercises` → `LoggedWorkoutExercise.muscle`), `durationMin={W.durationEst}`, closing-eyebrow a cím-duplikáció helyett csak `Edzés vége` (a cím külön sorban él); a `showSetLines` prop-átadás törlődik.

## 5. Adatok és őszinte állapotok

Minden adat meglévő hookból: `useWorkoutDetail` (closed), a session state + `useChallenges` + `sessionMedals` (closing). Nincs backend-hívás-változás. Őszinteség: Ø RIR 0 logolt szettnél `–`; medál/kihívás-section üresen **nem renderel**; `durationEst` hiányában (0/undefined) az idő-tag kimarad a subtitle-ből; a jegyzet closed módban nem jelenik meg, mert nem perzisztál (`mezo-s52z`); a Rekord/Célszett cella 0-nál nem színez (nem ünneplünk semmit).

## 6. A11y, tesztek, goldenek

- A halo `aria-hidden`, tisztán dekoratív; reduced-motion → nincs animáció. A régió-pillek és set-chipek **nem** interaktívak (statikus `span`-ok), a kártya-fejsor szöveges tartalma viszi az információt; a rekord/top kiemelés szövegesen is jelen van (🏅 emoji + a medál-kártya). A CTA-k és a topbar gombok fókusz-sorrendje változatlan.
- Tesztek: `summaryStats` táblás unit-teszt (aggregálás, off-régió, avgRir null-ág, rekord-szett párosítás setIndex/fallback ágai); `WorkoutSummary.test.tsx` frissítés (két mód, chip-térkép, üres-section ágak); `WorkoutReviewPage.test.tsx` + `ActiveWorkoutPage` summary-fázis tesztek zöldre igazítása. Gate: `pnpm build` + mindkét mód tesztjei zöldek.
- Visual goldenek: a spec írásakor a visual suite **nem fedi** a summary/review képernyőt (`train-session` a prep-fázist pinneli) — darwin futással ellenőrizni, hogy tényleg nincs diff; ha mégis, a `mezo-uz4g` workflow szerint regenerálni (darwin + linux).

## 7. Scope-on kívül

Jegyzet-perzisztálás (`mezo-s52z`); backend/API-változás; a MedalToast/MedalsPage érintése; az ActiveWorkoutPage aktív fázisa; a `/train/review` route-szerkezet; dark-mode token-újrahangolás (a wash/tag tokenek mindkét témában léteznek). Dokumentáció (a `train.md` finish/review szakaszai) az implementáció része.
