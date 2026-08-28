# Heti áttekintés — implementációs handoff (mezo-88jw → mezo-d20)

> **Ezt a fájlt azért írtuk, hogy egy másik gépen folytatható legyen a Heti oldal
> implementációja.** Nem ismétli meg a design-igazságot — megmondja, hol van, mi hiányzik a
> backendből, és milyen sorrendben érdemes szeletelni.
>
> **Hivatkozási pont:** `design/heti-v1` tag → commit `00b5b4ad`
> (`git fetch --tags && git show design/heti-v1`).
> **Az anyag:** `docs/design_2.0/` — audit + prototípus + iterációs napló.
> **Artifact (böngészőben végigjátszható):**
> https://claude.ai/code/artifact/dee0dd7e-f321-4f88-94ff-c7face496d70 → Én → **Heti** csempe.

---

## 0. Hol a helye a d20 fázistervben

A kanonikus horgonydokumentum: `docs/superpowers/specs/2026-08-27-design-2.0-implementation-spec.md`
(`mezo-d20` epic, F0–F8). Ott a Heti **F4.4**-ként szerepel a Mezo tab alatt — ez **elavult**:
a `feat/weekly-review` slice (bd `mezo-p2tr`, v2.52.0) a Heti-t átvitte
`/insights/weekly` → **`/me/week`** alá, tehát az **Én tab (F5)** része. A javasolt új szeletek:

| javasolt id | scope | blokkolja |
|---|---|---|
| **F5.9** | Heti hub + 4 nézet-oldal + nap-oldal (FE, meglévő kontraktusokra) | — |
| **F6.5** | backend: heti tudás-jelöltek (`A hét tanulságai`) | F5.9 tanulság-oldala csak ezután lesz élő |
| **F6.6** | backend: perzisztált heti pontszám + trend-endpoint | F5.9 hero 8 hetes trendje csak ezután lesz élő |

