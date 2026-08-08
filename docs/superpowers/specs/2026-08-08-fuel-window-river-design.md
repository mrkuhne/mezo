# Fuel Mai „Ablak-folyam” redesign — design spec

- **Dátum:** 2026-08-08
- **Driving bd:** `mezo-jgh9`
- **Előzmény:** a Today három-sziget re-kompozíció ([`2026-08-07-today-three-islands-design.md`](2026-08-07-today-three-islands-design.md), [ADR 0022](../../decisions/0022-today-three-islands.md)) — ez a spec annak a **sziget-nyelvét viszi át** a `/fuel` Mai nézetre; és a guided Mai redesign (`mezo-rrtj`, 2026-07-28), amelynek **adat-vetületei változatlanul megmaradnak** (`buildDayPlan`, `pickHeroWindow`, `deriveDailyBudget`, `buildEnergyBreakdown`, meal-score, `matchMealsToStack`).
- **Mockupok (validált):** [`assets/2026-08-08-fuel-window-river-mockup.html`](assets/2026-08-08-fuel-window-river-mockup.html) (v2 — interaktív: ablak-szigetek + Keret-öv + keret-felépülés); a leképezés-variációk: [`assets/2026-08-08-fuel-mapping-directions-mockup.html`](assets/2026-08-08-fuel-mapping-directions-mockup.html). A user az A („Ablak-folyam”) irányt választotta, a Keret-öv a kérésére került be.

## 1. Cél

A Mai nézet ugyanazt a teret beszélje, mint a Today: **szigetek, rétegek, élő organikus felület** — de a Fuel saját egységére építve: **az étkezés-ablakra**. Emellett a napi kcal/makró-keret **bármikor, egy pillantással** elérhető legyen: mennyi maradt, hogy állnak a makrók, és **miből épül fel a keret** (alapanyagcsere + mozgás − cél-deficit).

## 2. A modell — az ég szerkezete (L0)

`/fuel` (Mai) tartalma az `AppHero` (változatlan, `SubNavDropdown`-nal) és a tab-bar között egy **nem görgethető ég**:

```
[múlt ablakok — zöld ✓ kapszulák]      ← kcal + score esszenciával
[NOW-ablak — nagy sziget, MOST-gyűrű]  ← pickHeroWindow jelöli ki
[Keret-öv — állandó, vékony]           ← maradék kcal + P/C/F mini-csíkok
[jövő ablakok — lebegő kapszulák]
```

- **A sziget = egy étkezés-ablak** (a `buildDayPlan` slotjai). Kronologikus sorrend, stabil tér; mindig pontosan **egy nagy** elem van (ablak vagy a kibontott Keret).
- **A NOW-ablakot** a meglévő `pickHeroWindow` jelöli ki (a terv vetülete, nem második state-gép). MOST-gyűrű + tag a Today mintájára, a kiválasztástól függetlenül.
- **Múlt ablak** (logolt): zöld ✓ kapszula — `✓ 420 kcal · 92 p`. **Kihagyott ablak** (lejárt, log nélkül): **nyitva marad** — a kapszula `Pótold` esszenciát visel, és naggyá téve ugyanúgy logolható (a Today check-in „skipped stays fillable” öröklése). *(Döntés: D2)*
- **Jövő ablak:** lebegő kapszula — idő + terv-étel/stack esszencia + `N ›`.
- **Minden ablak kész →** a **Keret-öv nő naggyá alapból**: a nap „mérleg-nézetben” zár.
- **A stack-adagok** a saját ablakuk esszenciájában/L1-ében utaznak (`matchMealsToStack`) — önálló szigetük nincs.
- **Reta:** tény-szinten szivárog be (csúcshéten a NOW-ablak herosub-ja/chipje jelzi az alacsony étvágyat, `useMedication().cycle`); állandó kapszulát nem kap, a Gyógyszer-nézet a sub-nav-ról érhető el. A `retamicro` csík és a `.pghead-np` fejléc-sor visszavonul. *(D1)*
- **Act-anywhere:** minden ablak akciózható kiválasztva is (korai vacsora-log délután stb.).

## 3. Az ablak-sziget anatómiája

A Today v3 szabálya él: **nincs köszöntés, nincs státusz-eyebrow, nincs coach-próza L0-n** — hero + 1–2 tény + CTA.

