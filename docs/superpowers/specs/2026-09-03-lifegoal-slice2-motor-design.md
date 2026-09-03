# Életcél-rendszer 2. szelet — a motor (bontás + döntések)

**Dátum:** 2026-09-03 · **bd:** mezo-iizd epic, új sub-issue-k: mezo-iizd.5 / .6 / .7 ·
**Alap-spec:** [2026-09-02-lifegoal-system-design.md](2026-09-02-lifegoal-system-design.md) §5, §6, §8, §9.2 —
ez a doksi CSAK a 2. szelet bontását és az alap-spec három kód-ellentmondásának feloldását
rögzíti; minden más (napi státusz-szabályok, nyíl-küszöbök, katalógus) az alap-specben él.

## 0. Bontás — három függőleges al-szelet

Daniel döntése: függőleges szeletek, 3 nagyobb darabban (A verzió).

### mezo-iizd.5 — Motor-mag + élő haladás
- `SignalSource` port + 6 megvalósítás (`engine` alcsomag): `MetricSignalSource` és
  `SocialSignalSource` → `MetricSeriesService.series` · `ActivitySignalSource` →
  `ActivityLogRepository.findByCreatedByAndOccurredOnBetween` (measure: minutes|count|huf) ·
  `HabitSignalSource` → `HabitDayRepository` · `NeedsRingSignalSource` → `NeedsDayRepository`
  (csak zárt napok, különben `no_data`) · `WeightGoalSignalSource` (lásd D-2).
- `LifeGoalScorer` — tiszta, determinisztikus (napi státusz fajtánként, súlyozott napi pont,
  irány-nyíl 7 vs 21 nap + 5 adat-napos kapu, hét/hónap aggregálás olvasáskor — alap-spec §5).
- Endpointok: `GET /api/life-goals/{id}/progress?from&to` (napi sorok + nyilak +
  konfliktus-jelzés), `GET /api/life-goals/today` (Nap-csempéhez is, de a csempe a 3. szelet),
  `POST /api/life-goals/{id}/evaluate` (kézi kiértékelés: az utolsó 3 nap upsertje +
  a mai nap olvasáskori pontja — az első `life_goal_pillar_day` sorokat ez írja).
- FE: `useLifeGoalProgress`, `useLifeGoalToday` (+ evaluate-mutáció) `useDualQuery`-vel,
  MSW fixture (a statikus `/today` a `:id` matcher ELÉ — handlers.ts:1594 minta),
  a placeholderek cseréje élő adatra: `PillarCard` (érték, minibar, 7 pötty / 28 napos
  hőtérkép, pillér-nyíl, „hány hét a fordulásig”), `CelPage` hero (nyíl + heti %),
  `CelokPage` (nyíl-számlálók, csempénkénti nyíl + 7 pötty). Hét/Hónap chipek élesítése.
- Konfliktus-figyelés (D7): olvasáskor derivált jelzés a progress-válaszban (companion-mondat
  a 3. szeletben fogyasztja, a FE a hubon még nem jeleníti meg kötelezően).

### mezo-iizd.6 — Éjszakai job + XP
- `LifeGoalEvalJob` — `HabitJob` minta: `@ConditionalOnProperty(LIFEGOAL_SWITCH,
  LIFE_GOAL_EVAL_JOB_SWITCH)` + `@Scheduled(cron = "${mezo.lifegoal.eval-cron}")`, alap
  `0 20 0 * * *`; kapcsoló `mezo.techcore.cron.life-goal-eval-job.enabled`;
  felhasználónként hibaizolált; minden aktív cél pilléréhez az utolsó 3 nap upsertje
  (kései naplózás), idempotens.
- XP: `ProgressionService.awardLifeGoal` wrapper a közös idempotens farkon;
  `source_type = LIFE_GOAL` (a CHECK már az 1. szeletben bővült —
  202609021010_mezo-iizd.1_life_goal_source_type.sql), kulcs: lásd D-1;
  config `mezo.lifegoal.xp-per-hit` (alap 5) a `LifeGoalProperties`-ben.
  Csak `hit` pillér-nap ad XP-t a pillér `skill_key`-ére; a cél nem ad, `miss` nem von le.