F5.9 **F6.5/F6.6 nélkül is leszállítható**: a tanulság-csempe és a hero-trend a mock-módban
látszik, real módban pedig honest üres állapotot mutat (lásd §4 „Fokozatos bevezetés").

---

## 1. Igazságforrások — ebben a sorrendben

1. **Prototípus** — `docs/design_2.0/prototypes/en-tab.html` (forrás:
   `prototypes/src/en-body.html`, `build.sh`-val épül). Az Én hub **Heti** csempéje nyitja.
   A vizuális + interakciós igazság; a spec §1 hűség-követelménye érvényes (1:1, px ×1,18).
2. **Feature-audit** — `docs/design_2.0/2026-08-27-heti-feature-audit.md`. A valós kód
   ground truth-ja: route-ok, teljes kontraktusok field-by-field, a mai UI leltára az exact
   magyar szövegekkel, a generálási pipeline, a mock seedek, a becsület-szabályok, és a
   gap-lista (§8 — amit a backend visszaad és a UI eldob).
3. **Iterációs napló** — `docs/design_2.0/2026-08-27-mezo-en-design-iterations.md` §5 és a
   négy kör (Round 1–4) + „The knowledge loop — backend-flagged additions".
4. **Handoff** — `2026-08-26-ui-ia-redesign-handoff.md` (axiómák, guardrailek, locked patterns).
5. **prototypes/README.md** — az `en-tab → Heti áttekintés` bekezdés: oldalankénti feature-lista.

---

## 2. Mit csinál a design (a mai állapothoz képest)

A mai `/me/week` (WeekPage) egy hosszú scroll kártyákból. A redesign **csempés hubbá** bontja
(hub scroll 1651 px → 525 px), és kirakja azt, amit a backend ma már visszaad, de a UI eldob.

### Hub (`/me/week`)
- **Hero** — animált pontszám-gyűrű (0-tól felpörgő szám; sávos szín: **80+ zsálya · 70+ arany ·
  alatta terrakotta — sosem piros**), delta-pill az előző héthez (`+4` / `előző hét 74`), és a
  **8 hetes pontszám-trend** a nézett héttel kiemelve. Kevesebb mint két mért nap: `tanulom` +
  „még gyűjtöm az adatokat a heti értékeléshez".
- **Nyolc mini-cella** (ma hat): a hatos mellé **`avgCheckinEnergy`** és **`latestWeightKg`**
  is bekerül — mindkettőt visszaadja a `/api/me/week`, a mai UI nem mutatja.
- **Négy nézet-csempe** → saját oldal (részletek §3).
- **`Mezo · a következő heted`** sáv — csak a futó héten (a mai gating változatlan) + a
  becsület-lábjegyzet.
- Hét-léptetés `‹ ›` a fejlécben, `?start=` marad; váltásnál **skeleton** (ma se töltés-, se
  hibaállapot nincs).

### A négy nézet-csempe
| # | Csempe (hub) | Aloldal |
|---|---|---|
| 1 | **Heti elemzés** (széles, lila keret): orb + az elemzés első mondata + a hét mini pontszám-oszlopai + generálás-bélyeg (`hétfő 06:15` / `hétfőn jön` / `nincs még`) | Napi pontszám kártya (sávos oszlopok, MA-jelölés, koppintás → nap-oldal) + a teljes elemzés-kártya az **`amire épült` horgony-chipekkel** + stale-frissítés + 👍/👎 + `Beszélgess a hétről` + átvezető sáv a tanulságokhoz |
| 2 | **A hét tanulságai**: nyitott javaslatok száma | a jelöltek evidencia-sorral + `✓ Tanuld meg` / `Nem rólam szól`; elfogadás után `✓ Bekerült a Tudástárba · aktív a promptban` |
| 3 | **A hét napjai**: `5 / 7 nap` + hét mini-gyűrű | 2 hasábos **nap-mozaik** (§3.3) |
| 4 | **Heti felfedezések**: `5 új nyom a memóriában` + kategória-pöttyök | mozaik státusz-chipekkel (§3.4) |

---

## 3. Oldalankénti spec (a prototípus a szó szerinti igazság)

Javasolt route-ok (a Nap tab bevált mintája szerint: hub a szekcióban, detail-oldalak
top-level, magyar sluggal):

```
/me/week                      → WeekHubPage        (MeSection gyereke, marad az Én al-nav)
/me/week/elemzes              → WeekAnalysisPage   (top-level, full-screen)
/me/week/tanulsagok           → WeekLessonsPage
/me/week/napok                → WeekDaysPage
/me/week/napok/:date          → WeekDayPage        (ISO nap; deeplinkelhető!)
/me/week/felfedezesek         → WeekDiscoveriesPage
```
Mindegyik detail-oldal örökli a `?start=` hetet (query-ben vagy a `:date`-ből derivált hétfőből).
A `:date` route egyben megoldja az audit §8.3/6-os gap-jét: **egy nap deeplinkelhető** (ma az
expanded állapot nincs az URL-ben, így a push-értesítés sem tud napra mutatni).

### 3.1 Elemzés-oldal
- Napi pontszám kártya: sávos oszlopok, `—` a tanulom-napokon, MA-jelölés, **a tengely a valós
  dátumokból** (ma hardcode `['H','K','Sz','Cs','P','Sz','V']` — Sze és Szo ütközik), koppintás
  → `/me/week/napok/:date`.
- Elemzés-kártya: próza, majd **`amire épült`** chipek a `highlights[]`-ből
  (`Minta` lav · `Tudás` arany · `Életesemény` égszín · `Emlék` rózsa), a chip a Mezo tab
  megfelelő oldalára visz (**figyelem: a route ma `/mezo/...`, nem `/insights/...`**):
  `Pattern → /mezo/patterns/{pairKey}` · `Fact → /mezo/knowledge` · `Memory → /mezo/memoir`.
- `generatedAt` ember-nyelven; stale esetén `↻ Frissítsd az elemzést` (POST regenerate).
- `weekly_review` feedback-kind (👍/👎 + a négy indok) változatlanul.

### 3.2 Tanulságok-oldal
Fej-kártya: „Ezeket a hét **napokon átnyúló** összefüggéseiből szedte össze. Amit elfogadsz,
bekerül a **Tudástárba** és a promptba — amit elvetsz, nem kérdezi újra."
Jelölt-csempe: kristály-ikon + a jelölt szövege + evidencia-sor
(`5 hét · 14 edzésnap · konfidencia erős`) + döntés-sor. Állapotok: nyitott / `✓ Bekerült a
Tudástárba · aktív a promptban` (zsálya) / `elvetve · nem kérdezi újra` (szaggatott, tompa).
Lábjegyzet: „A Mezo nem ír a tudásba magától: a heti elemzés jelöltet állít, a döntés a tiéd."

### 3.3 Napok-oldal (nap-mozaik)
- Fölötte mini-cellák: **legjobb nap · leggyengébb · tanulom**.
- 2 hasábos mozaik; minden nap saját csempe a **pontszáma szerinti washban**, nagy pontszámmal,
  a négy részpontszám **animált pálcikáival** (alvás égszín · fuel zsálya · check-in rózsa ·
  aktivitás korall) és clay-ikonos adat-chipekkel (kcal · alvás · edzés · `n/4` check-in ·
  lila `jegyzet` chip, ha az elemzés írt arról a napról). Fejlécben chevron.
- **Ne nyíljon ki helyben!** (Ez volt a 4. kör tanulsága: a jobb hasábos csempe full-width
  növése kilyukasztja a rácsot.) Koppintás → `/me/week/napok/:date`.
- Jelmagyarázat + lábjegyzet a négy pálcikáról.

### 3.4 Felfedezések-oldal
Fej-kártya: „Amit a Mezo a héten **magától** tett a memóriába — ezek nem javaslatok, hanem
megtörtént nyomok." (Ez választja el a 2-es csempe *jelöltjeitől*.)
Mozaik a digest-ből, a ma eldobott státusz-információval:
- minta-esemény: `✓ Megerősítve` / `▲ Erősödött` / `★ Előléptetve` (a `event` mező)
- új tudás (a `newFacts[].id`-vel a **konkrét** tényre linkelve, ne a listára)
- életesemény + `occurredOn` dátum · emlékkönyv · előrejelzés + kimenet
  (`◐ Folyamatban` / `✓ Bevált` / `✗ Nem jött be`)
Üresen: „Csendes hét volt — nem született új minta vagy tudás. Ez nem hiba: a memória csak
akkor nő, ha van mit tanulni."

### 3.5 Nap-oldal
Hero: a nap pontszám-gyűrűje (sávos szín) + adat-chipek; alatta egy soros minősítés.
Kártyák: **Miből jött össze** (négy részpontszám-gyűrű) · **Fuel · a cél ellenében**
(kcal / fehérje / C·F sávok — a **`kcalTarget` ma fetch-elt, de nem látszik**) ·
alvás · edzés · súly · XP cellák · a Mezo jegyzete **orb-os kártyán** 👍/👎-val és a
`Beszélgess a napról` chippel · végül **‹ előző nap / következő nap ›** csempék a szomszédok
napjával és pontszámával.

---

## 4. Becsületes állapotok (kötelező szerződések)

| állapot | szabály | szöveg |
|---|---|---|
| hiányzó adat | `—`, sosem 0 | a mai kontraktus |
| nap <2 részpontszám | nincs pontszám | **`tanulom`** + „Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog." |
| napon semmi log | külön eset (ma egybemosva) | **`nincs adat`** + „ezen a napon nem logoltál — a hét pontszámába nem számít bele" (szaggatott csempe) |
| hét <2 mért nap | nincs heti pontszám | `tanulom` + „még gyűjtöm az adatokat a heti értékeléshez" |
| jövő nap | halvány, szaggatott | „még előtted — ide majd a nap adatai jönnek"; saját üres oldal |
| futó hét, elemzés nélkül | ghost | „Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg." + `4 / 7 nap logolva` |
| **lezárt hét, elemzés nélkül** | ma ugyanaz a ghost-szöveg áll itt is (félrevezető) | „Ez a hét lezárt, de **nem készült elemzés** — a hét adatai megvannak, bármikor pótolható." + **`✦ Készítsd el most`** → `POST /api/proactive/weekly-review/{start}/regenerate` |
| az elemzés nem írt a napról | kimondja, nem hallgat | „A heti elemzés nem írt külön ehhez a naphoz — a Mezo csak azokhoz a napokhoz ír, ahol volt mit mondani." |
| töltés / hiba | **ma egyik sincs** | skeleton, illetve újrapróbálható hibaállapot — a `useMeWeek` ma eldobja az `isPending`/`isError`-t (`data/me/meWeekHooks.ts`) |

**Fokozatos bevezetés (F6.5/F6.6 nélkül):** a tanulság-csempe real módban `—` + „a hét közben
még gyűlik / nincs javaslat ehhez a héthez", a hero-trend pedig egyszerűen elmarad (a delta-pill
marad). Egyik sem hazudik, és a mock-mód demózza a végállapotot.

