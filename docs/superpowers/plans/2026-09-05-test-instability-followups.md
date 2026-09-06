# Teszt-instabilitás — follow-up sorozat (S1–S4 + c9k4-értékelés) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan slice-by-slice. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Lezárni a 2026-09-05-i teszt-instabilitás-sorozat záró-review-ja és záró-auditja által hátrahagyott hat follow-up issue-t (mezo-pk63, mezo-ned9, mezo-ojpr, mezo-4jtz, mezo-418z, mezo-c9k4) négy szeletben + egy értékelésben.

**Spec:** [`docs/superpowers/specs/2026-09-05-test-instability-class-design.md`](../specs/2026-09-05-test-instability-class-design.md) — §5 döntései és §6 bizonyítási protokollja **ebben a sorozatban is kötnek**. Előzmény-PR-ek: #470 (mezo-7qpy), #471 (mezo-8h2s), #473 (mezo-oou9), #474 (mezo-0121/lld8), #475 (audit).

**Architecture:** Négy független szelet, mind friss `origin/main`-ből saját worktree-ben, saját branch + self-PR. Nincs közös új absztrakció; minden fix a meglévő repo-mintákat használja.

**Tech Stack:** Java 21 / Spring Boot 4 / JUnit5 + AssertJ + Testcontainers (BE); React 19 / Vitest + Testing Library (FE).

## Global Constraints (a spec §5-ből, szó szerint)

- **NEM vezetünk be backend Clock-beant.** Ha egy fix ezt kívánná: ÁLLJ MEG és írd le, miért.
- **NEM vezetünk be közös FE óra-fagyasztó harnesst.** Az inline `vi.useFakeTimers({toFake:['Date']})` + `setSystemTime`, illetve az injektált mock-now (`MOCK_NOW_HHMM`, `timelineHooks.ts:39`) a minta.
- **FE plafon csak config-szinten** (`frontend/vite.config.ts:78-79` — `testTimeout/hookTimeout: 20_000`); per-teszt override csak ott, ahol MÁR van explicit override, és akkor is a config-plafon alatt marad.
- **Bizonyítási protokoll (§6) kötelező minden fixre:** a hiba mellett determinisztikusan BUKIK, nélküle ZÖLD; napszak-függő esetnél a repo `LlmCallListMidnightIT` mintája (offset-zóna `@DynamicPropertySource`-szal, hogy "most" mindig 00:0x legyen) vagy `TZ` env; a bizonyíték a bd-kommentbe ÉS a PR-bodyba kerül.
- **Gate-ek:** fókuszált BE teszt `-Dmezo.test.use-testcontainers=true`-val, mindig `clean`; `ArchitectureTest` külön; FE mindkét mód EXPLICIT (`VITE_USE_MOCK=true` és `=false`) + `pnpm build`. Új fájl → `node scripts/gen-codemap.mjs`; viselkedés-változás → `docs/features/<domain>.md` + `node scripts/lint-docs.mjs`.
- **Házirend:** egy szelet = egy worktree = egy branch = egy self-PR; **CI-zöldig visszük, de NEM mergelünk** — a PR nyitva marad.
- Commit-subject konvenció: `fix(scope): ... (mezo-xxxx)`.

---

## A szelet-vágás ellenőrzése (2026-09-05, `origin/main` = 17e07129d)

| Állítás az issue-ban | Ellenőrzés eredménye |
|---|---|
| mezo-pk63: „12 tesztfájl" | **15 fájl** — a leírás 15 nevet sorol (a cím 12-t mond). Mind a 15 létezik, mind tartalmaz teszt-oldali `LocalDate.now()`-t. A cím pontatlan, a lista jó. |
| `MealServiceIT:257` | Igaz, de a hívás `LocalDate.now(ZoneOffset.UTC)` (nem zero-arg) — ugyanaz a dupla-now mechanizmus. |
| `LlmUsageBreakdownIT:41` | Igaz: `assertThat(body.getFrom()).isEqualTo(LocalDate.now(Europe/Budapest))` — a szerver a saját `reportZone`-os now()-jával számol. **Van rá kész minta**: `LlmCallListMidnightIT` (`@DynamicPropertySource` + offset-zóna). |
| mezo-ned9: két hívóhely | **Három**: `ChallengeGenerator:190`, `ExperimentProposalGenerator:154` **és `WeeklySuggestionGenerator:109`** — mindhárom zero-arg `LocalDate.now()`-t ad a `contextSnapshotAssembler.render`-nek. Ugyanaz a mechanizmus → egy szeletben. |
| mezo-ojpr: néma null | Igaz (`AbstractIntegrationTest.java:133-135`); a bean (`LlmLogAsyncConfig:41`) **feltétel nélküli**, deklarált típusa `Executor`, a mező `ThreadPoolTaskExecutor`. |
| mezo-4jtz / mezo-418z: FE | Mind a 4 hely igaz: `useDayOrbFill.test.tsx` (describe-szintű `todayIdx()` + `localDateString(new Date())`), `useDayOrbFill.restDay.test.tsx:23-27` (`vi.hoisted` `new Date()`), `SleepLogSheet.test.tsx:125`, `MezoMessagesSheet.test.tsx:141` (`{timeout:1000}` vs `EXIT_MS+80 = 380 ms`, `Sheet.tsx:21,64`). Kis diff → **egy szelet**. |

