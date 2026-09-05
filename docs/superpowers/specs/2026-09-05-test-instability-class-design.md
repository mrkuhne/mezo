# Idő- és terhelésfüggő teszt-instabilitás — hibaosztály-felszámolás (design)

Dátum: 2026-09-05 · Státusz: elfogadott terv-alap · Driving issue-k: mezo-7qpy, mezo-8h2s, mezo-oou9, mezo-0121, mezo-lld8

## 1. Probléma

A bd-ben 22 issue írta le ugyanazt a hibaosztályt: tesztek, amelyek a fali órától
(éjfél-átfordulás, időzóna), a gép terhelésétől (5 s-os default vitest/waitFor-plafon
teljes-suite párhuzamosság alatt), adatbázis-versenytől (TRUNCATE deadlock), időbélyeg-
kerekítéstől (1 µs) vagy szivárgó timerektől függően buknak. Ez EGY szelet-sorozat egy
hibaosztályra, nem 22 külön javítás.

## 2. Dedup-eredmény (2026-09-05, bd-ben végrehajtva)

**10 duplikátum lezárva**, tartalom-átvezetéssel a kanonikus issue-ba:

- ActiveWorkoutPage terhelés-osztály → **mezo-0121** (beolvadt: cymy, sw4w, 0p2q, s65q, eqfm, h3rj)
- LlmCallListIT éjfél-átfordulás → **mezo-7qpy** (beolvadt: opm5, 8d37, phib)
- PatternDetectionServiceIT 1 µs → **mezo-glvp** (beolvadt: owa1)

**5 issue már javítva volt a mai main-en** — bizonyítékkal lezárva:

- mezo-a89u (timelineHooks mock fali-óra) — PR #446/mezo-5b4r: injektált `MOCK_NOW_HHMM`, nincs fali óra
- mezo-rr71 (FuelMaiPage sky) — a teszt megszűnt (shell kivezetve), a maradék órát pinnel
- mezo-k7d (CheckInSheet timer) — unmount-cleanup a helyén (CheckInSheet.tsx:85-93)
- mezo-i9s7 (MesoCloseSheet) — fireEvent.change + re-querying waitFor + selector:'p' hardening
- mezo-glvp (1 µs) — mezo-mfmb: írás-oldali MICROS-csonkolás + guard-assert; a :178/186 testvér DB-vs-DB, nem flaky

**Szándékosan ki nem javított, nyitva hagyott határesetek:**

- **mezo-448k** — teszt-FEDEZETI rések (nem instabilitás); az 5. pontja (BeallitasokPage
  setTimeout-0 várakozás) flake-szomszédos, de fedezet-kérdés, oda tartozik.
- **mezo-htzy** — látens PROD él (wake ≥ 18:00 midnight-wrap inverzió) + opcionális
  boundary-tesztek; viselkedési hiba-gyanú, nem teszt-instabilitás. Külön szeletet érdemel,
  nem ebbe a sorozatba való.

## 3. Gyökér-ok csoportok és a maradék munka

| Csoport | Issue | Diagnózis | Javítás iránya |
|---|---|---|---|
| (a) fali-óra: éjfél-átfordulás | mezo-7qpy | LlmCallListIT 12 sora `Instant.now().minus(i, MINUTES)`, a period=DAY ablak `LocalDate.now(zone)`-nál (Europe/Budapest) vág → éjfél után sorok esnek ki. Testvér-tesztek ugyanígy seedelnek (`:41,43,77,100`). | Determinisztikus nap-horgony a seedben (helyi nap kezdete + offsetek), NEM Clock-bean (lásd 5.) |
| (a)+zóna-inkonzisztencia | mezo-8h2s | CompanionToolsRenderIT `LocalDate.now().minusDays(3)`-ra seedel, "4. nap"-ot hardcode-ol. RÁADÁSUL prod-hiba is: `MedicationService.java:62` UTC-t, `MedicationTools.java:73` default zónát használ a ciklusnap-számításhoz — UTC és helyi éjfél között ±1 nap drift. | Zóna-egységesítés a prod kódban + a fixture/assert ugyanabból a referenciából származtatva |
| (b) terhelés alatti timeout | mezo-0121 (+ FuelSettingsPage prefill) | ActiveWorkoutPage.test.tsx: 2046 sor, 99 teszt, ~40+ real-delay `userEvent.setup()`, teljes suite alatt a fájl 68→93 s (izoláltan 25-33 s); a waitForok condition-alapúak, de az 5 s plafon (nincs `testTimeout` a vite.config.ts-ben) contention alatt kevés. Állapot-szivárgás NAGYRÉSZT kizárva (friss QueryClient/render, medalEvaluator resetelve); a B1/B2 és a "Szett kész ✓" hiánya a hosszú userEvent-láncok contention-lassulása. | Config-szintű `testTimeout`-emelés (a várakozások MÁR condition-alapúak — ez a "tényleg lassú a gép" eset) + a legdrágább láncok olcsóbbítása, mérésekkel igazolva |
| (b) kicsi | mezo-lld8 | dualMode.guard.test.ts két fa-bejáró tesztje default 5 s büdzsével | A config-szintű plafon lefedi; + olcsóbb walk, ha a mérés indokolja |
| (c) DB-verseny | mezo-oou9 | ResetDatabase egyetlen `TRUNCATE ... CASCADE` (ResetDatabase.java:39-49) vs élő olvasók. Részben enyhítve: 2 cron letiltva, `drainAsyncWork` — de a drain 2000 ms-ra korlátos (AbstractIntegrationTest.java:139) és csak az `applicationTaskExecutor`-t fedi; 7 @Async AFTER_COMMIT embedding/graph listener él, a GraphPromotionListener LLM-hívós (lassú lehet). | A drain teljessé tétele (minden async munka bevárása, hosszabb, de hard-fail plafonnal) + a maradék cronok letiltása a teszt-profilban a meglévő kill-switch mintával |
| (d) µs-kerekítés | mezo-glvp | — | Már javítva (lezárva) |
| (e) szivárgó timer | mezo-k7d | — | Már javítva (lezárva) |