---

## 5. Frontend munkalista

**Ami újrahasznosul (ne írjuk újra):** a teljes data layer — `useMeWeek`, `useWeeklyReview`,
`useWeeklyReviewDigest`, `useChatHandoff`, `weekNav.ts`, `deriveWeekTitle`, `useFeedback`,
a mock seedek (`data/me/meWeek.ts`, `weeklyReviewMock.ts`) és az MSW handlerek.

**Ami a d20-ból már készen van** (`frontend/src/shared/ui/`):
`mozaik/index.tsx` → `Tile`, `Mosaic`, `MozaikPage`, `PageHead`, `PageHero`, `PageBody`,
`StatStrip`, `StatCell`, `MCells`, `CollapsibleStrip`; `mozaik/motion.tsx` → `EntranceGroup`,
`useCountUp`; `clay/` → `ClayIcon`, `ClaySpot`. **Ezeket kell használni**, ne új primitívet.
Referencia-oldal a mintára: `features/today/pages/NapKuldetesekPage.tsx` (hub → saját oldal).

**Új clay ikon:** `i-heti` (naptár + oszlopok) — a prototípus-sprite-ban már benne van
(`docs/design_2.0/assets/clay-icons.svg`), át kell vinni a FE sprite-ba
(`frontend/src/shared/ui/clay/clay-icons.svg`) és a `ClayIconName` unionba.