---

## S1 — mezo-pk63: BE dupla-now, 15 tesztfájl

**Branch:** `fix/be-double-now-assert` · **Worktree:** friss `origin/main`-ből.

**A fix-minta (EGYSZER eldöntve, mind a 15 fájlra):**

> **Before/after fogás mindenütt, ahol az összevetett érték a SZERVER saját órájából származik**; ahol a hasonlítás mindkét oldala teszt-oldali, ott a `today`-t **egyetlen lokálisba emeljük és újrahasználjuk** (ez ugyanannak a mintának a degenerált esete, ahol `before == after` konstrukcióból).

Indoklás egy mondatban a PR-be: *a szerver órájába nem nyúlunk (nincs Clock-bean, spec §5), ezért a teszt a hívás köré fogja be a saját olvasásait, és a `{before, after}` halmazba engedi az eredményt — ez éjfélen is determinisztikus, miközben megőrzi az assert erejét (a „tegnapot bélyegez" és a „fix dátumot bélyegez" hiba továbbra is bukik).*

Kódminta (BE, AssertJ):

```java
// server-stamped value
LocalDate dayBefore = LocalDate.now();
GratitudeResponse resp = postForBody(URI, req, ownerAuthHeaders(), HttpStatus.CREATED, GratitudeResponse.class);
LocalDate dayAfter = LocalDate.now();
assertThat(resp.getOccurredOn()).isIn(dayBefore, dayAfter);
```

```java
// both sides test-owned: hoist once
LocalDate today = LocalDate.now();
gamificationPopulator.profile(owner, 0, 3, 0, today.minusDays(5));
assertThat(coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, today)).hasSize(1);
```

**Files (mind `backend/src/test/java/io/mrkuhne/mezo/feature/`):**
- Modify: `gamification/GamificationStreakIT.java` (:48,60,79,94,104,107,115,129)
- Modify: `journal/GratitudeApiIT.java` (:38,111) · `journal/DecisionApiIT.java` (:51,53) · `journal/JournalApiIT.java` (:48,108,121,128)
- Modify: `train/SportContractIT.java` (:65,78,102) · `train/SportServiceIT.java` (:109) · `train/CrossDayWorkoutIT.java` (:36,42,80,123,148)
- Modify: `meal/MealServiceIT.java` (:257 — `LocalDate.now(ZoneOffset.UTC)` marad a zóna, csak before/after fogás)
- Modify: `proactive/ProactiveApiFeedIT.java` (:64,66,74,90-92,106-107,118,128,142,158,196) · `proactive/controller/DiagnosisExperimentIT.java` (:54)
- Modify: `companion/CompanionPatternMonitorApiIT.java` (:73,88,117,181,195,282) · `companion/controller/MeWeekTrendIT.java` (:65 `weeksAgo` — hétfő-éjfél él)
- Modify: `character/CharacterRunLogIT.java` (:167,170) · `needs/NeedsApiIT.java` (:39-145) · `llmlog/controller/LlmUsageBreakdownIT.java` (:41,133)
- Create: `llmlog/controller/LlmUsageBreakdownMidnightIT.java` (a `LlmCallListMidnightIT` mintájára)

