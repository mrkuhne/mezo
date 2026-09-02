# Growth oldal — Design 2.0 újratervezés: hub + 4 aloldal

- **bd:** mezo-rmi0 (design round) · dev issue: a plan hozza létre (gyermek a mezo-rmi0 alatt)
- **Prototípus:** `docs/design_2.0/prototypes/growth-tab.html` (`src/growth-head.html` +
  `src/growth-body.html`) · artifact `393bca87-9095-42dd-ac55-127162ad0412`
- **Jóváhagyva:** 2026-09-01 (Daniel) — első körben, iteráció nélkül („jó lesz, perfekt").
- **Brainstorm döntések:** IA = **A** (hero + Ma-csík + 2×2 mozaik, minden csempe saját
  aloldal) · hero = **A** (XP count-up + Szint / Fegyelem / Ritmus sávok) · Ma-csík = **A**
  (küldetés-chipek + `＋ Tevékenység`, a fejléc a `/nap/kuldetesek`-re visz).
- **Terjedelem:** FE-only. **Nulla kontraktus-változás.** Egy új FE data-hook a már létező, de
  fogyasztatlan `GET /api/progression/growth-week/{date}` végpontra.
- **Igazságforrások:** a prototípus (vizuális + interakciós, 1:1, px ×1,18), az
  `2026-08-27-en-feature-audit.md` §Growth (viselkedési ground truth), `docs/features/growth.md`,
  `habit.md`, `me.md`, ADR 0010 / 0032 / 0033.

## 0. Miért

A mai `/me/growth` már Mozaik-arcú, de a lényege egy **hero + 4-utas szegmens-kapcsoló**, ami
egy hosszú panelt vált: nincs hub-csempe, nincs aloldal, a csempéken nincs élő adatsor, a hero
XP-száma statikus, a sáv-chipek `8/12/13` hardcode-oltak, és a Skillek nézet tetején két
teljes (régi arcú) kártya ül a Nap fülről. A Fuel és az Edzés viszont a **hub-idiómát** követi
(ADR 0032: csempe → saját oldal). A Growth ugyanezt kapja — a Karakter 1. kör tanulságával:
**a hub egy képernyő, scroll nélkül.**

## 1. Útvonalak

| Route | Oldal | Tone | PageHead |
|---|---|---|---|
| `/me/growth` | `GrowthHubPage` (a mai `GrowthPage` helyén) | gold | `‹ Én` |
| `/me/growth/skillek` | `GrowthSkillsPage` | lav | `‹ Growth` |
| `/me/growth/rutin` | `GrowthRutinPage` | gold | `‹ Growth` + `✏️ Szerkesztés` |
| `/me/growth/naplo` | `GrowthNaploPage` | sky | `‹ Growth` |
| `/me/growth/kituntetesek` | `GrowthAwardsPage` | sage | `‹ Growth` |

- Lapos sibling-route-ok a `router.tsx`-ben a `me/growth` mellett (statikus a dinamikus előtt),
  a `/me/karakter/*` mintájára. Nincs nested route, nincs `?tab=`.
- **Visszafelé kompatibilitás:** `/me/growth?tab=awards` → redirect `/me/growth/kituntetesek`;
  `?tab=skills|routines|journal` → a megfelelő aloldal. A redirect a hub-komponensben
  (`useSearchParams` + `<Navigate replace>`), mert a query-param nem route-olható.
- `EnHubPage` streak/érme chipjei → `/me/growth/kituntetesek` (a `?tab=awards` helyett).
- `RoutineEditorPage` vissza-címkéje `‹ Rutin`, célja `/me/growth/rutin` (ma `‹ Growth` →
  `/me/growth`).
- A `/me/growth` route-ból az `EntranceGroup replayKey={tab}` trükk eltűnik (nincs tab).

## 2. Hub — `/me/growth`

Anatómia (ADR 0033): `MozaikPage tone="gold"` → `PageHead onBack('/me') label="‹ Én"` →
`EntranceGroup` → **hero** (`rise --d:0`) → **Ma-csík** (`rise --d:90`) → **`Mosaic`** 4
`Tile`-lal (`delayMs` 170 / 220 / 270 / 320). Cél: a teljes hub belefér egy ~390 px-es
viewportba scroll nélkül (a prototípusban 330 px-nél ~110 px tartalék maradt).

### 2.1 Hero (`GrowthHero`)

- Cím `Growth` (17 px ×1,18), alatta egy sorban: `ClayIcon i-growth` (46 ×1,18, a prototípus
  `growbreathe` 5 s lélegzése reduced-motion-guardolva) + **nagy XP-szám** `useCountUp`-pal
  (a mozaik/motion primitív; a szám az **összes sáv `cumulativeXp` FE-összege**, mint ma) +
  `XP` egység (arany, 11 px).
- **Count-up folytatás:** chip-koppintás vagy mentett tevékenység után a szám az **utoljára
  mutatott értékről** pörög az újra (a `KeretHero` rAF-receptje: `from = lastShown`), nem 0-ról.
  A `useCountUp` jelenlegi szignatúrája 0-ról indul — a hero a KeretHero-variánst kapja
  (kiemelve egy `useContinuingCountUp` hookba a mozaik/motion-ban, ha a KeretHero is átveheti;
  különben lokális).
- Három címkézett sor (`grid 58px 1fr 54px` ×1,18), egymás után töltődő sávok
  (`mzp-fill`-jellegű `scaleX(0)→1`, delay 250 / 330 ms):
  - **Szint** — címke `Szint {level}`, arany sáv `xpInLevel / xpForNext`, jobbra
    `{xpInLevel} / {xpForNext}`. Forrás: `useGamification()` profil (`GamificationProfile.level`,
    `xpInLevel`, `xpForNext`). Ha a gamification-profil nem elérhető (real-mode 404 / ghost),
    **a sor nem jelenik meg.**
  - **Fegyelem** — levendula sáv `disciplinePct`, jobbra `{n}%`. **Ha `disciplinePct == null`,
    a sor nem jelenik meg** (honest state — nem `–`).
  - **Ritmus** — 8 pötty (`dotpop`, 400 + i·45 ms), az utolsó `min(consistencyWeeks, 8)` teli
    zsálya, az utolsó pötty gyűrűs (`now`); jobbra `{consistencyWeeks} hét`. 0 hétnél 8 üres
    pötty és `0 hét` (ez valós állapot, nem hiányzó forrás).

### 2.2 Ma-csík (`MaStrip`)

- Fehér `float3d` kártya. Fejléc-gomb: eyebrow `Ma · {done}/{n} küldetés`, jobbra zsálya
  XP-chip `+{xp} XP` (a mai kész küldetések XP-je + a mai tevékenységek XP-je), `›` —
  koppintásra `navigate('/nap/kuldetesek')`.
- **Chip-sor** (`flex-wrap`, nem vízszintes scroll — a prototípus v1 javítása): minden mai
  küldetés egy chip; állapotok: `completed` = zsálya háttér + teli ✓ jel; `open` = semleges
  keret + üres kör; `expired` = szaggatott keret, 50% opacitás, felirat `{cím} · csendben
  lejárt`, nem gomb (`aria-disabled`). **Soha nem terracotta**, nincs visszaszámláló.
- Nyitott chip koppintása = a mai `DailyQuestList` „Kész" akciója (`useQuestActions().complete`);
  siker után a chip zsályára vált, a fejléc újraszámol, a hero XP tovább pörög. Kész chip
  koppintása nem von vissza (a mai lista sem enged visszavonást — nincs új mutáció).
- A sor végén `＋ Tevékenység` chip (arany wash) → a meglévő `ActivityLogSheet` nyílik helyben;
  mentés után a tevékenység `✎ {név} · +{xp}` levendula chipként kerül a sorba (a mai
  `useActivities()` napi lista), toast nem kell (a sheet saját visszajelzése marad).
- **Üres állapot** (nincs mai küldetés): egy sor `Ma még nincs küldetés — a reggeli briefinggel
  jön. Tevékenységet közben is logolhatsz.` + a `＋ Tevékenység` chip.
- Betöltés alatt: a csík váza (fejléc `Ma`) + skeleton chip, nem `0/0`.
- A `DailyQuestsCard` és az `ActivityLogCard` **eltűnik a Growth-ról**; a Nap-oldali
  fogyasztóik érintetlenek (a komponensek maradnak).

### 2.3 Mozaik (2×2 `Tile`)

| Csempe | wash | ikon | élő sor (a saját hookból; `undefined` amíg nem érkezett) |
|---|---|---|---|
| Skillek | lav | `ClaySpot s-hajtas` (42) | `{life+ath+muscle} skill · legjobb Lv {max}` |
| Rutin | amber | `ClayIcon i-hajnal` (40) | `{m} reggel · {e} este / 30` |
| Napló | sky | `ClayIcon i-naplo` (40) | `{completed} ✓ · {activities} ✎ · 30 nap` |
| Kitüntetések | sage | `ClaySpot s-medal` (44) | `{done} / {n} jelvény · {streak} napos sorozat` |

- A `Tile` primitív `line` propja `ReactNode` — a félkövér számok `<b>`-vel.
- A Kitüntetések csempe eyebrow-sorában **pulzáló pötty** (`kpulse`, reduced-motion-guardolt),
  amíg a következő streak-mérföldkő ≤ 10 napra van (`nextMilestone − streakDays ≤ 10`).
- A sáv-számok a bandek hosszából jönnek (`life.length + athletic.length + muscle.length`),
  **nem** hardcode.

## 3. Skillek — `/me/growth/skillek` (lav)

- Hero: `PageHero icon="s-hajtas"` (spot, 46) + nagy szám = skillek száma + név `skill`;
  alcím helyett `PageBody principle` alul. (A prototípus `sb` sora — `három sáv · 8 LIFE · 12
  atlétikus · 13 izom` — a `StatStrip` alá kerül a `PageHero` „nincs alcím" szabálya miatt;
  implementation-flag.)
- `StatStrip` 3 cella: `{LIFE Lv-átlag, 1 tizedes}` / `{athleteLevel ?? '—'}` `Atléta-szint` /
  `Lv {max muscle}` `Izom legjobb`. A LIFE-átlag FE-számítás (`mean(level)`), null-nál `—`.
- Három párhuzamos sáv-kártya — a **`SkillBandCard` továbbfejlesztve**, nem új komponens:
  - fejléc: eyebrow + chip (`{n} skill · {xp} XP` / `{n} skill · átlag {avg}` / `{n} izom ·
    legjobb Lv {max}`), a LIFE-nál `Megtakarítás (30 nap) · {ft} Ft` láb, csak ha > 0;
  - sorok szint desc, XP desc; sor = ikon-cella (LIFE: `ClayIcon i-life-*`; atlétikus/izom: a
    név első két betűje a wash-tónusban — a prototípus szerint, emoji tilos) · név ·
    animált meter (`np-grow`/`mzp-fill`, 260 + i·55 ms) · `Lv {n}` plakett;
  - **perk-jelzés**: ha `nextMilestone(level) − level === 1` (mérföldkövek 5/10/15/20), a meter
    és a plakett közé halvány arany `→ perk Lv {next}`;
  - alapból **top 4 sor**, alatta `Mind a {n} ▸` / `Kevesebb ▴` gomb (a kártya `expanded`
    állapota; kibontáskor a kártya belépője újrajátszik).
- Nincs skill-részlet oldal, nincs XP-idősor (a contract nem hordoz sorozatot).

## 4. Rutin — `/me/growth/rutin` (gold, habit-domain)

A `RoutinesTab` tartalma és hookjai (`useHabitDay`, `useHabitSummary`, `useHabitCatalog`)
átköltöznek az oldalra; a `RoutinesTab` komponens megszűnik (tesztje az oldal tesztjébe olvad).

- `PageHead`: `‹ Growth` + jobbra `✏️ Szerkesztés` → `/me/routines/edit`.
- Hero: `i-hajnal` (44) + nagy szám = tökéletes reggelek (30 nap) + név `tökéletes reggel`.
- **Két lánc-csempe** egymás mellett (`covtile`): fejléc `ClaySpot s-reggel` / `s-este` + `Reggel`
  / `Este` + `{n} / 30`; alatta **30 szegmenses sáv** (10×3 cella, `dotpop` 14 ms/cella
  staggerrel, balról jobbra `n` teli: arany (reggel) / levendula (este), a többi keret).
  **Döntés (data-réteg ellenőrzés után):** a `HabitSummary` csak `perfectMorningDays30` /
  `perfectEveningDays30` számlálót hordoz, napi biteket nem — ezért a cellák **számlálót**
  vizualizálnak, nem naptári napokat (nincs „mai cella" jelölés, nincs nap-hozzárendelés).
  A prototípus nap-rácsa és a **mérföldkő-pill + villanás elmarad** ebben a körben: a
  „tökéletes napok egybefüggő sorozata" nincs a kontraktusban, nem találjuk ki. Follow-up bd
  issue: a `/api/habit/summary` napi bitekkel + `perfectStreak` mezővel bővítése (backend slice),
  utána a rács és a pill a prototípus szerint jön.
- **Nap-navigátor** (`‹ Ma ›`, max ma, a mai `DayNavigator`), alatta a két lánc-kártya
  (amber / lav): sorok `◦/✓` + cím + `{pct}%` (a habit 30 napos ereje), fejléc-chip
  `{done} / {n} · erő {avg}%`. Múltbeli nap: a láncok fölött összegző kártya
  `Reggel {d}/{n} · Este {d}/{n} · +{xp} XP`; ha egy lánc 0 volt: `{Lánc} kimaradt — a lánc
  másnap folytatódott. A 30 napos erő ettől nem nullázódik.` (soha nem „megszakadt").
- Logolás itt nem történik (a Nap/rutin oldal joga); a sorok nem gombok.

## 5. Napló — `/me/growth/naplo` (sky)

- Hero: `i-naplo` (44) + nagy szám = teljesített küldetések (30 nap) + név
  `teljesített küldetés`.
- **„Ez a hét" kártya** (sky wash) — ÚJ hook `useGrowthWeek(mondayIso)` a
  `GET /api/progression/growth-week/{date}` végpontra (`GrowthWeekResponse{questCompleted,
  questClosed, lifeXp, activities, savingsHuf}`; dual-mode `useDualQuery`, mock-fixture +
  MSW handler; `realStaleTime` 60 s). 4 `MCells`: `{questCompleted} küldetés ✓` (sage) ·
  `{questClosed} lejárt` (amber) · `{activities} tevékenység` (lav) · `+{lifeXp} LIFE XP` (sky);
  láb `Megtakarítás e héten · {savingsHuf} Ft`, csak ha > 0. Fejléc-chip a hét dátumtartománya
  (`aug 31 – szept 6`). Ha a végpont hibázik / 404: a kártya **nem jelenik meg**.
- Alatta a 30 napos napló: `buildGrowthJournal` verbatim; nap-fejléc `{dow} {dátum} · +{xp}
  XP`, napkártya sorok `✓` küldetés (`küldetés · {slot} · +{xp}`), `✎` tevékenység
  (`tevékenység · {skill} · +{xp}[ · {ft} Ft]`), `—` csendben lejárt (halvány, nem terracotta).
  A `GrowthJournalCard` ehhez a formához igazodik (kártya/nap, `rise` 60 + i·60 ms).
- Láb: `Utolsó 30 nap · … A csendben lejárt küldetés nem hiba — ajánlat volt.`

## 6. Kitüntetések — `/me/growth/kituntetesek` (sage)

- Hero: `ClaySpot s-medal` (50) + nagy szám = megszerzett jelvények + név `/ {n} jelvény`.
- **Streak-kártya** (`StreakCard`, F7.4) változatlan tartalommal, a láng `flamesway` 2,6 s
  ringatással (reduced-motion-guardolt), mérföldkő-sáv + `🧊 mentő · n/2`.
- **Címek** (`TitlesSection`, F7.4): érme-egyenleg, viselt cím, Létra / Bolt, Felvesz /
  Megveszem / Viselve, `canMutate` gating és a bolt-fül streak-mentő sora — **változatlan
  viselkedés**, a zárt létra-sor `🔒` helyett `LV {n}-TŐL` felirat (glosszárium-hű).
- **Jelvények**: `BadgesCard` 3 oszlopos rács; a **meg nem szerzett jelvény conic haladás-
  gyűrűt** kap az ikon körül (`--v = current/target`, `useCountUp → --v` recept, nincs
  `@property`), az ikon szürkítve; a megszerzett zsálya wash + teli zsálya gyűrű + `✓ megvan`.
  A `b.icon` backend-emoji marad (kontraktus), nincs clay-map ebben a körben.
- **Perkek** (`PerksCard`): amber kártya, sorok `Lv{n}` plakett · név · hatás · skill; láb
  `A skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket — a következő: {skill} Lv {n}.` (a
  legközelebb álló mérföldkő FE-számítás; ha nincs, a mondat második fele elmarad).
- Elv-sor: `Az érme itt költhető el — címre vagy sorozat-mentőre. Semmi más nem vásárolható,
  és semmi nem jár le.`

## 7. CSS és motion

- Új `.gr-*` szabályok a `prototype.css` Growth-blokkjában (a mai `.gr-seg/.gr-band/.gr-day/
  .gr-covtile/.gr-chain/.gr-bdggrid` család átdolgozva, a szegmens-CSS törölve), tokenek
  **mindkét `:root` blokkban**; nincs hex/rgba literál TSX-ben (a `SkillBandCard:60` és a
  `ProgressionHome` inline stílusai ebben a körben tokenekre kerülnek, ahol a Growth-arc
  érinti őket).
- Prototípus px ×1,18. Színek, gradiensek, árnyékok, időzítések a `growth-head.html`-ből
  szó szerint.
- `EntranceGroup` minden oldal panelén; hero `rise --d:0`; count-up reduced-motion alatt
  azonnal a célértéket mutatja (visual-golden fagyasztott óra + reduced motion).
- Végtelen animációk (`growbreathe`, `flamesway`, `kpulse`) csak
  `prefers-reduced-motion: no-preference` alatt.

## 8. Tesztek, gate-ek, dokumentáció

- Oldal-tesztek a `GrowthPage.test.tsx` mintájára (barrel-mock `@/data/hooks`, pinned
  `localDateString`, `QueryWrapper` + `LevelUpProvider` + `MemoryRouter`) mind az 5 oldalra;
  a `useGrowthWeek` hook-teszt dual-mode; komponens-tesztek (`SkillBandCard` expand + perk-hint,
  `MaStrip` állapotok, `BadgesCard` ring). **Mindkét mód**: `VITE_USE_MOCK=false` és `=true`.
- `EnHubPage.test.tsx` a chip-célútvonalra; `router.weeklyRedirect`-mintájú teszt a
  `?tab=awards` redirectre; `RoutineEditorPage.test.tsx` vissza-címke.
- Visual golden: `me-growth-awards` (`/me/growth?tab=awards`) → `/me/growth/kituntetesek`;
  + új `me-growth` hub shot. Linux baseline-ok a `update-visual-baselines.yml` workflow-val.
- `node scripts/gen-codemap.mjs` ugyanabban a commitban (új oldal-fájlok).
- Docs: `docs/features/growth.md` (§2 felület, §8 tesztek, §10 fájlok + a stale sorok: a
  StreakSheet/TitleShopSheet már nem „orphan", a `features/progression/components/` létezik,
  a LIFE `clayIcon` mező), `me.md` §2 Growth + §10, `habit.md` (Rutin oldal), új
  `docs/design_2.0/2026-09-02-growth-design-iterations.md` (v1 döntések + implementation-flag
  lista), `prototypes/README.md` (kész).

## 9. Implementation-flagek (eltérés a prototípustól, PR-leírásba)

1. `PageHero` nincs-alcím szabály: a Skillek/Rutin/Napló/Kitüntetések hero `sb` sorai a
   test-strip alá vagy elv-sorba kerülnek.
2. Rutin: a 30 cella számlálót mutat (nem naptári rács), a mérföldkő-pill + villanás elmarad —
   a habit-summary nem hordoz napi biteket / tökéletes-sorozatot (§4, follow-up backend issue).
3. Ma-csík kész chip nem vonható vissza (a prototípus toggle-je demó volt).
4. A prototípus lokális `toast`-jai helyett a meglévő sheet-visszajelzés.
5. `LV {n}-TŐL` a `🔒` helyett a címeknél.

## 10. Nem része

Új backend / kontraktus; skill-részlet oldal; XP-idősor; jelvény-dátum; clay jelvény-ikonok;
a `DailyQuestsCard` / `ActivityLogCard` Mozaik-arca (Nap fül, külön slice); Nap/rutin logolás
a Growth-ról.

## Prior art (researcher)

- **Finch — egy élő napi sáv hajtja a hero-t** (deconstructoroffun.com, Finch elemzés): a hub
  egy domináns „ma" állapotot mutat, nem statikus pontszámot. **Átvéve** a hero három sávja + a
  Ma-csík formájában; a kisállat/energia-mechanika **elvetve** (Mezo-hang, ADR 0010).
- **Duolingo mérföldkő-animáció** (blog.duolingo.com/streak-milestone-design-animation): a
  napi pipa csendes, a nagy ünneplés csak mérföldkőnél. **Átvéve**: a Rutin csempe `flash`-e
  7/30 napnál, a streak-sáv; naponta ismétlődő ünneplés **elvetve**.
- **Smashing Magazine, streak-UX (2026/02)**: lánc-rács + számláló, kegyelmi mechanika,
  veszteség-lágyító szöveg („kimaradt — folytatódik"). **Átvéve** a 30 cellás rács és a
  Rutin-copy; „streak mindenre" **elvetve** (a Napló idővonal, nem streak).
- **Duolingo lineáris út** (blog.duolingo.com/new-duolingo-home-screen-design): csomópont-
  állapotok, egység-fejlécek, nincs elágazó fa. **Átvéve**: párhuzamos sáv-kártyák + perk-
  mérföldkő jelzés; a teljes lineáris út **elvetve** (a sávok nem-lineárisan böngészhetők).
- **Strava trófea-vitrin** (support.strava.com/…/the-strava-trophy-case) + Apple Fitness
  awards: teljes rács, a részben teljesített jelvény haladás-gyűrűvel. **Átvéve** a ring;
  a „friss 4" sor **elvetve** (nincs unlock-dátum a kontraktusban).

## Codebase terrain (investigator)

- **Érintett blokkok:** `me` (ui + data), `progression` (`useProgressionProfile`,
  `useAchievements`, `ProgressionHome.tsx` StreakCard/TitlesSection, `levelUpMeta.ts`),
  `quest` (`useDailyQuests`, `useQuestActions`, `useQuestHistory`), `activity`
  (`useActivities`, `useActivityHistory`, `ActivityLogSheet`), `gamification`
  (`useGamification`, `useTitles`, `useGamificationActions`, `levelCurve`), `habit`
  (`useHabitDay`, `useHabitSummary`, `useHabitCatalog`), shared `mozaik` + `clay`,
  `styles/prototype.css`.
- **Kulcsfájlok:** `frontend/src/app/router.tsx:267` (route), `features/me/pages/GrowthPage.tsx`
  (a cserélendő oldal; `:124,141,148` hardcode chipek), `features/me/components/
  {SkillBandCard,GrowthJournalCard,BadgesCard,PerksCard,RoutinesTab}.tsx`,
  `features/progression/components/ProgressionHome.tsx:41-83,125-168`,
  `features/me/logic/growthJournal.ts` (verbatim marad), `features/me/pages/EnHubPage.tsx:
  153-157,190-201,227-228`, `features/me/pages/RoutineEditorPage.tsx:45`,
  `data/progression/progressionHooks.ts` (+ új `useGrowthWeek`), `data/useDualQuery.ts`,
  `shared/ui/mozaik/{index,motion}.tsx`, `features/fuel/components/KeretHero.tsx:52-131`
  (folytató count-up + ring recept), `styles/prototype.css:5640-5700` (`.gr-*`),
  `frontend/tests/visual/visual.spec.ts:64` (golden), `api/feature/progression/progression.yml`
  (`growth-week`).
- **Minták:** recompose, nem reinvent (hookok/mutációk verbatim); hub → `Mosaic`/`Tile` a
  `FuelMaiPage`/`EdzesHubPage` szerint; aloldal `MozaikPage` + `PageHead` + `PageHero` +
  `PageBody principle` (`FuelNaploPage`, `MedalsPage`); csempe-sor `undefined` amíg nincs adat;
  `.rise` csak `EntranceGroup` alatt; tokenek mindkét `:root`-ban; clay, nem emoji; HU copy
  verbatim; `huNum.ts` a szám-formázásra (a négyszer duplikált `fmt` helyett).
- **Csapdák:** CODEMAP freshness gate; FE tesztek mindkét módban (`VITE_USE_MOCK` unset = mock);
  `dualMode.guard.test.ts`; visual golden `me-growth-awards`; `prototype.css`
  merge-törékenység (`prototypeCssStructure.test.ts`, `mozaikCssTokens.test.ts`); cross-feature
  `DailyQuestsCard`/`ActivityLogCard` (nem nyúlunk hozzájuk); Rutin = habit-domain
  (`habit.md`); Kitüntetések = az érme egyetlen nyelője (`canMutate` marad); mock/real XP-
  eltérés (nem állítunk egyezést); `GHOST_PROGRESSION_PROFILE` betöltés alatt; badge unlock-
  dátum nincs; ArchUnit nem érintett (FE-only).
- **Stale docs, amiket a kör javít:** `growth.md` §2 („orphan sheets"), §9, §10
  (`features/progression/components/` létezik), §7 LIFE `clayIcon`; fidelity-audit #1 és
  motion-B tétel megoldva (történeti).