**Komponensek** (a mai `Week*` komponensek sorsa):
| mai | mi lesz vele |
|---|---|
| `WeekPage.tsx` | → `WeekHubPage` (hero + 8 cella + 4 csempe + következő-heted sáv) |
| `WeekScoreBars.tsx` | → az elemzés-oldal Napi pontszám kártyája (dátum-derivált tengely, kattintható, nem `aria-hidden`) |
| `WeekDayCard.tsx` | → **kettéválik**: `WeekDayTile` (mozaik-csempe) + a nap-oldal kártyái |
| `WeekReviewCard.tsx` | → az elemzés-oldalra, + a horgony-chipek és a `Készítsd el most` |
| `WeekDiscoveries.tsx` | → `/me/week/felfedezesek` mozaik státusz-chipekkel |
| `WeekNextCard.tsx` | marad, a hub aljára |

**Új:** `WeekScoreRing` (animált conic + count-up), `WeekTrendSpark` (8 hét), `WeekLessonCard`,
`DayNavTiles`.

**Tesztek:** a meglévő `WeekPage.test.tsx` / `WeekDayCard.test.tsx` átírása az új struktúrára,
mock ÉS real (MSW) módban; a §4 szerződések tesztben rögzítve (különösen a `tanulom` vs
`nincs adat` szétválasztás és a lezárt-hét-elemzés-nélkül ág). Vizuális golden: `me-heti`
(`frontend/tests/visual/visual.spec.ts:50`) — a hub új képével regenerálandó **mindkét
platformra** (darwin lokálisan `pnpm test:visual:update`, linux a
`update-visual-baselines.yml` workflow-val), és a négy új oldalra érdemes új goldeneket venni.

---

## 6. Backend: mi van meg, mi hiányzik

### 6.1 Megvan (a UI csak nem használja) — **nulla backend munka**
`highlights[]` (a horgony-chipek — az egész index-választó gépezet ezért van), `generatedAt`,
`stale` + `POST …/regenerate` (ezen fut a `Készítsd el most`), `kcalTarget`,
`avgCheckinEnergy`, `latestWeightKg`, a digest `event` / `occurredOn` / `status` mezői,
`newFacts[].id`, az anchored chat (`POST /api/companion/conversation` a
`context: {kind: week|day, date}` mezővel), a `weekly_review` feedback-kind.
A `tanulom` vs `nincs adat` szétválasztás, a nap-oldal prev/next léptetése és a töltés/hiba
állapot mind FE-oldali.

### 6.2 F6.5 — Heti tudás-jelöltek („A hét tanulságai")
**Ez a legnagyobb tétel, és pont ez Daniel fő kérése:** a heti pipeline ma **egyáltalán nem ír
a tudásba** (a generátor csak olvas; egyetlen írása a review sor + az értesítés).