### mezo-iizd.7 — Triggerek + Jelek
- Ha–akkor trigger-kiértékelés: két esemény-listener (`CheckInSavedEvent` — létezik;
  `SportSessionLoggedEvent` — ÚJ, lásd D-4) + a job (késleltetett tervek, lásd D-3).
- `AppNotificationKind.LIFE_GOAL_PLAN` — feed-only (lásd D-3), deeplink `/me/goals/{id}`,
  dedupKey `<goalId>:<planIdx>:<day>`.
- `GET /api/life-goals/signals` bővítése liveness-szel (él/alszik: volt-e adat az elmúlt
  7 napban, forrásonként), + „x/7 nap” és a tápált pillérek chipjei.
- FE: `JelekPage` (`/me/goals/signals` — statikus route a `me/goals/:id` ELŐTT,
  router.tsx:338 szabály), a hub „Jelek” sora élesítve.

## 1. Feloldott döntések (az alap-spec ↔ kód ellentmondásai)

### D-1 · XP-idempotenciakulcs
Az alap-spec `source_ref_id = <pillarId>:<day>` kulcsot mond, de a
`LevelUpEventEntity.sourceRefId` **UUID NOT NULL** oszlop. Döntés: **determinisztikus
`UUID.nameUUIDFromBytes(("lifegoal:" + pillarId + ":" + day).getBytes(UTF_8))`**.
Stabil a job 3 napos újraírásain át, és source/kind-váltásnál (amikor a pillér-nap
sorok eldobódnak és újraszámolódnak) is véd a dupla award ellen. A `pillar_day` sor saját
UUID-ja elvetve: a sor élettartamához kötné a kulcsot, pont a törlés+újraírás esetben
engedne duplát.

### D-2 · A `linked` pillér „ütemben” ítélete
A goal-engine-ben nincs onPace verdict (`GoalPrescriptionJson.Feasibility.verdict` =
`feasible | feasible-with-warnings | aggressive` — megvalósíthatóság, nem ütem). Döntés:
a `WeightGoalSignalSource` **maga számol ütemvonalat** az aktív súlycélból:
`expected(day) = start_weight + (target − start) × eltelt/teljes`; a trend-súly a jó
oldalon vagy toleranciasávban (±0,3 kg) → `hit`, különben `partial` — `miss` soha (D1
guardrail). Nincs aktív súlycél vagy nincs trend-súly → `no_data`. A teljes goal-engine
éjszakai futtatása elvetve (drága, és a feasibility amúgy sem ütem-ítélet).

### D-3 · LIFE_GOAL_PLAN: feed-only + job-oldali késleltetés
`familyKey = null` (feed-only, `WEEKLY_REVIEW_READY` precedens) — nincs push-kategória
és preferencia-vezeték az első körben. Késleltetés: az azonnali (delayHours=0) triggerek
az esemény-listenerből emitálnak; a késleltetettek („másnap reggel”) az éjjeli job
emitálja a következő futáskor — külön ütemező-mechanika nincs. Egy terv naponta legfeljebb
egyszer szólal meg (dedupKey), csak ELSŐ átmenetkor (újra-kiértékelés nem ismétel —
a researcher „transitions only” tanulsága).

### D-4 · `SportSessionLoggedEvent`
Nem létezik a train-ben (csak `MesocycleClosed`). A .7 szelet adja hozzá:
publikálás a sport-session mentésekor, a `CheckInSavedEvent` mintájára. Az esemény a
`feature/train`-ben él, a lifegoal listener csak fogyasztja — az ArchUnit-irány
(lifegoal → train, visszafelé semmi) nem sérül.

## 2. Prior art (researcher, 2026-09-03)

- **Loop Habit Tracker** — napi tényadat az igazság, minden származtatott (score, trend)
  tiszta újraszámolás; visszamenőleges javítás = ablak újraszámolása. **Átvéve** (a
  pillar_day a tény, nyíl/hőtérkép olvasáskor derivált). https://github.com/iSoron/uhabits/discussions/689
- **Habitica cron-bugok** — a duplán futó napi kiértékelés kétszer büntetett; tanulság:
  a `(pillar, day)` kulcsú upsert + XP-ledger egyedi kulcs nem alku tárgya. **Átvéve**
  (D-1). https://habitica.fandom.com/wiki/Cron