1. **Hős-szám:** az ablak ideje (`12:30`, 52/Geist 200) + unit: az ablak neve.
2. **Subtitle:** adat — ablak-határ („13:15-ig ideális”), edzés-kapcsolat („edzés 13:00 — egyél előtte”, a `WorkoutWindow` adatból), csúcshéten a Reta-jegy.
3. **Meal-chip:** a terv-étel (név · kcal · P) + **illik-score** badge (a meal-score/fit adat). Terv nélküli ablakon a chip helyén `＋ tervezz ide` ghost.
4. **Tény-cellák (2):** a DS StatStrip-delta idióma — **fehérje-ugrás** („+42 g · 62 → 104 · a céled 65%-a”) és **nap-score eddig** („92 p · a heti átlagod felett”). A büdzsé-tény szándékosan NEM itt él (az övön — nincs duplikáció).
5. **Akció-sor:** `Logold` (sage gradient-CTA) + `✨ AI` ghost + `még N ›` fogantyú.
6. **Csendes kész-sor:** `✓ 2 ablak kész ma · 840 kcal · átlag 90 pont`.

### L1 (ablak kibontva)
Csoportok ItemRow-nyelven: **az ablak étkezése** (terv-étel + Logold), **Csere a tervben** (illő receptek a Kamrából — a mai swap-logika), **AI naplózás**, **Ehhez az ablakhoz kötve** (stack-adagok `Pipa`-val). `összecsuk ↑` zár; belül görgethető.

## 4. A Keret-öv

- **Mindig látható**, vékony (~54 px) sáv a nagy sziget alatt: `1 160 kcal · MARADT` + három makró mini-csík (P/C/F, `--macro-*` tónusok) + `›`.
- **Koppintásra maga válik naggyá** (sziget-szemantika — minden más kapszulává húzódik). Kibontva:
  1. Hero: `1 160 kcal maradt` + „a 2 400-as keretedből · jó ütemben vagy”.
  2. **Evett/maradt sáv** (sage/success-soft) `EDDIG 1 240 · MARADT 1 160` felirattal.
  3. **A keret felépülése** (a `deriveDailyBudget`/`buildEnergyBreakdown` adatai): 🔥 Alapanyagcsere `1 890` → 🏋️ Mozgás ma (edzés + lépések) `+910` → 🎯 Cél-deficit `−400` → ⚖️ **Mai keret `2 400 kcal`** (accent-tónusú összegzősor). A mozgás-tag napról napra él; Fraunces-lábjegyzet: „edzésnapon a mozgás-tag nő — a keret követi”.
  4. **Makró-célok:** három teljes csík cél-távolsággal („Fehérje · 62 g · még 98 g a 160-hoz”).
  5. **Víz-sor:** `1,2 / 2,5 l` + `+250 ml` akció (a meglévő `useWaterActions`) — az övön magán nem, csak itt. *(D3)*
  6. **`＋ Log bármikor` sor** — üres `LogMealSheet` (terv-független ad-hoc log, a retirált fejléc-chip öröklése).

## 5. Rétegek

| Réteg | Mi él ott | Nyílik |
|---|---|---|
| L0 | ablak-folyam + Keret-öv | — |
| L1 | ablak részletei / keret-felépülés + makrók + víz | `még N ›` · öv-koppintás |
| L2 | LogMealSheet, AiLogSheet, RecipeDetail(Sheet), Stack-műveletek — változatlan | L1 sorokból |

A Terv/Stack/Receptek/Kamra/Gyógyszer aloldalak változatlanok (SubNavDropdown).

## 6. Mozgás és színvilág

A Today mozgás-nyelve **változatlan szabályokkal** (folyamatos buborék-morf 29→34 px közös rugógörbén, kereszt-áttűnő kapszula-réteg, blob-morf 9 s, lebegő kapszulák eltolt fázissal, L1-lépcső, reduced-motion `:where()`-garancia). Fuel-tónusok: **sage-amber blobok** (`--halo-sage` család), a Keret-öv blobja amber-sage; CTA-k a **sage gradiensen** (`--gradient-sage` új token-pár a `--gradient-cta` mintájára — Fuel-ben a sage a domain-accent, D4-konform: a coral CTA-t nem vesszük el, de a Fuel saját akciói sage-ek, ahogy ma is `--sage-deep` a sub-nav accent). MOST-gyűrű arany, változatlan.