**Jó hír: a jelölt-folyam már létezik**, csak a chat-extrakció táplálja. Pontos nevek:
- **Entitás:** `feature/companion/entity/LearnedFactEntity` (tábla a jelölteknek) — mezők:
  `id`, `candidateText`, `category`, **`derivedFromMessageId`** (a mai provenance: egy
  chat-üzenet!), `userDecision`, `refinedText`, `promotedFactId`.
- **Service:** `feature/companion/service/FactCandidateService` — `listPending(userId)` és
  `decide(userId, candidateId, request)`; a promóciónál fixen
  `fact.setSource(KnowledgeFactEntity.SOURCE_CHAT)`.
- **Cél-entitás:** `feature/companion/entity/KnowledgeFactEntity` — `factText`, `category`,
  `source`, `reinforcementCount`, `includeInPrompt` (default true), `lastReinforcedAt`.
  A source-konstansok ma: **`chat` · `pattern` · `manual`**.
- **Endpointok:** `GET /api/companion/fact/candidate` → `FactCandidateResponse[]`
  (`id`, `candidateText`, `category` = `train|fuel|health|life`, `userDecision` =
  `accept|reject|refine|null`, `refinedText`, `promotedFactId`, `createdAt`) ·
  `POST /api/companion/fact/candidate/{candidateId}/decision` → `FactDecisionRequest`
  (`decision: accept|reject|refine`, `refinedText`) — accept/refine átemeli knowledge fact-be,
  reject archiválja. Egy döntés / jelölt.