- [ ] **Step 1: Reprodukció — a `TZ`-eltolt futás bukása.** A javítás ELŐTT futtasd a fókuszált halmazt éjfél-közeli szimulált napszakban (a `LlmCallListMidnightIT` `computeJustPastMidnightZoneId()` trükkje `TZ` env-ként: a JVM default zónáját olyan offsetre állítod, ahol „most" 23:59:5x). Rögzítsd, melyik teszt bukik.
- [ ] **Step 2: `LlmUsageBreakdownMidnightIT` megírása** (`@DynamicPropertySource` → `mezo.llm-log.report-zone` = a 00:0x zóna), futtatás → BUKIK a jelenlegi `:41` assert mellett.
- [ ] **Step 3: A 15 fájl átírása** a fenti mintával, fájlonként külön commit NEM kell, de a commit-üzenet törzse SOROLJA FEL mind a 15 fájlt.
- [ ] **Step 4: Gate.** `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='GamificationStreakIT,GratitudeApiIT,DecisionApiIT,JournalApiIT,SportContractIT,SportServiceIT,MealServiceIT,ProactiveApiFeedIT,DiagnosisExperimentIT,CompanionPatternMonitorApiIT,CharacterRunLogIT,NeedsApiIT,LlmUsageBreakdownIT,LlmUsageBreakdownMidnightIT,MeWeekTrendIT,CrossDayWorkoutIT' -DfailIfNoSpecifiedTests=false` — zöld. Utána UGYANEZ a Step 1 szerinti eltolt zónában — zöld. Legalább 3 szimulált napszak (00:0x, délután, 23:5x).
- [ ] **Step 5: ArchUnit + CODEMAP.** `./mvnw clean test -Dtest=ArchitectureTest`; új fájl miatt `node scripts/gen-codemap.mjs`.
- [ ] **Step 6: Commit + push + self-PR** a bizonyítékkal a bodyban; bd-komment mezo-pk63-ra. PR NYITVA marad.

---

## S2 — mezo-ned9: medication ciklusnap-zóna (PROD viselkedés-változás)

**Branch:** `fix/context-snapshot-owner-zone`.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ChallengeGenerator.java:190`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ExperimentProposalGenerator.java:154`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionGenerator.java:109`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/MedicationCycleService.java:28-38` (a javadoc kimondja, hogy a follow-up NEM egységesített — ezt frissíteni kell)
- Modify: `docs/features/<a medication/proactive doc>.md` (a `key_files` szerinti gazda-doc) — viselkedés-változás
- Test: új/bővített IT a `proactive` alatt, amely a zóna-eltolást bizonyítja

**Fix:** a három hívóhelyen `LocalDate.now()` → `LocalDate.now(MedicationCycleService.MEDICATION_ZONE)`.

- [ ] **Step 1: ArchUnit-ellenőrzés ELŐSZÖR.** Igazold, hogy a `proactive` feature importálhatja a `medication` feature konstansát (precedens: `companion/tools/MedicationTools` már importálja a `MedicationCycleService`-t). Ha az ArchUnit tiltja, ÁLLJ MEG és jelentsd — ne vezess be új közös helpert a spec §5 szellemében kérdés nélkül.
- [ ] **Step 2: Bukó teszt.** Olyan IT, amely a JVM default zónáját UTC-re, a medication-zónát Budapestre szimulálva a `render(...)` medication-blokkjának ciklusnapját veti össze a `deriveToday`-ével a két éjfél közti sávban (a `LlmCallListMidnightIT` offset-trükkjével előállítva). Futtatás → BUKIK.
- [ ] **Step 3: A három hívóhely javítása + a `MedicationCycleService` javadoc frissítése** (a „NOT yet unified" mondat cseréje).
- [ ] **Step 4: Gate.** Fókuszált BE teszt Testcontainersszel (az új IT + `MedicationCycleServiceIT`/`CompanionToolsRenderIT` + a három generátor ITjei) → zöld; `ArchitectureTest` külön.
- [ ] **Step 5: Docs.** Feature-doc frissítés + `node scripts/lint-docs.mjs`; új teszt-fájl → `node scripts/gen-codemap.mjs`.
- [ ] **Step 6: Commit + push + self-PR + bd-komment.** PR NYITVA.

---

## S3 — mezo-ojpr: drain wiring-assert

**Branch:** `fix/drain-wiring-assert`.

**Files:** Modify `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java:123-172`.

**Fix:** a `drainAsyncWork()` némán ne fogadjon el hiányzó `llmLogExecutor`-t. A bean (`LlmLogAsyncConfig`) feltétel nélküli, tehát a drain-nek MINDIG lennie kell — a `null` konfigurációs regresszió, nem érvényes állapot.

```java
private void drainAsyncWork() {
    if (llmLogExecutor == null) {
        throw new IllegalStateException(
            "llmLogExecutor did not inject — LlmLogAsyncConfig's bean name/type/defaultCandidate "
                + "changed and the LLM-log pool would silently stop draining before the TRUNCATE "
                + "(mezo-ojpr; the hole mezo-oou9/PR #473 closed)");
    }
    ...
}
```

- [ ] **Step 1: Reprodukció.** Ideiglenesen nevezd át a `@Qualifier("llmLogExecutor")`-t (vagy a bean nevét) → egy tetszőleges IT a JELENLEGI kóddal ZÖLDEN fut (ez a néma lyuk), az ÚJ kóddal hangosan bukik a fenti üzenettel. Rögzítsd mindkét kimenetet, majd állítsd vissza.
- [ ] **Step 2: A guard beírása** + a meglévő `mezo-oou9` javadoc kiegészítése egy mondattal.
- [ ] **Step 3: Gate.** Két-három reprezentatív IT Testcontainersszel (egy `llmlog`-os + egy `companion`-os) → zöld; `ArchitectureTest` külön.
- [ ] **Step 4: Commit + push + self-PR + bd-komment.** PR NYITVA.

---

## S4 — mezo-4jtz + mezo-418z: FE fali-óra + waitFor-budget

**Branch:** `fix/fe-wallclock-and-waitfor`.

**Files:**
- Modify: `frontend/src/features/today/logic/useDayOrbFill.test.tsx` (a describe-szintű `todayIdx()` / `localDateString(new Date())` páros)
- Modify: `frontend/src/features/today/logic/useDayOrbFill.restDay.test.tsx:23-27` (`vi.hoisted` `new Date()`)
- Modify: `frontend/src/features/me/sheets/SleepLogSheet.test.tsx:125`
- Modify: `frontend/src/features/today/components/MezoMessagesSheet.test.tsx:141`

**Fix-irányok:**
- `useDayOrbFill*`: a `useMinuteTick` modul-szintű óra-capture miatt a `Date` nem fake-elhető → **before/after fogás** (a nap ISO-ját a render ELŐTT és UTÁN is kiolvasva, és a hook kimenetét a `{before, after}` halmazhoz kötve), VAGY a hook által kiírt értékkel való összevetés. Ha egyik sem elég, mérlegeld az injektált órát (`MOCK_NOW` minta, `timelineHooks.ts:39`) — **de közös harnesst NE hozz létre**.
- `SleepLogSheet:125`: a második, teszt-oldali `new Date()` helyett a komponens által kiírt értékkel/be-fogott ablakkal vess össze (a `.not.toBe('2026-01-15')` diszkriminátor MARADJON — az bizonyítja, hogy a manuális ág futott).
- `MezoMessagesSheet:141`: az explicit `{timeout: 1000}` → `{timeout: 3000}` (a valós 380 ms-os `Sheet.tsx` fallbackra ~8× tartalék, és a 20 s-os config-plafon alatt marad), VAGY fake timer + `advanceTimersByTime`.

- [ ] **Step 1: Reprodukció.** `useDayOrbFill*` + `SleepLogSheet`: `TZ`/rendszeróra-szimulációval (éjfél előtti utolsó másodpercek) mutasd meg a bukást a jelenlegi kóddal. `MezoMessagesSheet`: CPU-stressz alatt (párhuzamos terhelés) vagy a `Sheet` fallback-idejének ideiglenes felnyomásával mutasd meg, hogy az 1000 ms-os budget kifut.
- [ ] **Step 2: A négy fájl javítása.**
- [ ] **Step 3: Gate — MINDKÉT mód EXPLICIT.** `cd frontend && VITE_USE_MOCK=false pnpm test` és `VITE_USE_MOCK=true pnpm test` (a teljes suite, nem csak a 4 fájl) + `pnpm build`. Utána a Step 1 szerinti szimulált napszakban is a 4 érintett fájl (legalább 3 napszak).
- [ ] **Step 4: Commit + push + self-PR + bd-komment mindkét issue-ra.** PR NYITVA.

---

## S5 — mezo-c9k4 értékelés (NEM automatikus végrehajtás)

- [ ] **Step 1: Cross-check a merge utáni fán.** Sorold össze a `@Scheduled` jobok kill-switch kulcsait (`mezo.techcore.cron.*.enabled`, `SchedulingConfiguration`) és vesd össze a `backend/src/test/resources/application.properties` 10 letiltott sorával. Készíts listát: melyik fix hajnali (02:00–06:50) anchorú cron marad ÉLESEN a teszt-profilban.
- [ ] **Step 2: Döntés.** Ha a lista tartalmaz hajnali anchorú, DB-t író jobot → érdemes megcsinálni (a `*JobIT`-k `@TestPropertySource` re-enable-jével ELŐSZÖR, csak utána bővül a globális tiltás). Ha nem → **hagyd nyitva**, és írj indokolt bd-kommentet mezo-c9k4-re a konkrét listával.

---

## Self-review

- **Spec-fedés:** mind a hat issue kap szeletet vagy indokolt halasztást; a spec §5 három döntése a Global Constraints-ben szó szerint szerepel; a §6 bizonyítási protokoll minden szelet Step 1-jében konkrét parancs/technika.
- **Placeholder-ellenőrzés:** nincs „TBD"/„megfelelő hibakezelés" — minden fix-irány kódmintával vagy konkrét fájl:sor hivatkozással áll.
- **Típus-konzisztencia:** a `{before, after}` fogás mindenütt `LocalDate` + AssertJ `isIn(...)`; a FE-oldali megfelelője az ISO-string halmaz.
