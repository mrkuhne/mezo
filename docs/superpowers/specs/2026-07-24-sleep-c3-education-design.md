# Sleep slice C3 — Walker stat-deck + eszkalációs kártya + research-ingest

> **Status: APPROVED (D1–D7)** · bd **`mezo-hd8k`** · branch `feat/sleep-c3` · 2026-07-24
> A sleep cluster **C3** szelete a [cluster-notes](2026-07-23-sleep-routine-cluster-notes.md) §4
> „Motivation/education stat cards" + „Escalation nudge" elemeiből, plusz a §7 research-ingest TODO
> lezárása. A C-éj (`mezo-d71m`, PR #59) már a mainen van — erre épül.

## 1. Kontextus és cél

A Walker-extrakció idézhető statjai eddig csak a cluster-notes-ban éltek. A C3 (1) **napi
motivációs felületet** ad nekik az Alvás oldalon, (2) a tartósan rossz alvásra **szelíd,
adat-vezérelt eszkalációs utat** nyit (itt kapnak helyet a súlyos klinikai statok is, a megfelelő
keretben), és (3) a két forrás-videót **rendes research-wiki oldalakká** desztillálja
(`docs/research/`, knowledge-base skill), hogy a kártyáknak hivatkozható forrása legyen.

A `mezo-lfw` „placeholder strip" elve kötelez: az Alvás oldalra csak **kurált, valós tartalom**
kerülhet vissza, kis lábnyommal — egy rotáló kártya, nem kártyafal.

## 2. Döntések (D1–D7)

- **D1 — Scope.** Három pillér: Walker stat-deck (rotáló kártya + deck-sheet) · eszkalációs
  kártya (sleepLog-trigger) · research-ingest (Walker DOAC + Ethier reggeli-rutin). A
  **DEBUNK/mítoszirtó kártyák tartalékban maradnak** (a §4 cáfolat-lista featureként továbbra is
  tiltott). App-oldal **FE-only** — nincs backend/contract/migráció; a trigger a meglévő
  `useSleep().sleepLog`-ból számol kliens-oldalon.
- **D2 — A deck tartalma; a nehéz statok elkülönítése.** A napi rotációban **7 motivációs
  kártya** forog (pontos HU copy: §3) — a **<6h→öngyilkossági rizikó és a rémálom-biomarker stat
  NEM rotál**: kizárólag az eszkalációs sheet kontextusában jelenik meg, ahol a „fordulj
  szakemberhez" út közvetlenül mellette van (D4). Minden kártya forrás-címkét hordoz (pl.
  „UK Biobank ~60 000 fő · M. Walker"); a repo-oldali provenance a D6 research-oldalak.
- **D3 — Stat-UI.** **`SleepStatCard`** a két ScoreRing alatt (az éjszakai-belépő sor és a
  last-night hero között marad a meglévő sorrend; a stat-kártya a ringek UTÁN jön): kompakt
  idézet-kártya — eyebrow „MIÉRT SZÁMÍT?" + a napi stat title/text + forrás-címke. **Naponta
  determinisztikusan rotál**: index = a `localDateString()` számjegyeiből képzett egész
  (`YYYYMMDD`) mod deck-hossz — óra-tick nem kell, napi egy érték. Koppintásra
  **`SleepStatsSheet`** nyílik: a teljes deck görgethető listaként (title/text/source
  kártyánként) + lábjegyzet a forrásokról. Tartalom-modul: `features/me/logic/sleepEducation.ts`
  (a `nightContent.ts` mintája — típusos, tiszta HU copy, `STAT_DECK: SleepStat[]`).
- **D4 — Eszkalációs kártya.** Pure trigger `features/me/logic/sleepEscalation.ts`:
  `evaluateEscalation(log: SleepEntry[], today: string): { triggered: boolean; reason: 'short' | 'quality' | null }`
  — a **trailing `ESCALATION_WINDOW_DAYS = 14` nap** logolt éjszakáiból, **`MIN_SAMPLES = 5`**
  minta alatt sosem triggerel; `reason='short'` ha `avg(duration) < SHORT_AVG_H = 6.0`, különben
  `reason='quality'` ha `avg(quality) <= POOR_AVG_QUALITY = 4`. Ha triggerelt és nincs snooze:
  **`SleepEscalationCard` renderel a `SleepStatCard` HELYETT** (elsőbbség — egyszerre csak egy).
  Hangnem: szelíd, tényszerű, se piros, se bűntudat (ADR 0010): „Az elmúlt két hétben tartósan
  kevés / rossz minőségű az alvásod." + egy mondat arról, hogy ez nem akaraterő kérdése, és van
  bizonyított, gyógyszermentes segítség. Koppintásra **sheet** (a `SleepStatsSheet`-be épített
  eszkalációs szekció VAGY saját sheet — implementációs döntés a plané, de EGY sheet-komponens
  preferált): itt szerepelnek visszafogott framinggel a súlyos statok („a tartósan 6 óra alatti
  alvás a kutatásokban jelentősen megnövekedett öngyilkossági rizikóval jár együtt; a gyakori,
  nyomasztó rémálmok önálló figyelmeztető jelek"), majd a **CBT-I** mint elsővonalbeli terápia +
  „beszélj háziorvossal / alvás-szakemberrel". **„Most nem"** → `SNOOZE_DAYS = 14` napra némít
  (localStorage `mezo-sleep-escal-snooze` = ISO dátum, ameddig némítva); lejárta után
  újra-értékel. A snooze alatt a stat-kártya rotál tovább.
- **D5 — Fájl-térkép (FE).** Új: `features/me/components/SleepStatCard.tsx`,
  `features/me/components/SleepEscalationCard.tsx`, `features/me/sheets/SleepStatsSheet.tsx`,
  `features/me/logic/sleepEducation.ts`, `features/me/logic/sleepEscalation.ts` (+ kolokált
  tesztek). Módosul: `features/me/pages/SleepPage.tsx` (mount a ringek alatt: eszkaláció-VAGY-stat
  + a sheet state), `styles/prototype.css` (kis `.sstat*` / `.sesc*` család a meglévő
  kártya/wash-idiómákból, a fájl végére fűzve). Hookok kizárólag `@/data/hooks`-ból
  (`useSleep`).
- **D6 — Research-ingest (docs, a knowledge-base skill konvenciói szerint).** Két forrás a
  `docs/research/`-be. **Provenance-őszinteség:** teljes transcript nincs — a raw réteg a
  megtekintésből készült **extrakciós jegyzet** (a cluster-notes §4 kibontva), ezt a raw oldal
  frontmatter/bevezető explicit kimondja (videó-ID + „extraction notes, captured 2026-07-23").
  Oldalak: `research/raw/` alá a Walker DOAC-interjú (`qxxnRMT9C-8`) és az Ethier
  reggeli-rutin (`eifEiCYH2yc`) jegyzete; desztillálva: a QQRT-keret + rendszeresség +
  alvás-cáfolatok koncepció-oldalak és a reggeli-rutin koncepció-oldal (a pontos
  fájlnevek/frontmatter a knowledge-base skill sémáját követik — a plan a skill beolvasása után
  rögzíti), kereszt-linkekkel a `features/me.md`/`habit.md` felé és vissza. `node
  scripts/lint-docs.mjs` zöld az érintett oldalakra.
- **D7 — Tesztelés + élő doksik.** Tesztek: `sleepEducation` (deck-hossz, rotáció-determinizmus:
  fix dátum → fix index, másnap → másik index, mod-átfordulás), `sleepEscalation` (min-minta
  határ 4/5, short-határ 5.99/6.0, quality-határ 4/5 — half-open szemantika a specé: trigger ha
  `avg < 6.0` ill. `avg <= 4`, a 6.0 átlag NEM short, a 4.0 átlag IGEN quality —, ablak-szűrés
  14 napra, üres log), kártya-elsőbbség + snooze írás/lejárat, sheet render, SleepPage
  integráció — mindkét mód zöld + build. Élő doksik ugyanabban a change-ben: `me.md` (Alvás § +
  §10), cluster-notes §0/§3/§4 (C3 kész; DEBUNK-kártyák továbbra is tartalék), `node
  scripts/lint-docs.mjs`. Runtime-verify a mock FE-n: rotáció dátum-patch-csel, trigger
  szintetikus rövid-alvás loggal, snooze-út, sheet-tartalom.

## 3. A deck pontos tartalma (7 kártya, HU copy — a plan szó szerint viszi)

| # | key | title | text | source |
|---|---|---|---|---|
| 1 | `regularity` | A rendszeresség a király | A legrendszeresebben alvóknál −49% össz-halálozás, −57% kardiometabolikus betegség és −39% rák-halálozás — és a rendszeresség a mennyiségnél is erősebb előrejelző. | UK Biobank ~60 000 fő · M. Walker |
| 2 | `muscle` | Az izmod az alvásodon múlik | Alváshiány mellett fogyókúrázva a leadott súly ~70%-a izom, nem zsír. | Alvásmegvonásos diéta-vizsgálat · M. Walker |
| 3 | `hunger` | Az éhség a fáradtsággal nő | Kevés alvás mellett ~30–40%-kal éhesebb vagy: a jóllakottság-hormon (leptin) csökken, az éhséghormon (ghrelin) nő. | Leptin/ghrelin vizsgálatok · M. Walker |
| 4 | `genes` | Egy hét, 711 gén | Egyetlen rövid-alvásos hét 711 gén működését torzítja — a gyulladásosak fel, az immunvédelem le. | Möller-Levet 2013 · M. Walker |
| 5 | `glymphatic` | Éjszakai nagytakarítás | A mély alvás alatt az agy glymphatikus rendszere kimossa a béta-amiloidot és a taut — ez a napi karbantartás. | M. Walker |
| 6 | `remlight` | +18% REM a tompított estétől | Meleg, 30 lux alatti esti fény mellett +18% REM-alvást mértek — ezt segíti az esti tompítás. | M. Walker |
| 7 | `band` | 7–9 óra: sáv, nem szabály | Nem mindenkinek jár 8 óra — az igény 7–9 óra között szór. A sávodon belül a rendszeresség számít igazán. | M. Walker |

Az eszkalációs sheet-szekció súlyos statjai (CSAK ott): „Tartósan 6 óra alatti alvás mellett a
kutatások 100–150%-kal magasabb öngyilkossági rizikót mértek; a gyakori, nyomasztó rémálmok
önálló figyelmeztető jelek — a szervezet vészjelzései, nem jellemhibák." + CBT-I ajánlás.

## 4. Amit NEM építünk

DEBUNK-kártya-deck (tartalék); rémálom-tracking (nincs adat); backend/insights-integráció;
push-notification; a Tudás(gráf) domainbe seedelés. A stat-kártya nem kap XP-t/gamificationt.

## 5. Edge-esetek

- **Üres/kevés log:** `MIN_SAMPLES` alatt sosem eszkalál; a stat-kártya logtól függetlenül
  renderel (statikus tartalom — a goal-hoz hasonlóan mindig van).
- **Snooze lejárat:** ISO-dátum összevetés `localDateString()`-gel; lejárt vagy hiányzó kulcs →
  újra-értékelés; korrupt érték → mintha nem lenne (try/catch, a `nightTrace` minta).
- **Rotáció determinizmusa:** ugyanaz a nap mindig ugyanaz a kártya (nincs óra-tick, nincs
  villanás); a dátum-szám mod deck-hossz átfordulása tesztelt.
- **Mock vs real:** a mock sleepLog (7 éjszaka, 7.3–7.8h, quality 7–9) NEM triggerel eszkalációt
  — a mock demó a stat-kártyát mutatja; a trigger-ágak tesztből + runtime-verifyben szintetikus
  loggal fedettek.

## 6. Elhalasztva / follow-up

- DEBUNK/mítoszirtó kártyák (a deck-sheet természetes bővítése lenne — külön szelet).
- Fázis-vizualizáció (hipnogram) a screenshot-fázisokból — a user által jelzett lehetséges
  jövőbeli szelet.
- Élő Gemini-kulcsos sleep-shot smoke a kanonikus screenshottal (kézi, backend + kulcs kell).