## 7. Komponens-terv

**Promóció (2. fogyasztó szabály):** a sziget-héj domain-mentes része `shared/ui`-ba emelkedik:
- `shared/ui/Island.tsx` — a héj (kapszula↔nagy morf, blob, gyűrű): props `{ big, nowRing, tone, capsule:{emoji,title,essence,badge}, night?, belt?, onSelect, aria, children }` — a Today-specifikus `DayFace`/`FACE_*` kikerül belőle (a hívó adja emoji-t/címkét); `features/today/components/Island.tsx` törlődik, a Today a shared héjat használja (viselkedés-azonos, goldenek bizonyítják).
- `shared/ui/IslandSky.tsx` NEM jön létre — az ég elrendezése domain-döntés, marad feature-oldalon.
- CSS: a `.sky-islands`/`.isl*` család shared vocabulary-vá minősül (§ a DS-platform docban); új: `data-tone="fuel|keret"` blob-tónusok, `.isl-belt` (öv-variáns: fix 54 px, `r-xl`, saját beltview réteg), `.gradient-sage`/`--shadow-sage` tokenek.

**Új (features/fuel):**
- `logic/windowIslands.ts` — **pure**: `buildDayPlan` + `pickHeroWindow` + `matchMealsToStack` kimenetből → `WindowIsland[]` (state: `done|now|missed|future`, esszencia-szövegek, tény-cellák inputjai, kész-összegzés). Táblás tesztek.
- `components/WindowIsland.tsx` — egy ablak bigview-ja (hero + meal-chip + tények + CTA + L1).
- `components/KeretBelt.tsx` — az öv + kibontott keret-nézet (a retirált `DayBudgetCard`+`MacroCells`-tartalom új ruhában; `MacroCells` mint komponens marad a recept-felületeken).
- `FuelMaiPage.tsx` — újrakomponálás: ég + kiválasztás (`?w=` URL-derivált: ablak-index vagy `keret`; Today `?dp=` szabályai — replace, törlés ha default), sheet-host változatlan.
- `FuelMaiSkeleton` — az új layoutra.

**Visszavonul a Mai-ról:** `.pghead-np` fejléc-sor (＋Log/✨AI chipek → öv-L1 / ablak-CTA), `retamicro`, `NowWindowCard` (a `pickHeroWindow` logika marad!), `DayZoneCard`-idővonal L0-ról (tartalma az ablak-szigetekben él), `DayBudgetCard` a Mai-ról (tartalma a Keret-L1). Más oldalak fogyasztóit nem bántjuk.

## 8. Adatok és őszinte állapotok

Minden adat meglévő hookból/pure logikából; **nincs backend/API-változás**. Üres-állapotok: nincs mai terv → az ég egy „üres nap” szigetet mutat (`＋ tervezz` CTA a Terv-oldalra + az öv él tovább); real-mode pending → layout-hű skeleton (AppHero-azonosság szabály); score-próza P8-ig null — a tény-cella csak számot mutat, prózát nem hamisít.

## 9. A11y, tesztek, goldenek

- A Today sziget-aria mintája: kapszulák `button` teljes HU labellel, nagy sziget `aria-current`, fókusz-rend (váltás → sziget eleje; L1 → első sor; `összecsuk` → fogantyú); az öv `button` („Napi keret megnyitása · 1160 kcal maradt”).
- Tesztek: `windowIslands` táblás; komponens-tesztek (`?w=` deriváció, missed→Pótold, belt-kibontás, minden-kész → keret-default); mindkét mód zöld + build; `fuel-mai` visual goldenek újragenerálása (darwin + linux workflow), új state-ek: NOW-nagy / keret-nagy / L1-nyitva / missed.
- Meglévő `heroWindow`/`buildDayPlan`/`buildEnergyBreakdown` tesztek érintetlenül zöldek.

## 10. Scope-on kívül

Terv/Stack/Receptek/Kamra/Gyógyszer aloldalak; backend; új adatforrás (lépés-alapú mozgás-tag finomítás später); Reta-kapszula (elvetve, D1). Dokumentáció (fuel.md §2/§3/§9 + DS-platform §, ADR 0023) és a `today.md` Island-promóció jegyzete az implementáció része.
