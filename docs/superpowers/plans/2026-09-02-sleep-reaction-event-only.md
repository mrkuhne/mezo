# Alvás-reakció: kizárólag esemény-vezérelt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az 05:45-ös hajnali cron ne generáljon többé alvás-reakció üzenetet; az alvás-reakció kizárólag akkor szülessen, amikor a felhasználó ténylegesen elment egy alvás-logot.

**Architecture:** Egyetlen hívás törlése `CompanionMessageJob.runMorning()`-ból. Az alvás-reakció innentől tiszta event-kind: az egyetlen útja `CompanionMessageEventListener.onSleepLogged` (`@Async`, `@TransactionalEventListener(AFTER_COMMIT)` a `SleepLogSavedEvent`-en). A generátor, a listener, az `AnchorResolver` és a konfiguráció változatlan.

**Tech Stack:** Java 21, Spring Boot, JUnit 5 + AssertJ, Testcontainers (PostgreSQL), Maven.

**Spec:** [`docs/superpowers/specs/2026-09-02-sleep-reaction-event-only-design.md`](../specs/2026-09-02-sleep-reaction-event-only-design.md) · **bd:** `mezo-qn3z`

## Global Constraints

- Conventional commit subject a bd id-vel: `fix(proactive): … (mezo-qn3z)`.
- A `CompanionMessageGenerator`, a `CompanionMessageEventListener`, az `AnchorResolver` és az `application.yml` **nem** módosul. A `generateSleepReaction` `>= today - 1` frissesség-kapuja marad.
- Fókuszált backend teszt Testcontainers módban fut (a fix-DB mód versenyhelyzetet és hamis bukást produkál).
- A `docs/features/proactive.md` frissítése ugyanannak a taskn ak a része (docs mandate).

---

### Task 1: A hajnali cron nem generál alvás-reakciót

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java` (osztály-javadoc + `runMorning()`)
- Modify: `docs/features/proactive.md` (3 hely: `generateSleepReaction` leírás, `CompanionMessageJob` leírás, képesség-tábla `Crons` sora)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageJobIT.java`

**Interfaces:**
- Consumes: `CompanionMessageJob.runMorning()` (public, void); `CompanionMessageRepository.findByCreatedByAndMessageDateAndKind(UUID, LocalDate, String) : Optional<CompanionMessageEntity>`; `CompanionMessageEntity.KIND_MORNING` / `KIND_SLEEP`; a teszt-populátorok `sleepLogPopulator.createSleepLog(UUID, LocalDate, BigDecimal, int)` és `dailySummaryPopulator.summary(UUID, LocalDate, String)`.
- Produces: nincs új publikus felület. `CompanionMessageGenerator.generateSleepReaction(UUID, LocalDate)` továbbra is létezik és publikus — egyetlen hívója a `CompanionMessageEventListener`.

- [ ] **Step 1: Fordítsd meg a meglévő IT-t (a failing test)**

`CompanionMessageJobIT.java`-ban cseréld le a `testRunMorning_shouldAlsoGenerateSleepReaction_whenFreshSleepLogAlreadyExists` tesztet erre:

```java
    @Test
    void testRunMorning_shouldNotGenerateSleepReaction_evenWhenFreshSleepLogExists() {
        UUID user = userPopulator.createUser("feedjob-sleep@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap pihenőnap volt.");
        sleepLogPopulator.createSleepLog(user, LocalDate.now(), new BigDecimal("7.5"), 4);

        companionMessageJob.runMorning();

        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_MORNING))
                .hasValueSatisfying(m -> assertThat(m.getContent().eyebrow()).isEqualTo("Fake reggeli"));
        // Az alvás-reakció event-kind: a hajnali cron ekkor még csak a TEGNAPI éjszakát látná,
        // és azt narrálná mai éjszakaként (mezo-qn3z). Csak a SleepLogSavedEvent szülheti.
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                user, LocalDate.now(), CompanionMessageEntity.KIND_SLEEP)).isEmpty();
    }
```

Frissítsd az osztály-javadoc mondatát is (`runMorning additionally fires the sleep …`) erre: `runMorning generates the morning message only — the sleep reaction is event-kind (mezo-qn3z), asserted absent here.`

- [ ] **Step 2: Futtasd — buknia kell**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMessageJobIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Elvárt: `testRunMorning_shouldNotGenerateSleepReaction_evenWhenFreshSleepLogExists` FAIL — `Expecting Optional to be empty but was containing …` (a cron még generálja az alvás-sort).

- [ ] **Step 3: Töröld a cron-ágat**