Tehát az **accept/reject útvonal kész**, a `Tanuld meg` / `Nem rólam szól` erre köthető.
Ami hiányzik:
1. **A generátor állítson jelöltet.** `WeeklyReviewGenerator` (`feature/proactive/service/`)
   JSON-sémája bővül: `{summary, dayNotes, anchorIndexes, candidateFacts: [{text, category,
   evidence}]}`. A rendszer-prompt tiltásai maradnak („számot kitalálni tilos"), és jöjjön
   hozzá egy új megkötés: a jelölt **csak a megadott napi adatokból / minta-eseményekből**
   következtethet, és a `evidence` sorban meg kell nevezni, mire épül. A meglévő
   „code-collected, model-selected" fegyelem szellemében érdemes a jelölteket is
   bounds-checkelni (üres/túl hosszú szöveg, ismert kategória, duplikátum-szűrés a már
   meglévő tények ellen).
2. **Provenance + heti visszakeresés — itt van a valódi séma-munka.** A `LearnedFactEntity`
   provenance-a ma **egyetlen chat-üzenet** (`derivedFromMessageId`), a heti jelöltnek viszont
   nincs üzenete. Kell tehát egy `source` (`chat` | `weekly_review`) — a `derivedFromMessageId`
   nullable-lé válik heti jelöltnél — és egy `weekStart` (vagy FK a `weekly_review` sorra).
   A `KnowledgeFactEntity`-be pedig egy **negyedik source-konstans** (`SOURCE_WEEKLY_REVIEW`),
   különben a promóció `chat`-ként hazudná a származást; `FactCandidateService.decide` a
   jelölt source-ából származtassa. Ehhez tartozik egy olvasó-útvonal is:
   `GET /api/proactive/weekly-review/{start}/lessons` (vagy a meglévő candidate-endpoint
   `weekStart` query-paramétere) → jelöltek + döntésük, hogy a lezárt hetek is visszanézhetők
   legyenek (a mai `listPending` csak az eldöntetlent adja, a design viszont a már eldöntött
   állapotot is mutatja).
3. **`evidence` mező** a válaszban (a design evidencia-sora), nullable.
4. **Idempotencia + regenerate.** A `regenerate` ma soft-deleteli a review sort; el kell
   dönteni, mi történjen a hozzá tartozó **eldöntött** jelöltekkel (javaslat: az eldöntötteket
   NEM bántjuk — a felhasználó döntése nem veszhet el —, a még nyitottakat a régi review-val
   együtt archiváljuk).
5. **Honest szabály:** ha a modell nem ad használható jelöltet, **nem születik jelölt** —
   soha nem placeholder. (Ugyanaz az elv, mint a review sornál: unusable answer ⇒ no row.)

Tesztek: `WeeklyReviewGeneratorIT` bővítése a `FakeCompanionLlm` sentinel-mechanizmusával
szkriptelt jelölt-válaszra; a promóció-út IT-je (accept → knowledge fact `source=weekly_review`,
`include_in_prompt` default), és a „nincs jelölt" ág.

### 6.3 F6.6 — Perzisztált heti pontszám + 8 hetes trend
Ma a `weekly_review` táblában **nincs `score` oszlop**
(`WeeklyReviewEntity`: `id, weekStart, summary, dayNotes, highlights, generatedAt`), és a heti
pontszám **minden olvasáskor újraszámol** (`MeWeekService` → `DayScoreService`); az egyetlen
longitudinális jel a `prevWeekScore`, ami **egy második teljes score-futást** jelent
(9 metrika-széria kérdés hetenként).

Javaslat: a heti pontszám (+ a négy heti részátlag) perzisztálása, és
`GET /api/me/week/trend?weeks=8` (vagy a `MeWeekAggregates`-be egy `history[]`).
**Hol tároljuk?** Két épkézláb hely van: (a) új `score` (+ részátlag) oszlopok a
`weekly_review` sorra — egyszerű, de akkor **nincs pontszám ott, ahol nem készült elemzés**
(üres hét, LLM-hiba), pedig a pontszám az elemzéstől független; (b) külön kis
`weekly_score(created_by, week_start, score, sleep_avg, fuel_avg, checkin_avg, activity_avg,
computed_at)` tábla partial-unique indexszel — ez a tisztább, mert a pontszám deterministikus,
az elemzés nem. A `period_summary` **nem** jó hely: az
`feature/companion/entity/PeriodSummaryEntity` (`granularity` = `week`/`month`, `periodStart`,
`summaryText`) narratíva-tároló, nincs numerikus mezője, és a memória-embedding írója is
ráakaszkodik. Ez egyszerre
- kiszolgálja a hero 8 hetes trendjét,
- kiváltja a `prevWeekScore` második futását,
- és megnyitja a „három hete volt a legjobb heted" típusú longitudinális mondatokat a
  companion-promptban (ez már F6.7 szintű extra).

Vigyázni kell: a pontszám **utólag változhat** (visszamenőleges logolás), tehát a perzisztált
érték cache, nem igazság — kell hozzá invalidálás vagy „utoljára számolva" bélyeg. Ez a szelet
ezért **külön designdöntést** igényel: mikor íródik (a hétfői job? minden olvasáskor upsert?).

### 6.4 Opcionális (nem blokkol semmit)
- **B — highlight-visszacsatolás:** amit a modell kiemelt, erősítse a minta-konfidenciát /
  tény-salience-t. Az adat ma megvan és kárba megy.
- **D — gazdagabb generátor-bemenet:** napló/döntések, kísérletek, ember-említések,
  gyógyszerciklus, `period_summary(week)` (a spec bemenetként listázta, aztán kimaradt).
- **Egyéb, az auditból (§8.3):** a `stale` csak `createdAt`-ot figyel (szerkesztett log nem
  jelöl staléra, edzés-log egyáltalán nem figyelt); a digest **UTC** ablakokat használ, így egy
  vasárnap késő esti (CET) esemény a szomszéd hét digestjébe eshet; a delta pontosan 0-nál
  zöld `"0"`-t ír `±0` helyett.

---

## 7. Munkarend (a spec §6 szerint)

1 bd issue = 1 `feat/d20-<oldal>` branch = 1 self-PR (CI-kapu, `--no-ff` merge).
A backend-szeletek külön gate-en mennek (fókuszált IT + CI), a FE F5.9 önállóan is zöld.
Ajánlott sorrend: **F5.9 (FE, meglévő kontraktusokra) → F6.5 (tanulságok) → F6.6 (trend)**,
mert az F5.9 azonnal látható értéket ad, és a két backend szelet utána bekapcsolja a
tanulság-csempét és a hero-trendet anélkül, hogy a felület újra hozzá kellene érni.

**Ellenőrző lista a szelet végén:** fókuszált tesztek (FE mindkét mód + a §4 szerződések;
BE a bővített `WeeklyReviewGeneratorIT` + `MeWeekControllerIT`), `me-heti` visual golden
regenerálva mindkét platformon, prototípus-hűség átnézve (px ×1,18), és a CODEMAP +
`docs/features/me.md` / `proactive.md` frissítve.