## 4. Szelet-terv (mind friss origin/main-ből, egy szelet = egy branch = egy self-PR)

1. **S1 — mezo-7qpy**: LlmCallListIT (és testvérei) nap-horgonyos seedelés. Bizonyítás:
   a report-zóna teszt-oldali átállításával olyan zónára, ahol "most" épp éjfél utáni perc
   van → a régi seedelés determinisztikusan bukik, az új átmegy; több szimulált napszak.
2. **S2 — mezo-8h2s**: Medication ciklusnap-zóna egységesítés (prod) + fixture-pinnelés.
   Bizonyítás: zóna-szimuláció (a két éjfél közti sávot előállítva) a régi kód bukik, az új nem.
3. **S3 — mezo-oou9**: ResetDatabase/async-drain teljessé tétele + cron kill-switch bővítés.
   Bizonyítás: mesterségesen lassított AFTER_COMMIT listenerrel a régi drain mellett a
   TRUNCATE ütközés reprodukálható, az új mellett nem.
4. **S4 — mezo-0121 + mezo-lld8**: FE terhelés-osztály: vitest `testTimeout` policy
   (config-szinten, CI-tudatosan) + a leglassabb várakozás-alakok célzott olcsóbbítása.
   Bizonyítás: terhelés alatti (párhuzamos CPU-stressz melletti) teljes futásokkal előtte/utána.
5. **S5 — zárás**: repó-szintű audit: maradt-e a hibaosztályból issue nélküli teszt
   (zero-arg `now()`/`LocalDate.now()` a BE-tesztekben, fali-óra olvasó FE-teszt fagyasztás
   nélkül, default-timeout-ra érzékeny nehéz fájlok); találatokra új bd issue-k. + zárójelentés.

## 5. Kulcs-döntések (indoklással)

- **NEM vezetünk be backend Clock-beant.** A repo dokumentált konvenciója, hogy nincs
  Clock-bean (TdeeBootstrapService.java:67); bevezetése architekturális döntés lenne
  (ArchUnit-rétegek, CODEMAP, minden `now()`-hívóhely), aránytalan ehhez a két BE-teszthez.
  A determinisztikus nap-horgonyos seedelés a tesztben ugyanazt a stabilitást adja beavatkozás
  nélkül. Ha a jövőben harmadik-negyedik idő-flake jön, akkor éri meg ADR-rel Clock-beant hozni.
- **NEM vezetünk be közös FE óra-fagyasztó harnesst.** ~25 fájl használ már inline
  `vi.useFakeTimers({toFake:['Date']})` + `setSystemTime` mintát, és a MARADÉK munkában
  egyetlen FE óra-flake sincs (mind javítva) — egy új absztrakciónak most nulla fogyasztója
  lenne. A minta dokumentált exemplárja: timelineHooks.test.tsx:172-176.
- **A (b) osztályban a plafon-emelés config-szinten JOGOS**, mert a várakozások már
  condition-alapúak (waitFor/findBy), izoláltan gyorsak, és a bukás bizonyítottan
  CPU-contention (sw4w mérés: 20 s plafonnal 3→1 hiba; Maven-futás mellett 4-5-re romlik).
  Ez a prior art szerinti "acceptable": a plafon a hiba, nem a várakozás alakja — DE a
  20 s-nál is megmaradó 1 hiba miatt a legdrágább interakció-láncokat is olcsóbbítjuk
  (pl. sok-kattintásos szett-kitöltő helper), és a maradékot méréssel zárjuk le.

## 6. Bizonyítási protokoll (minden szeletre kötelező)

Egy flake-javítás, amit nem tudunk elrontani, nem javítás:

- A javítás ELŐTT reprodukció: a hibát kiváltó feltétel determinisztikus előállítása
  (zóna-átállítás "éjfél utánra", CPU-stressz, lassított listener).
- A javítás UTÁN ugyanaz a feltétel zölden.
- Napszak-függő eseteknél legalább 3 szimulált napszak (hajnal 00:0x, délután, 23:5x).
- FE: mindkét mód explicit (`VITE_USE_MOCK=true` és `=false`), fókuszált BE:
  `-Dmezo.test.use-testcontainers=true`, ArchUnit külön.

## 7. Prior art (researcher-recon)

- **Clock-injektálás** (jonasg.io: How to effectively test time-dependent code) — az (a)
  osztály kanonikus megoldása; itt tudatosan ELVETVE a repo no-Clock-bean konvenciója és a
  kicsi felület miatt (lásd 5.). URL: https://jonasg.io/posts/how-to-effectively-test-time-dependent-code/
- **Fake timers + user-event `advanceTimers` híd** (Testing Library hivatalos guide) — a
  FE (a)/(e) osztály mintája; a repo már így csinálja, új munka nem kell. URL:
  https://testing-library.com/docs/using-fake-timers/
- **TRUNCATE vs DELETE vs tranzakció-lezárás teszt-reset alatt** (Testcontainers #4845
  discussion; Respawn-írás): a deadlock oka a reset előtt élve maradt tranzakció — a fix a
  quiesce (async munka bevárása), nem a TRUNCATE tuningolása; DELETE kisebb lock-lábnyomú
  fallback. ELFOGADVA a quiesce-irány (S3). URL: https://github.com/testcontainers/testcontainers-java/discussions/4845
- **Postgres timestamptz = 1 µs felbontás, kerekít** (PG docs) — írás-oldali csonkolás vagy
  isCloseTo; a repo már az írás-oldali csonkolást használja. URL: https://www.postgresql.org/docs/current/datatype-datetime.html
- **Timeout-emelés vs várakozás-átalakítás vitestben** (trunk.io flaky-guide + vitest #9751):
  plafon-emelés per-teszt = anti-pattern; config-szintű, CI-tudatos emelés condition-alapú
  várakozásokra elfogadott. ELFOGADVA az S4 alapjaként. URL: https://trunk.io/blog/how-to-avoid-and-detect-flaky-tests-in-vitest

## 8. Codebase terrain (investigator-recon)

- **Érintett fájlok**: backend/src/test/.../llmlog/controller/LlmCallListIT.java:156 (+ :41,43,77,100);
  .../companion/tools/CompanionToolsRenderIT.java:1025,1030,1056,1062; feature/medication/…
  MedicationService.java:62 (UTC) vs MedicationTools.java:73 (default zóna) — kód-vs-kód
  inkonzisztencia; support/ResetDatabase.java:39-49 + AbstractIntegrationTest.java:125-150
  (2 s-os korlátos drain); 7 db @Async AFTER_COMMIT listener a companion alatt
  (TurnEmbedding-, JournalEmbedding-, GratitudeEmbedding-, DecisionEmbedding-,
  ReflectionEmbedding-, GraphPromotion- [LLM-es!], FlagEvaluationListener);
  frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx (2046 sor, 99 teszt, csak a
  hard-reload tesztnek van 20 s-os timeoutja :1237-1268); frontend/vite.config.ts:69-76
  (nincs testTimeout, nincs worker-sapka); frontend/src/data/dualMode.guard.test.ts:66,280;
  frontend/src/features/fuel/pages/FuelSettingsPage.test.tsx:158-206.
- **Követendő minták**: `vi.useFakeTimers({toFake:['Date']})`+`setSystemTime` (timelineHooks
  :172-176); injektált mock-now (`MOCK_NOW_HHMM`, timelineHooks.ts:39); írás-oldali
  `truncatedTo(MICROS)` (TrainService.java:332 stb.); cron kill-switch a teszt-profilban
  incidens-kommenttel (application.properties:23-37); flake-fix inline CI-incidens-kommenttel.
- **Csapdák**: nincs Clock-bean (konvenció); a report-zóna config (application.yml:479), a
  teszt-oldali zóna-átállítás a BIZONYÍTÁS eszköze, nem a javításé; `VITE_USE_MOCK` unset =
  mock; a drain csak az applicationTaskExecutort fedi; fixed-DB mód lokálisan versenyez —
  Testcontainers kapcsolóval futtatunk.

## 9. Tesztelés / elfogadás

A sorozat kész, ha: az 5 nyitott issue szeletei CI-zöld self-PR-ban állnak; minden javításhoz
rögzített reprodukció-bizonyíték van (bukik a hibával, zöld nélküle, napszak-szimulációval
ahol releváns); az S5 audit lefutott és a talált maradék esetekre bd issue van; zárójelentés
a driving issue-kban + ebben a spec-ben hivatkozva.