`CompanionMessageJob.runMorning()`-ból töröld ezt a blokkot:

```java
            try {
                companionMessageGenerator.generateSleepReaction(user.getId(), today);
            } catch (Exception e) {
                log.warn("Sleep-reaction pre-generation failed for user {} on {}", user.getId(), today, e);
            }
```

Az osztály-javadoc első mondatát cseréld erre:

```java
/**
 * Companion-feed crons (spec §3): dawn morning generation + the midday nudge + evening closing
 * windows (the PredictionJob multi-methods-one-switch idiom). The sleep reaction is DELIBERATELY
 * not fired here (mezo-qn3z): it is an event-kind, born only from {@code SleepLogSavedEvent} via
 * {@link CompanionMessageEventListener}. At 05:45 tonight's sleep is not logged yet, so the
 * generator's {@code >= today - 1} freshness gate would pick up YESTERDAY's row and the prompt
 * ("Daniel most rögzítette a ma éjszakai alvását") would narrate it as last night — plus a
 * "Mezo · alvás" push at dawn about a night the user already knows. A missed reaction is honest;
 * a wrong one is not. Deliberately TODAY only, no backfill — the lazy GET covers a missed run.
 * Idempotent (generate returns an existing row untouched); per-user failures are isolated so one
 * bad user never kills the run.
 */
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionMessageJobIT,CompanionMessageGeneratorIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Elvárt: PASS mindkét osztályra. A `CompanionMessageGeneratorIT` négy `generateSleepReaction` tesztje változatlanul zöld (a generátor nem módosult).

- [ ] **Step 5: Dokumentáció**

`docs/features/proactive.md` három helye:

1. A `generateSleepReaction` felsorolás-pont: a *„fired by a fresh sleep log (event OR the morning cron, whichever comes first — see below)"* helyett: *„fired ONLY by a fresh sleep log's `SleepLogSavedEvent` — never by a cron (mezo-qn3z; see `CompanionMessageJob`)"*. A gate-mondat (`>= today - 1`, backfill soha) marad.
2. A `CompanionMessageJob` bekezdés: a *„`runMorning` (05:45, `feed.morning-cron`) generates the morning message AND, right after, calls `generateSleepReaction` for every user — covering the case where sleep was logged BEFORE the cron fires (spec §5's »cron előtt logolt alvás«)"* mondat helyére: `runMorning` csak a reggeli üzenetet (+ a people-observation ágat) generálja; az alvás-reakció szándékosan kimarad (mezo-qn3z), mert 05:45-kor a mai éjszaka még nincs logolva, így a tegnapit narrálná mai éjszakaként — a „cron előtt logolt alvás" esetet az `AFTER_COMMIT` listener már a logolás pillanatában lefedi.
3. A képesség-tábla `Crons (dawn + midday + evening pre-generation)` sora: hagyd el a *„`runMorning` (05:45) also triggers `generateSleepReaction` right after (covers sleep logged before the cron)"* tagmondatot, helyette: *„`runMorning` (05:45) generates the morning message only — the sleep reaction is event-kind (mezo-qn3z)"*.

Ha a §9 (retired mechanisms) szakaszban a sleep-regen bekezdés a cron-ágra hivatkozik, ott is igazítsd — a lényeg (az event-triggered generálás váltotta ki a regent) változatlan.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageJobIT.java docs/features/proactive.md
git commit -m "fix(proactive): alvás-reakció csak esemény-vezérelt, ki a hajnali cronból (mezo-qn3z)"
```

- [ ] **Step 7: CODEMAP + docs lint**

A fókuszált ITek nem futtatják a CI docs-kapuit. Futtasd őket lokálban, mert a
`docs/features/proactive.md` módosult:

```bash
node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only
```

Ha a codemap-check bukik, regeneráld (`node scripts/gen-codemap.mjs`) és tedd ugyanebbe a
branchbe: `git add docs/CODEMAP.md && git commit --amend --no-edit`. Kontraktus-artefaktok
(`api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`) nem érintettek — a változás nem nyúl
egyetlen REST felülethez sem.

---

## Verification

- [ ] `CompanionMessageJobIT` + `CompanionMessageGeneratorIT` zöld Testcontainers módban.
- [ ] `grep -rn "generateSleepReaction" backend/src/main` egyetlen hívót ad: `CompanionMessageEventListener`.
- [ ] `node scripts/gen-codemap.mjs --check` és `node scripts/lint-docs.mjs --errors-only` hibátlan.
- [ ] `git status` tiszta; a branch pusholva, self-PR nyitva, CI zöld a merge előtt.