- **Exist.io** — gördülő újra-szinkron ablak: minden futás az utolsó napokat írja újra,
  a késői adat magától backfillel. **Átvéve** (3 napos ablak, alap-spec §5). https://kb.exist.io/article/55-will-exist-find-correlations-across-multiple-days
- **Oura Readiness** — heterogén jelek pillér-szinten normalizálva, aztán explicit
  súlyokkal kombinálva; az átláthatatlan súlyozás elvetve — nálunk a súly 1..3 látható.
  https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
- **Idempotens partition-overwrite batch** — naponkénti upsert + korlátos újraszámolási
  ablak + side-effect ledger; „a jó pipeline újrafuttatható”. **Átvéve** (job-forma).
  https://www.ml4devs.com/what-is/backfilling-data/

## 3. Codebase terrain (investigator, 2026-09-03)

- A `LifeGoalPillarDayRepository` finderei (upsert-lookup + tartomány-olvasás) már az
  1. szeletben elkészültek; a táblát még semmi nem írja.
- `PillarSourceJson.type` a 6 forrás-diszkriminátor; `LifeGoalProperties`
  (`mezo.lifegoal` prefix) kapja az `xp-per-hit`-et; a `LifeGoalSignalService` kapja a
  liveness-t; minden pillér-nap-törlés a `LifeGoalPillarService.deleteWithDays`-en megy.
- Job-minta: `HabitJob` (kettős `@ConditionalOnProperty`, per-user try/catch);
  kapcsoló-konstansok: `FeaturesConfiguration` (LIFEGOAL_SWITCH: 224. sor környéke).
- XP-minta: `ProgressionService.award…` család, `SOURCE_NEEDS` a legközelebbi precedens.
- Notification: `AppNotificationEmitter.emit(owner, kind, title, body, deeplink, refId,
  dedupKey)` — always-on, hiba sosem töri a domain-írást.
- FE: a placeholderek a `PillarCard.tsx` (6. sor kommentje nevesíti a 2. szeletet),
  `CelokPage.tsx:58`, `CelPage` hero; router-szabály: statikus route a `me/goals/:id`
  előtt; MSW: statikus path a `:id` handler előtt; a CSS-guard a `lg-*` szabályokat a
  Today-szekció elé kényszeríti a `styles/prototype.css`-ben.
- Csapdák: `sourceRefId` UUID (D-1) · nincs onPace verdict (D-2) · nincs
  `SportSessionLoggedEvent` (D-4) · needs_ring csak zárt napon ad adatot (`no_data`,
  sosem `miss`) · ArchUnit fagyasztott ciklus-szabály csak a teljes suite-ban fut ·
  FE mindkét teszt-mód explicit `VITE_USE_MOCK`-kal.
- Kedvező drift: a `level_up_event.source_type` CHECK már tartalmazza a `LIFE_GOAL`-t
  (202609021010_mezo-iizd.1_life_goal_source_type.sql) — nem kell új migráció.

## 4. Tesztelés szeletenként (alap-spec §8 bontva)

- **.5**: `LifeGoalScorer` egység (ütemvonal, medián-baseline + 14 napos kapu,
  nyíl-küszöbök + 5 adat-napos kapu, súlyozott napi pont `no_data`-kihagyással, `null`
  ha nincs adat, D-2 linked-szabály); fókuszált IT (`-Dmezo.test.use-testcontainers=true`):
  progress/today/evaluate + 3 napos upsert-újraírás; FE hook- és render-tesztek mindkét
  módban (üres állapot + `no_data` pillér); `-Dtest='*Arch*Test'` külön.
- **.6**: job-idempotencia (kétszer futtatva ugyanaz), XP-idempotencia a D-1 kulcson,
  kapcsoló-teszt (disabled → nem fut).
- **.7**: trigger-egység (source/condition/delay), notification-dedup IT, liveness IT,
  `JelekPage` render mindkét módban.
- Minden szelet: codemap-regenerálás, contract-drift, docs-lint,
  `docs/features/lifegoal.md` frissítés ugyanabban a változásban, CI teljes suite a
  self-PR-en.
