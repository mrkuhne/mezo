# Fuel Mai „Keret-hero” — design spec (window-river iteráció)

- **Dátum:** 2026-08-09 · **Driving bd:** `mezo-c9t5`
- **Előzmény:** a window-river Mai ([`2026-08-08-fuel-window-river-design.md`](2026-08-08-fuel-window-river-design.md), [ADR 0023](../../decisions/0023-fuel-window-river.md)) — ennek user-visszajelzés utáni iterációja. A mockup-iteráció (v1→v4) a userrel zajlott; a validált végállapot: [`assets/2026-08-09-fuel-keret-hero-mockup.html`](assets/2026-08-09-fuel-keret-hero-mockup.html).
- **Megoldja:** `mezo-cs8b` (meal-score újra-otthonosítás).

## 1. Mi változik a window-riverhez képest

1. **A Keret-öv megszűnik** (`KeretBelt` retirál, a `?w=keret` állapot kivezet) — helyette a **Keret-hero** a lap tetején, az AppHero alatt: a retirált `DayBudgetCard` elrendezésének visszahozása hero-stílusban (halo-sage sáv, kártya-keret nélkül).
2. **Keret-hero anatómia** (fentről le):
   - **Felpörgő maradék-kcal** középen: 46-48/Geist 200, `0 → maradék` 2 s ease-out count-up betöltéskor (a gyűrűk vele töltenek); `prefers-reduced-motion` → azonnal végérték. Unit: „kcal hátra”.
   - Alatta adat-sor: `eddig {consumed} / {target} · {n}/{m} ablak` — **% nincs**.
   - **Szegmentált nap-sáv** (a régi `dayseg`): logolt étkezések váltakozó sage/sage-deep szegmensei + ghost-maradék + arany most-jelző.
   - **Három chip:** `Alap {base}` · `Mozgás {+activity}` · `Cél {±balance}` — a Cél **előjeles** (deficit −, surplus +, sage kiemelés); mindhárom a meglévő `EnergyBreakdownSheet` megfelelő szekcióját nyitja. Static-energy módban (nincs biometria) a chipsor nem renderel (a régi kártya `staticEnergy` szabálya).
   - **5 makró-gyűrű:** Fehérje · Szénhidrát · Zsír · **Rost** · **Víz** — SVG gyűrű (% középen), címke + `érték / cél` alatta; `--macro-*` + `--sky` tónusok; a gyűrű-fill a count-uppal együtt animál.
   - **A víz-gyűrű gomb** (`role="button"`): koppintásra **víz-logoló sheet** — `250 / 400 / 500 ml` chipek + kézi ml-input + Mentés (a meglévő `useWaterActions`-re; a sheet a shared `Sheet` primitíven).
   - **Nincs láb-sor.** Ad-hoc log = a meglévő központi **+ FAB** (QuickInputSheet, változatlan); **Fuel-beállítások** = a Fuel `SubNavDropdown` **`extraAction`** ⚙️ sora (a Me minta) → `FuelSettingsSheet` (a `KeretBelt` szerkeszt-belépő átköltözik; a konyha-zárás jegyzet a settings-sheetben már látható adat, a hero nem hordozza).
3. **Rost-bővítés (frontend-only):** fogyasztott rost = a nap logolt mealjeinek `fiberG` összege (hiányzó mező = 0); cél = **statikus 30 g** default (`fuelConfig` konstans; később settings-mező lehet). Real és mock módban azonos deriváció; ha egyetlen logolt meal sincs, a gyűrű 0%-on áll (nem ghostol — a cél ismert).
4. **AI-score visszakötés** (`mezo-cs8b` megoldása):
   - A kész ablakok **egy összevont kapszulába** húzódnak: `✓ {n} kész ablak · {kcal} kcal · AI-átlag {avg} p` — koppintásra kibomlik étel-soronként.
   - Étel-sor: név + **MealRole címke** (EDZÉS ELŐTTI / EDZÉS UTÁNI / STANDARD — a meglévő `MealRole`) + idő/kcal/P + **✨ score-chip** (zöld ≥90, amber alatta; score nélküli meal soránál nincs chip — nem hamisítunk).
   - Étel-sorra koppintva a **meglévő `MealScoreSheet` nyílik változatlanul** (ScoreHero + Mezo-olvasat + súlyozott dimenziók + Lehetne jobb + tool-chipek — a sheethez nem nyúlunk).
   - Az AI-átlag = a score-os logolt mealek átlaga; ha egy sincs, a kapszula átlag-szegmense elmarad.
5. **Ablak-folyam egyebekben változatlan** (NOW-sziget, jövő kapszulák, Pótold, stack-adagok, üres nap, `?w=` az ablak-kulcsokra — csak a `keret` érték szűnik meg).

## 2. Komponens-terv

- **Új:** `components/KeretHero.tsx` (hero + chips + gyűrűk + count-up), `components/MacroRing.tsx` (egy gyűrű, ha a KeretHero-ból kiválik — implementálói döntés), `sheets/WaterLogSheet.tsx`, `logic/keretHero.ts` (pure: ring-percentek, dayseg-szegmensek, rost-összegzés, AI-átlag).
- **Módosul:** `FuelMaiPage` (hero fent, belt ki, merged done-capsule + score-sorok + MealScoreSheet host, `?w=` szűkítés), `FuelSection` (SubNavDropdown `extraAction` ⚙️ → FuelSettingsSheet host), `windowIslands.ts` (done-ablakok összevonása VM-szinten: `doneGroup` mező).
- **Retirál:** `KeretBelt` (+ tesztje + `.kbelt*` CSS + az `Island` `beltContent`/`belt` propja, ha nincs más fogyasztó — ellenőrizni).
- **CSS:** `.khero*` család (DS tokenek, halo-sage), gyűrű-animáció `:where()`-garanciával; count-up JS-vezérelt (rAF), reduced-motion ágon kihagyva.
- **Nincs backend/API-változás.**

## 3. Tesztek, goldenek, a11y

- Pure: `keretHero` táblás (ring-pct, rost-összegzés hiányzó fiberG-vel, AI-átlag score-nélküliekkel, dayseg-szegmensek, előjeles Cél).
- Komponens: count-up reduced-motion ága (azonnali végérték), víz-sheet nyit/logol/kézi input, chipek → EnergyBreakdownSheet szekciók, merged kapszula kibontás + score-chip jelenlét/hiány + MealScoreSheet nyitás, settings a dropdownból, `?w=keret` már nem érvényes kulcs (→ default).
- Goldenek: `fuel` frissül, `fuel-keret` state **törlődik** a visual-listából (nincs többé), + új `fuel-score` state? — nem: sheet-golden nincs a szokásrendben; marad `fuel`.
- A11y: gyűrűk `role="progressbar"` aria-val; víz-gyűrű button teljes HU labellel; count-up `aria-live="off"` (a végérték a hozzáférhető név).

## 4. Scope-on kívül

Rost-cél settings-mező (később); TabBar/QuickInput változatlan; Terv/Stack/Receptek/Kamra oldalak változatlanok. Docs: fuel.md + DS-platform + **ADR 0024** (0023-iteráció: belt→hero, score-visszakötés, rost) az implementáció része; `mezo-cs8b` zárása a merge után.
