# lifegoal 3b: companion [Célok] blokk + get_life_goals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A companion megismeri az életcélokat: [Célok] blokk a kontextus-pillanatképben (chat + reggeli) egy új `LifeGoalSource` porton át, plusz `get_life_goals` chat-tool gazdag per-cél részletekkel. (bd mezo-iizd.10; spec: `docs/superpowers/specs/2026-09-05-lifegoal-companion-block-design.md`)

**Architecture:** Port a companion gyökerében (`TodayQuestSource` minta), adapter a lifegoal-ban (`MetricSignalSource` tükörképe), blokk a `PeopleSnapshotBlock` sablonján, tool a `GoalTools` sablonján — de a tool a porton renderel, mert companion→lifegoal import ArchUnit-ciklust zárna.

**Tech Stack:** Spring Boot, Spring AI `@Tool`, JUnit5 + AssertJ + Testcontainers IT-k, Vitest (FE tükrök).

## Global Constraints

- Companion-oldali fájl SOHA nem importál `feature.lifegoal` típust (ArchUnit `feature_slices_are_cycle_free` — csak a teljes `./mvnw test` / CI fogja el).
- A blokk read-only: semmilyen hívás nem írhat (nincs emit, nincs `@Transactional` writer-út).
- `LocalDate.now()` TILOS a blokk/adapter útvonalon — a `today` mindenhol paraméter (determinizmus-IT: két render `equals`).
- Minden prompt-szöveg magyar; hiány = őszinte „nincs adat" / „nincs aktív életcél", soha nem 0; nyíl szóként, nem glifaként.
- Fókuszált IT-k: `-Dmezo.test.use-testcontainers=true` KÖTELEZŐ (a fix-DB mód hamisan bukik).
- Commit-formátum: `feat(companion): … (mezo-iizd.10)`; minden commit végén `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- FE-t érintő változás után FE tesztek MINDKÉT módban (`VITE_USE_MOCK` unset = mock!) + `pnpm build`.
- Codemap: új fájlok után `node scripts/gen-codemap.mjs` ugyanabban a change-ben.

---

### Task 1: `LifeGoalSource` port + dátum-paraméteres `today` overload

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalSource.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java:127-136`

**Interfaces:**
- Produces: a `LifeGoalSource` interface (lent, szó szerint) — a Task 2 adapter implementálja, a Task 3 blokk és a Task 5 tool fogyasztja `ObjectProvider<LifeGoalSource>`-on át.
- Produces: `LifeGoalProgressService.today(UUID userId, LocalDate today)` — a meglévő `today(UUID)` delegál rá `LocalDate.now()`-val.

- [ ] **Step 1: Port interface megírása**

```java
package io.mrkuhne.mezo.feature.companion;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Port a [Célok] snapshot-blokkhoz és a get_life_goals toolhoz (mezo-iizd.10): a companion csak
 * annyit tud, hogy „mik az aktív életcélok és hogy állnak" — a HOGYAN a feature/lifegoal dolga,
 * amely implementálja ({@code lifegoal/service/LifeGoalCompanionAdapter}). Az irány lifegoal →
 * companion marad (a lifegoal már függ a companiontól: MetricSignalSource, LifeGoalProposePort —
 * a fordított import 2-szeletes ciklust zárna, feature_slices_are_cycle_free). A bean csak
 * LIFEGOAL_SWITCH mellett létezik; ObjectProvider-rel fogyasztd — hiányzó bean „nincs adat",
 * sosem kitalált cél. A ha–akkor NUDGE a LifeGoalTriggerService feed-értesítéséé (dedupKey
 * goalId:planKey:day) — az itteni „ma él" tény-állítás, nem második nudge-csatorna.
 */
public interface LifeGoalSource {

    /** A [Célok] blokk tömör összefoglalója. Arrow/dimension NYERS kulcsként (up|flat|down|
     *  insufficient; positive_emotion|…|health) — a magyar szót a renderelő adja. */
    record Summary(List<GoalLine> goals, String weakestPillar, List<String> livePlans) {}

    record GoalLine(String title, String dimension, String arrow, int pillarsHitToday, int pillarsTotal) {}

    /** A get_life_goals tool gazdag nézete — célonként pillérek + tervek. */
    record Details(List<GoalDetail> goals) {}

    record GoalDetail(String title, String dimension, String frame, String arrow,
                      Integer weekPercent, List<PillarLine> pillars, List<PlanLine> plans) {}

    /** {@code hitToday} null = ma nincs adat a pillérre; {@code arrow} a pillér heti nyila. */
    record PillarLine(String label, String kind, Boolean hitToday, String arrow) {}

    record PlanLine(String ha, String akkor, boolean liveToday) {}

    Summary summary(UUID userId, LocalDate today);

    Details details(UUID userId, LocalDate today);
}
```

- [ ] **Step 2: `today` overload a `LifeGoalProgressService`-ben**

A meglévő `today(UUID userId)` (128. sor) törzsét vidd át az új overloadba; a régi delegál:

```java
    /** Aktív célonként: nyíl + 7 napi cél-pont-pötty + mai pillér-számláló. */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse today(UUID userId) {
        return today(userId, LocalDate.now());
    }

    /** Dátum-paraméteres változat (mezo-iizd.10): a companion-snapshot determinizmusa miatt a
     *  hívó mondja meg, mi a „ma" — a HTTP-út a fenti overloadon át változatlan. */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse today(UUID userId, LocalDate today) {
        LocalDate from = today.minusDays(PROGRESS_WINDOW_DAYS - 1);
        // ... a meglévő törzs változatlanul (activeGoals szűrés + buildTodaySummary) ...
    }
```

- [ ] **Step 3: Fordítás + meglévő lifegoal-tesztek zöldek**

Run: `cd backend && ./mvnw test -Dtest='LifeGoal*' -Dmezo.test.use-testcontainers=true`
Expected: PASS (tiszta refaktor + új interface, viselkedés nem változott)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalSource.java backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java
git commit -m "feat(companion): LifeGoalSource port + datumos today overload (mezo-iizd.10)"
```

---

### Task 2: `LifeGoalCompanionAdapter` a lifegoal-ban + IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalCompanionAdapter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalCompanionAdapterIT.java`

**Interfaces:**
- Consumes: Task 1 `LifeGoalSource` + `LifeGoalProgressService.today(userId, today)` és a meglévő `progress(userId, goalId, from, to)`.
- Produces: `@Component` bean, amit a Task 3 blokk és Task 5 tool `ObjectProvider<LifeGoalSource>`-on át kap.

**Kulcsdöntések (a specből):**
- „Ma élő" terv = a trigger predikátuma áll a mai napra, a `LifeGoalTriggerRules` PURE függvényeivel, EMIT NÉLKÜL. Kivétel a `ritual_missed`: az hiány-alapú, ma reggel mindig „hiányozna" — azt a legutóbbi LEZÁRT napra (`today.minusDays(1)`) értékeljük, ÉS csak akkor, ha a rituálé adoptált (az elmúlt `RITUAL_ADOPTION_WINDOW_DAYS` napban volt lezárt nap — a `LifeGoalTriggerService.ritualAdopted` logikájának másolata, az privát).
- Alvó jel (nincs `SignalSource` bean a forrásra) → a terv KIMARAD (a trigger-service precedense).
- Leggyengébb pillér: az összes aktív cél összes aktív pillére közül a legkevesebb hit-napú az elmúlt 7 napban (a `progress()` `PillarProgress.days` status-aiból); a csupa `no_data` pillér nem játszik; döntetlennél label szerint ábécében első; ha egy sem játszik → `null`.

- [ ] **Step 1: Failing IT megírása**

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** mezo-iizd.10: a companion-port lifegoal-oldali adaptere — read-only, sosem emittál. */
@Transactional
class LifeGoalCompanionAdapterIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalSource adapter;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private LifeGoalRepository goalRepository;
    @Autowired private AppNotificationRepository notificationRepository;

    @Test
    void testSummary_shouldListActiveGoalsAndWeakestPillar_whenPillarDaysExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity sleep = lifeGoalPopulator.sleepPillar(goal);
        // 3 hit-nap a héten a pillérre — van adat, tehát a leggyengébb ő (egyetlenként)
        lifeGoalPopulator.pillarDay(sleep, today.minusDays(1), "hit");
        lifeGoalPopulator.pillarDay(sleep, today.minusDays(2), "miss");
        lifeGoalPopulator.pillarDay(sleep, today.minusDays(3), "hit");

        LifeGoalSource.Summary summary = adapter.summary(owner, today);

        assertThat(summary.goals()).hasSize(1);
        assertThat(summary.goals().getFirst().title()).isEqualTo("Kockahas");
        assertThat(summary.goals().getFirst().dimension()).isEqualTo("health");
        assertThat(summary.weakestPillar()).isEqualTo("Alvás");
    }

    @Test
    void testSummary_shouldExcludeDraftAndParkedGoals_whenMixedStatuses() {
        UUID owner = userPopulator.createUser().getId();
        lifeGoalPopulator.goal(owner, "draft");
        lifeGoalPopulator.goal(owner, "parked");

        LifeGoalSource.Summary summary = adapter.summary(owner, LocalDate.now());

        assertThat(summary.goals()).isEmpty();
        assertThat(summary.weakestPillar()).isNull();
        assertThat(summary.livePlans()).isEmpty();
    }

    @Test
    void testSummary_shouldMarkPlanLive_andNeverEmit_whenEnergyTriggerMatchesToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        goal.setIfThenPlans(List.of(new IfThenPlanJson(
            "ha az energiám 4 alatt van", "akkor 10 perc séta",
            new PlanTriggerJson("checkin_energy_lte", "4", null))));
        goalRepository.saveAndFlush(goal);
        checkInPopulator.createCheckIn(owner, today, 3, 5); // energia 3 ≤ 4 → él

        LifeGoalSource.Summary summary = adapter.summary(owner, today);

        assertThat(summary.livePlans()).containsExactly("ha az energiám 4 alatt van, akkor 10 perc séta");
        // a blokk KONTEXTUS: az adapter sosem emittál (a nudge a LifeGoalTriggerService-é)
        assertThat(notificationRepository.findAll()).isEmpty();
    }

    @Test
    void testDetails_shouldCarryPillarsAndPlans_whenGoalHasBoth() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.sleepPillar(goal);
        goal.setIfThenPlans(List.of(new IfThenPlanJson(
            "ha este képernyő", "akkor olvasás", null))); // kézi terv — sosem "él" gépileg
        goalRepository.saveAndFlush(goal);

        LifeGoalSource.Details details = adapter.details(owner, today);

        assertThat(details.goals()).hasSize(1);
        LifeGoalSource.GoalDetail d = details.goals().getFirst();
        assertThat(d.title()).isEqualTo("Kockahas");
        assertThat(d.frame()).isEqualTo("intrinsic");
        assertThat(d.pillars()).singleElement().satisfies(p -> {
            assertThat(p.label()).isEqualTo("Alvás");
            assertThat(p.kind()).isEqualTo("average");
        });
        assertThat(d.plans()).singleElement().satisfies(p -> {
            assertThat(p.ha()).isEqualTo("ha este képernyő");
            assertThat(p.liveToday()).isFalse();
        });
    }
}
```

Megjegyzések az implementálónak:
- `PlanTriggerJson` konstruktor-alakját ellenőrizd (`source`, `condition`, `delayHours` sorrend) — a fenti hívást igazítsd hozzá.
- `CheckInPopulator.createCheckIn` szignatúráját ellenőrizd (owner, date, energy, stress a szokás); ha más, igazíts.
- Ha a lifegoal switch defaultból nincs bekapcsolva a teszt-yml-ben, nézd meg, a meglévő lifegoal IT-k hogyan kapcsolják (valószínűleg default on — a `LifeGoalPopulator`-os IT-k már futnak nélküle is).

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd backend && ./mvnw test -Dtest=LifeGoalCompanionAdapterIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `No qualifying bean of type LifeGoalSource`

- [ ] **Step 3: Adapter implementálása**

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalProgressResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalTodaySummary;
import io.mrkuhne.mezo.api.dto.PillarDayEntry;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.api.dto.PillarProgress;
import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * A companion {@link LifeGoalSource} portjának lifegoal-oldali adaptere (mezo-iizd.10) — a
 * {@code MetricSignalSource} tükörképe: ott a lifegoal olvas companion-adatot, itt a companion
 * olvas lifegoal-adatot, az irány mindkétszer lifegoal → companion. SZIGORÚAN read-only: a
 * „ma él" a {@link LifeGoalTriggerRules} pure predikátumainak újrafuttatása EMIT NÉLKÜL — a
 * nudge (és a dedup) a {@link LifeGoalTriggerService}-é; ez a felület tény-állítás a prompthoz.
 *
 * <p>ritual_missed: hiány-alapú jel, a MA reggel mindig „hiányozna" — az utolsó LEZÁRT napra
 * (tegnap) értékeljük, és csak adoptált rituálé mellett (14 napos ablak, a trigger-service F4
 * kapujának mása). Alvó jel (nincs kiszolgáló SignalSource bean) → a terv kimarad, nem tippelünk.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalCompanionAdapter implements LifeGoalSource {

    private static final String STATUS_ACTIVE = "active";
    private static final int WEEK_DAYS = 7;

    private final LifeGoalProgressService progressService;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;
    private final List<SignalSource> sources;

    @Override
    @Transactional(readOnly = true)
    public Summary summary(UUID userId, LocalDate today) {
        List<LifeGoalTodaySummary> todayGoals = progressService.today(userId, today).getGoals();
        List<GoalLine> lines = todayGoals.stream()
            .map(g -> new GoalLine(g.getTitle(),
                g.getDimension() == null ? null : g.getDimension().getValue(),
                g.getArrow() == null ? null : g.getArrow().getValue(),
                g.getPillarsHitToday() == null ? 0 : g.getPillarsHitToday(),
                g.getPillarsTotal() == null ? 0 : g.getPillarsTotal()))
            .toList();
        return new Summary(lines, weakestPillar(userId, today), livePlans(userId, today));
    }

    @Override
    @Transactional(readOnly = true)
    public Details details(UUID userId, LocalDate today) {
        List<GoalDetail> details = new ArrayList<>();
        for (LifeGoalEntity goal : activeGoals(userId)) {
            LifeGoalProgressResponse progress = progressService.progress(
                userId, goal.getId(), today.minusDays(WEEK_DAYS - 1L), today);
            Map<UUID, LifeGoalPillarEntity> pillarsById = activePillars(goal.getId()).stream()
                .collect(java.util.stream.Collectors.toMap(LifeGoalPillarEntity::getId, p -> p));
            List<PillarLine> pillars = progress.getPillars().stream()
                .map(p -> pillarLine(p, pillarsById.get(p.getPillarId()), today))
                .filter(java.util.Objects::nonNull)
                .toList();
            List<PlanLine> plans = plansOf(goal).stream()
                .map(plan -> new PlanLine(plan.ha(), plan.akkor(), isLiveToday(userId, plan, today)))
                .toList();
            details.add(new GoalDetail(goal.getTitle(), goal.getDimension(), goal.getFrame(),
                progress.getArrow() == null ? null : progress.getArrow().getValue(),
                progress.getWeeklyPct(), pillars, plans));
        }
        return new Details(details);
    }

    private PillarLine pillarLine(PillarProgress p, LifeGoalPillarEntity entity, LocalDate today) {
        if (entity == null) {
            return null; // közben törölt/deaktivált pillér — nem találunk ki sort
        }
        Boolean hitToday = p.getDays().stream()
            .filter(d -> today.equals(d.getDay())).findFirst()
            .map(d -> d.getStatus() == PillarDayStatus.NO_DATA ? null
                : Boolean.valueOf(d.getStatus() == PillarDayStatus.HIT))
            .orElse(null);
        return new PillarLine(entity.getLabel(), entity.getKind(), hitToday,
            p.getArrow() == null ? null : p.getArrow().getValue());
    }

    /** A legkevesebb hit-napú aktív pillér az elmúlt 7 napból, célokon átívelően; csupa
     *  no_data pillér nem játszik; döntetlen → label ábécé; senki → null. */
    private String weakestPillar(UUID userId, LocalDate today) {
        record Candidate(String label, long hits) {}
        List<Candidate> candidates = new ArrayList<>();
        for (LifeGoalEntity goal : activeGoals(userId)) {
            LifeGoalProgressResponse progress = progressService.progress(
                userId, goal.getId(), today.minusDays(WEEK_DAYS - 1L), today);
            Map<UUID, LifeGoalPillarEntity> pillarsById = activePillars(goal.getId()).stream()
                .collect(java.util.stream.Collectors.toMap(LifeGoalPillarEntity::getId, p -> p));
            for (PillarProgress p : progress.getPillars()) {
                LifeGoalPillarEntity entity = pillarsById.get(p.getPillarId());
                if (entity == null) {
                    continue;
                }
                List<PillarDayEntry> days = p.getDays();
                boolean hasData = days.stream().anyMatch(d -> d.getStatus() != PillarDayStatus.NO_DATA);
                if (!hasData) {
                    continue;
                }
                long hits = days.stream().filter(d -> d.getStatus() == PillarDayStatus.HIT).count();
                candidates.add(new Candidate(entity.getLabel(), hits));
            }
        }
        return candidates.stream()
            .min(Comparator.comparingLong(Candidate::hits).thenComparing(Candidate::label))
            .map(Candidate::label).orElse(null);
    }

    /** „ma él": a trigger predikátuma áll ma — LifeGoalTriggerRules, EMIT NÉLKÜL. */
    private List<String> livePlans(UUID userId, LocalDate today) {
        List<String> live = new ArrayList<>();
        for (LifeGoalEntity goal : activeGoals(userId)) {
            for (IfThenPlanJson plan : plansOf(goal)) {
                if (isLiveToday(userId, plan, today)) {
                    live.add(plan.ha() + ", " + plan.akkor());
                }
            }
        }
        return live;
    }

    private boolean isLiveToday(UUID userId, IfThenPlanJson plan, LocalDate today) {
        PlanTriggerJson trigger = plan == null ? null : plan.trigger();
        if (trigger == null || trigger.source() == null) {
            return false; // kézi terv — nincs gépi jel
        }
        PillarSourceJson signal = LifeGoalTriggerRules.sourceFor(trigger.source()).orElse(null);
        if (signal == null) {
            return false;
        }
        SignalSource source = sources.stream().filter(s -> s.supports(signal)).findFirst().orElse(null);
        if (source == null) {
            return false; // a jel ALSZIK — nem értékelünk (trigger-service precedens)
        }
        LocalDate evalDay = today;
        if (LifeGoalTriggerRules.RITUAL_MISSED.equals(trigger.source())) {
            evalDay = today.minusDays(1); // a hiányt csak lezárt napra lehet kimondani
            LocalDate from = evalDay.minusDays(LifeGoalTriggerRules.RITUAL_ADOPTION_WINDOW_DAYS);
            boolean adopted = source.window(userId, signal, from, evalDay.minusDays(1))
                .values().values().stream().anyMatch(v -> v != null && v.signum() > 0);
            if (!adopted) {
                return false; // nem (vagy már nem) használt rituálé — nem nyaggatjuk (F4 kapu mása)
            }
        }
        BigDecimal value = source.window(userId, signal, evalDay, evalDay).values().get(evalDay);
        return LifeGoalTriggerRules.matches(trigger.source(), trigger.condition(), value);
    }

    private List<LifeGoalEntity> activeGoals(UUID userId) {
        return goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> STATUS_ACTIVE.equals(g.getStatus())).toList();
    }

    private List<LifeGoalPillarEntity> activePillars(UUID goalId) {
        return pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goalId)
            .stream().filter(LifeGoalPillarEntity::isActive).toList();
    }

    private static List<IfThenPlanJson> plansOf(LifeGoalEntity goal) {
        return goal.getIfThenPlans() == null ? List.of() : goal.getIfThenPlans();
    }
}
```

Megjegyzés: a `LifeGoalProgressResponse`/`PillarProgress` getter-neveit a generált DTO-hoz igazítsd (pl. `getWeeklyPct()`); a generált DTO használata az adapterben oké — az adapter a lifegoal-ban él.

- [ ] **Step 4: Futtasd — zöld**

Run: `cd backend && ./mvnw test -Dtest=LifeGoalCompanionAdapterIT -Dmezo.test.use-testcontainers=true`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalCompanionAdapter.java backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalCompanionAdapterIT.java
git commit -m "feat(lifegoal): LifeGoalCompanionAdapter — a companion-port adaptere (mezo-iizd.10)"
```

---

### Task 3: config-knob + `LifeGoalText` + `LifeGoalSnapshotBlock` + unit teszt

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:57-76` (Snapshot record)
- Modify: `backend/src/main/resources/application.yml:512-525` (snapshot blokk)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/LifeGoalText.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/LifeGoalSnapshotBlock.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/LifeGoalSnapshotBlockTest.java`

**Interfaces:**
- Consumes: Task 1 `LifeGoalSource` (`ObjectProvider`-en át).
- Produces: `LifeGoalSnapshotBlock.render(UUID userId, LocalDate today)` → `String` („" ha ki van kapcsolva); `LifeGoalText.arrowWord(String)`, `LifeGoalText.dimensionHu(String)` — a Task 5 tool is ezeket használja.
- Produces: `CompanionProperties.Snapshot.lifegoalMaxGoals()` (int, 0 = blokk ki).

- [ ] **Step 1: Snapshot record bővítése + yml**

A `Snapshot` record végére új mező (a `peopleMaxPersons` után, vesszővel):

```java
        /**
         * mezo-iizd.10: hány aktív életcél-sort mutat a [Célok] blokk (chat ÉS reggeli variáns).
         * 0 = a blokk teljesen elmarad (omit, nem "nincs adat").
         */
        @Min(0) @Max(10) int lifegoalMaxGoals
```

Az `application.yml` snapshot szekciójába (a people-max-persons blokk után):

```yaml
      # mezo-iizd.10: how many active life goals the [Célok] snapshot block lists (chat AND the
      # morning variant — user decision: the morning reminder is a wanted, supportive nudge).
      # 0 = the block is omitted entirely.
      lifegoal-max-goals: 3
```

Keresd meg az esetleges teszt-yml-t is (`backend/src/test/resources/application*.yml` — ha a Snapshot ott is explicit ki van töltve, oda is kell a kulcs, különben a @Validated binding elhasal).

- [ ] **Step 2: `LifeGoalText` helper**

```java
package io.mrkuhne.mezo.feature.companion.tools;

import java.util.Map;

/** A [Célok] blokk és a get_life_goals tool közös magyar szókincse (mezo-iizd.10). A nyíl-szavak
 *  a WeeklyReviewContextSources.arrowWord készletét tükrözik (a glif félreolvasható a promptban,
 *  a szó nem); a dimenzió-nevek a FE lifegoalLabels.ts készletét (spec §10). */
public final class LifeGoalText {

    private static final Map<String, String> ARROW_HU = Map.of(
        "up", "emelkedik", "flat", "tartja", "down", "csúszik",
        "insufficient", "kevés adat az irányhoz");

    private static final Map<String, String> DIMENSION_HU = Map.of(
        "positive_emotion", "Érzelem", "engagement", "Elmélyülés", "relationships", "Kapcsolatok",
        "meaning", "Értelem", "accomplishment", "Teljesítmény", "health", "Egészség");

    private LifeGoalText() {}

    public static String arrowWord(String arrow) {
        return arrow == null ? "nincs irány" : ARROW_HU.getOrDefault(arrow, "nincs irány");
    }

    public static String dimensionHu(String dimension) {
        return dimension == null ? "?" : DIMENSION_HU.getOrDefault(dimension, dimension);
    }
}
```

- [ ] **Step 3: Failing unit teszt a blokkra**

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/** mezo-iizd.10 — render, cap, degradációk (a PeopleSnapshotBlockTest mintája). */
class LifeGoalSnapshotBlockTest {

    private static final UUID USER = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 5);

    @SuppressWarnings("unchecked")
    private LifeGoalSnapshotBlock block(LifeGoalSource source, int maxGoals) {
        ObjectProvider<LifeGoalSource> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(source);
        CompanionProperties properties = mock(CompanionProperties.class, org.mockito.Mockito.RETURNS_DEEP_STUBS);
        when(properties.snapshot().lifegoalMaxGoals()).thenReturn(maxGoals);
        return new LifeGoalSnapshotBlock(provider, properties);
    }

    @Test
    void testRender_shouldRenderGoalsWeakestAndLivePlans_whenAllPresent() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenReturn(new LifeGoalSource.Summary(
            List.of(new LifeGoalSource.GoalLine("Kockahas", "health", "up", 2, 3)),
            "Alvás",
            List.of("ha 21:00 után képernyő, akkor olvasás")));

        String rendered = block(source, 3).render(USER, TODAY);

        assertThat(rendered)
            .startsWith("[Célok]")
            .contains("Kockahas [Egészség] · emelkedik · ma 2/3 pillér")
            .contains("Leggyengébb pillér: Alvás")
            .contains("Ma él: ha 21:00 után képernyő, akkor olvasás");
    }

    @Test
    void testRender_shouldCapGoalLines_whenMoreGoalsThanMax() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenReturn(new LifeGoalSource.Summary(
            List.of(new LifeGoalSource.GoalLine("A", "health", "flat", 0, 1),
                    new LifeGoalSource.GoalLine("B", "meaning", "flat", 0, 1)),
            null, List.of()));

        String rendered = block(source, 1).render(USER, TODAY);

        assertThat(rendered).contains("A [Egészség]").doesNotContain("B [Értelem]");
    }

    @Test
    void testRender_shouldReturnEmpty_whenConfiguredOff() {
        assertThat(block(mock(LifeGoalSource.class), 0).render(USER, TODAY)).isEmpty();
    }

    @Test
    void testRender_shouldSayNincsAdat_whenSourceBeanAbsent() {
        assertThat(block(null, 3).render(USER, TODAY)).isEqualTo("[Célok] nincs adat");
    }

    @Test
    void testRender_shouldSayNincsAktivEletcel_whenNoActiveGoals() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any()))
            .thenReturn(new LifeGoalSource.Summary(List.of(), null, List.of()));

        assertThat(block(source, 3).render(USER, TODAY)).isEqualTo("[Célok] nincs aktív életcél");
    }

    @Test
    void testRender_shouldDegradeToNincsAdat_whenSourceThrows() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenThrow(new IllegalStateException("boom"));

        assertThat(block(source, 3).render(USER, TODAY)).isEqualTo("[Célok] nincs adat");
    }

    @Test
    void testRender_shouldSanitizeEmbeddedNewlines_whenTitleContainsControlChars() {
        LifeGoalSource source = mock(LifeGoalSource.class);
        when(source.summary(any(), any())).thenReturn(new LifeGoalSource.Summary(
            List.of(new LifeGoalSource.GoalLine("Rossz\ncím", "health", "flat", 0, 1)),
            null, List.of()));

        assertThat(block(source, 3).render(USER, TODAY)).contains("Rossz cím").doesNotContain("Rossz\ncím");
    }
}
```

(Ha a `PeopleSnapshotBlockTest` létező mintája máshogy mockolja a propertiest — pl. valódi record-példánnyal —, kövesd azt a deep-stub helyett.)

- [ ] **Step 4: Futtasd — bukjon**

Run: `cd backend && ./mvnw test -Dtest=LifeGoalSnapshotBlockTest`
Expected: FAIL — `LifeGoalSnapshotBlock` nem létezik

- [ ] **Step 5: Blokk implementálása**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.LifeGoalText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * mezo-iizd.10: a {@code [Célok]} blokk — aktív életcélok (cím · dimenzió · heti nyíl szóként ·
 * mai pillér-számláló), a leggyengébb pillér, és a ma élő ha–akkor tervek. A {@link LifeGoalSource}
 * porton olvas (ObjectProvider — a LIFEGOAL_SWITCH független a COMPANION_SWITCH-től, hiányzó bean
 * = „nincs adat"); companion → lifegoal import TILOS (2-szeletes ciklus). A „Ma él" TÉNY, nem
 * nudge: az emlékeztetőt a LifeGoalTriggerService feed-értesítése viszi (dedupKey), a prompt-
 * útmutató mondja ki, hogy a companion ne ismételje. A user döntése (2026-09-05) szerint a blokk
 * a REGGELI variánsba is bekerül — eltérés az [Emberek] chat-only precedensétől.
 *
 * <p>IDENT-3 (a PeopleSnapshotBlock kaveátja szó szerint): a catch-RuntimeException degradál, de
 * egy DataAccessException a körülvevő ChatService.prepareTurn tranzakciót így is rollback-only-ra
 * teszi — bevett precedens, nem bővítjük savepointtal.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LifeGoalSnapshotBlock {

    static final String HEADER_PREFIX = "[Célok]";
    static final String NO_DATA = HEADER_PREFIX + " " + ContextSnapshotAssembler.NO_DATA;
    static final String NO_ACTIVE = HEADER_PREFIX + " nincs aktív életcél";

    private final ObjectProvider<LifeGoalSource> lifeGoalSource;
    private final CompanionProperties properties;

    /** "" ha konfigurálva ki; egyébként a teljes blokk ZÁRÓ újsor nélkül. */
    public String render(UUID userId, LocalDate today) {
        int max = properties.snapshot().lifegoalMaxGoals();
        if (max == 0) {
            return "";
        }
        try {
            LifeGoalSource source = lifeGoalSource.getIfAvailable();
            if (source == null) {
                return NO_DATA;
            }
            LifeGoalSource.Summary summary = source.summary(userId, today);
            if (summary.goals().isEmpty()) {
                return NO_ACTIVE;
            }
            StringBuilder b = new StringBuilder(HEADER_PREFIX).append(" (aktív életcélok, max ").append(max).append(')');
            summary.goals().stream().limit(max).forEach(g -> b.append('\n')
                .append(PeopleSnapshotBlock.sanitize(g.title()))
                .append(" [").append(LifeGoalText.dimensionHu(g.dimension())).append("] · ")
                .append(LifeGoalText.arrowWord(g.arrow())).append(" · ma ")
                .append(g.pillarsHitToday()).append('/').append(g.pillarsTotal()).append(" pillér"));
            if (summary.weakestPillar() != null) {
                b.append("\nLeggyengébb pillér: ").append(PeopleSnapshotBlock.sanitize(summary.weakestPillar()));
            }
            summary.livePlans().forEach(plan ->
                b.append("\nMa él: ").append(PeopleSnapshotBlock.sanitize(plan)));
            return b.toString();
        } catch (RuntimeException e) {
            log.warn("[Célok] block render failed for user {} — degrades to 'nincs adat'; a "
                + "DataAccessException here still poisons the surrounding transaction (IDENT-3)", userId, e);
            return NO_DATA;
        }
    }
}
```

- [ ] **Step 6: Futtasd — zöld**

Run: `cd backend && ./mvnw test -Dtest='LifeGoalSnapshotBlockTest,PeopleSnapshotBlockTest'`
Expected: PASS (a PeopleSnapshotBlockTest is — a `sanitize` láthatósága nem változott)

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/LifeGoalSnapshotBlockTest.java
git commit -m "feat(companion): [Célok] snapshot-blokk + lifegoal-max-goals knob (mezo-iizd.10)"
```

---

### Task 4: splice az assemblerbe + IT-k (sorrend, determinizmus, reggeli, off-utak)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java:131-181`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerLifeGoalOffIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ContextSnapshotAssemblerLifeGoalSwitchOffIT.java`

**Interfaces:**
- Consumes: Task 3 `LifeGoalSnapshotBlock.render`.
- Produces: a `[Célok]` blokk pozíciója MINDKÉT variánsban: a `[Cél]` blokk UTÁN (a súlycél mellett rögtön az életcélok — tematikus szomszédság), a `[Edzés]` előtt.

- [ ] **Step 1: Failing IT-bővítés**

A `ContextSnapshotAssemblerIT` „all nine blocks" tesztjébe vedd fel a `[Célok]`-ot a `[Cél]` és `[Edzés]` közé (a sorrend-assertek láncába), és a no-data assertlistába: `.contains("[Célok] nincs aktív életcél")`. A javadoc-számokat (nine→ten) is frissítsd. Új tesztek ugyanoda:

```java
    @Autowired private io.mrkuhne.mezo.support.populator.LifeGoalPopulator lifeGoalPopulator;

    @Test
    void testRender_shouldRenderCelokBlock_whenActiveLifeGoalExists() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var goal = lifeGoalPopulator.goal(owner, "active");
        var pillar = lifeGoalPopulator.sleepPillar(goal);
        lifeGoalPopulator.pillarDay(pillar, today.minusDays(1), "hit");

        String block = assembler.render(owner, today);

        assertThat(block).contains("Kockahas [Egészség]").contains("Leggyengébb pillér: Alvás");
    }

    @Test
    void testRenderWithoutBiometrics_shouldIncludeCelokBlock_whenActiveLifeGoalExists() {
        // user-döntés (2026-09-05): a reggeli variáns IS látja a célokat — pozitív nudge
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        lifeGoalPopulator.goal(owner, "active");

        String block = assembler.renderWithoutBiometrics(owner, today);

        assertThat(block).contains("Kockahas [Egészség]");
    }

    @Test
    void testRender_shouldBeDeterministic_whenLifeGoalWithPlansPresent() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        var goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.sleepPillar(goal);

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
    }
```

Ha van már determinizmus-teszt a fájlban, az újat hagyd el, és csak győződj meg róla, hogy a seedje kap életcélt is.

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd backend && ./mvnw test -Dtest=ContextSnapshotAssemblerIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — nincs `[Célok]` a kimenetben

- [ ] **Step 3: Splice implementálása**

Az assemblerben: mező + helper + két splice (a `peopleLine` mintája):

```java
    private final LifeGoalSnapshotBlock lifeGoalSnapshotBlock;
```

```java
    /** mezo-iizd.10: [Célok] MINDKÉT variánsban — user-döntés: a reggeli cél-emlékeztető kívánt,
     *  támogató nudge (eltérés az [Emberek] chat-only precedensétől). "" ha konfigurálva ki. */
    private String lifeGoalLine(UUID userId, LocalDate today) {
        String block = lifeGoalSnapshotBlock.render(userId, today);
        return block.isEmpty() ? "" : block + '\n';
    }
```

`render()`-ben ÉS `renderWithoutBiometrics()`-ben a `goalBlock(...) + '\n'` sor után:

```java
                + lifeGoalLine(userId, today)
```

(FIGYELEM: a `lifeGoalLine` maga fűz `\n`-t — a splice-sor után NINCS külön `+ '\n'`, pont mint a `peopleLine`-nál.) Frissítsd a `render`/`renderWithoutBiometrics` javadocjában a blokk-számokat (nine→ten, eight→nine).

- [ ] **Step 4: Off-út IT-k**

`ContextSnapshotAssemblerLifeGoalOffIT` (config-off, a `ContextSnapshotAssemblerPeopleOffIT` másolata értelemszerűen):

```java
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.snapshot.lifegoal-max-goals=0")
class ContextSnapshotAssemblerLifeGoalOffIT extends AbstractIntegrationTest {
    // seed: aktív életcél LÉTEZIK (lifeGoalPopulator.goal(owner, "active")) — a KONFIG némít.
    // assert: doesNotContain("[Célok]"), és a [Cél]→[Edzés] szakaszban nincs dupla üres sor
    // (a PeopleOffIT substring-assert mintája).
}
```

`ContextSnapshotAssemblerLifeGoalSwitchOffIT` (feature-switch-off → adapter-bean hiányzik → „nincs adat"):

```java
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.lifegoal.enabled=false")
class ContextSnapshotAssemblerLifeGoalSwitchOffIT extends AbstractIntegrationTest {
    // assert: render(...) contains("[Célok] nincs adat") — a companion sosem hasal el a lifegoal miatt.
}
```

- [ ] **Step 5: Futtasd az összes érintett IT-t — zöld**

Run: `cd backend && ./mvnw test -Dtest='ContextSnapshotAssembler*' -Dmezo.test.use-testcontainers=true`
Expected: PASS (a PeopleOff IT is)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): [Célok] blokk a chat- és reggeli pillanatképben (mezo-iizd.10)"
```

---

### Task 5: `get_life_goals` tool + regisztrációk + prompt-útmutató

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/LifeGoalTools.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistry.java:27-49`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/ChatToolDomains.java:15-25`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (SYSTEM_PROMPT `[Eszköz-útmutató]`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistryIT.java`, `.../tools/CompanionToolsRenderIT.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatServiceIT.java`

**Interfaces:**
- Consumes: Task 1 `LifeGoalSource.details`, Task 3 `LifeGoalText`.
- Produces: `get_life_goals` nevű `@Tool` (paraméter nélkül, `ToolContext`-tel).

- [ ] **Step 1: Failing tesztek**

`CompanionToolRegistryIT.testCallbacks…`: a `containsExactlyInAnyOrder` listába vedd fel a `"get_life_goals"`-t (17→18 név).

`CompanionToolsRenderIT`-be új teszt (a fájl meglévő seed/ToolContext-idiómáját követve — nézd meg, hogyan épít `ToolContext`-et, és pontosan úgy):

```java
    @Test
    void testGetLifeGoals_shouldRenderGoalPillarsAndPlans_whenActiveGoalSeeded() {
        UUID owner = userPopulator.createUser().getId();
        var goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.sleepPillar(goal);

        String out = lifeGoalTools.getLifeGoals(toolContext(owner));

        assertThat(out).contains("Kockahas").contains("Egészség").contains("Alvás");
    }

    @Test
    void testGetLifeGoals_shouldSayNincsAktivEletcel_whenNoGoals() {
        UUID owner = userPopulator.createUser().getId();
        assertThat(lifeGoalTools.getLifeGoals(toolContext(owner))).isEqualTo("Életcél: nincs aktív életcél");
    }
```

`ChatServiceIT` system-prompt tesztjébe: assert, hogy a prompt tartalmazza az `"get_life_goals"` routing-sort.

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd backend && ./mvnw test -Dtest='CompanionToolRegistryIT,CompanionToolsRenderIT' -Dmezo.test.use-testcontainers=true`
Expected: FAIL

- [ ] **Step 3: `LifeGoalTools` implementálása**

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * mezo-iizd.10: életcél-lekérdező tool. EGYEDÜLIKÉNT a toolok közt NEM a saját feature-jét
 * importálja, hanem a {@link LifeGoalSource} porton renderel — a companion → lifegoal import
 * 2-szeletes ciklust zárna (a lifegoal már függ a companiontól). A [Célok] snapshot-blokk a
 * tömör összefoglaló; ez a tool a gazdag nézet, amikor a user rákérdez.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LifeGoalTools {

    private final ObjectProvider<LifeGoalSource> lifeGoalSource;

    @Tool(name = "get_life_goals", description = "Az aktív ÉLETCÉLOK (PERMAH-életterületek) "
            + "részletes állása: célonként cím, életterület (Érzelem/Elmélyülés/Kapcsolatok/"
            + "Értelem/Teljesítmény/Egészség), keret, heti irány és heti szint (%), a pillérek "
            + "(mai találat + heti irány), és a ha–akkor tervek (melyik él ma). Használd, amikor "
            + "a user az életcéljairól, életterületeiről, pillérjeiről, ha–akkor terveiről kérdez "
            + "(pl. „hogy állok a kapcsolatok célommal?", „melyik pillérem a leggyengébb?"). "
            + "A számszerű súly/kalória-célhoz NEM ez kell, az a get_goal.")
    public String getLifeGoals(ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LifeGoalSource source = lifeGoalSource.getIfAvailable();
        if (source == null) {
            return "Életcél: az életcél-modul ki van kapcsolva";
        }
        LifeGoalSource.Details details = source.details(userId, LocalDate.now());
        if (details.goals().isEmpty()) {
            return "Életcél: nincs aktív életcél";
        }
        StringBuilder b = new StringBuilder();
        for (LifeGoalSource.GoalDetail goal : details.goals()) {
            if (!b.isEmpty()) {
                b.append('\n');
            }
            b.append("Életcél: ").append(goal.title())
                .append(" [").append(LifeGoalText.dimensionHu(goal.dimension())).append(']')
                .append(", heti irány: ").append(LifeGoalText.arrowWord(goal.arrow()));
            if (goal.weekPercent() != null) {
                b.append(", heti szint: ").append(goal.weekPercent()).append('%');
            }
            if (!goal.pillars().isEmpty()) {
                b.append("\nPillérek:");
                for (LifeGoalSource.PillarLine p : goal.pillars()) {
                    b.append("\n- ").append(p.label())
                        .append(" — ma: ").append(p.hitToday() == null ? ToolText.NO_DATA
                            : (p.hitToday() ? "talált" : "nem talált"))
                        .append(", heti irány: ").append(LifeGoalText.arrowWord(p.arrow()));
                }
            }
            if (!goal.plans().isEmpty()) {
                b.append("\nHa–akkor tervek:");
                for (LifeGoalSource.PlanLine p : goal.plans()) {
                    b.append("\n- ").append(p.ha()).append(", ").append(p.akkor());
                    if (p.liveToday()) {
                        b.append(" (MA ÉL)");
                    }
                }
            }
            ToolContexts.audit(toolContext).addRef("LifeGoal", goal.title());
        }
        return b.toString();
    }
}
```

Megjegyzés: itt a `LocalDate.now()` megengedett — a toolok idiómája ez (`GoalTools.renderProgress` precedens); a determinizmus-kényszer csak a snapshot-blokkra áll.

- [ ] **Step 4: Regisztrációk**

`CompanionToolRegistry`: mező `private final LifeGoalTools lifeGoalTools;` + a `ToolCallbacks.from(...)` felsorolásba `lifeGoalTools`.

`ChatToolDomains.DOMAIN_OF`: `Map.entry("get_life_goals", "cel")` (a javadoc „17"-jét írd 18-ra).

`ChatService.SYSTEM_PROMPT` `[Eszköz-útmutató]`:
- a meglévő sort pontosítsd: `- számszerű cél: súlycél, kalóriacél, heti ütem → get_goal`
- új sor alá: `- életcél, életterület (PERMAH), pillér, ha–akkor terv → get_life_goals`

`ChatService.SYSTEM_PROMPT` `[Mit szabad állítani]` blokk végére (az [Emberek] bekezdés után) a nem-nudge keretezés (Bloom-minta, spec §4.5):

```
            A [Célok] blokk {{NÉV}} életcéljainak háttér-állása a személyre szabáshoz. Emlékeztetőt \
            a ha–akkor tervekről külön értesítés visz — te ne ismételd; a célokat akkor hozd szóba, \
            ha {{NÉV}} üzenete relevánssá teszi őket.
```

- [ ] **Step 5: Futtasd — zöld**

Run: `cd backend && ./mvnw test -Dtest='CompanionToolRegistryIT,CompanionToolsRenderIT,ChatServiceIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/ChatToolDomains.java backend/src/test/java/io/mrkuhne/mezo/feature/companion
git commit -m "feat(companion): get_life_goals chat-tool + routing (mezo-iizd.10)"
```

---

### Task 6: FE tükrök (toolDomains + chatRefs) + FE kapuk

**Files:**
- Modify: `frontend/src/features/insights/logic/toolDomains.ts:18-37` (TOOLS map) és a REF-kind map (`~:87`)
- Modify: `frontend/src/features/insights/logic/chatRefs.ts:18-` (KIND_LABELS)

**Interfaces:**
- Consumes: a Task 5 tool-név (`get_life_goals`) és ref-kind (`LifeGoal`).

- [ ] **Step 1: Map-bejegyzések**

`toolDomains.ts` TOOLS (a „17 real companion tools" kommentet írd 18-ra + dátum):

```ts
  get_life_goals: { label: 'Életcélok', icon: 'i-cel', wash: 'gold' },
```

Ugyanebben a fájlban a ref-kind map (ahol `Goal: { label: 'Cél', … }` áll):

```ts
  LifeGoal: { label: 'Életcél', icon: 'i-cel', wash: 'gold' },
```

`chatRefs.ts` KIND_LABELS: `LifeGoal: 'Életcél',` (a `Goal: 'Cél'` sor mellé).

Ellenőrizd greppel, nincs-e teszt, ami a TOOLS map méretét pinnelné: `grep -rn "toolDomain\|TOOLS" frontend/src --include='*.test.*' | head`.

- [ ] **Step 2: FE kapuk MINDKÉT módban + build**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- --run && VITE_USE_MOCK=false pnpm test -- --run && pnpm build
```

Expected: PASS mindhárom.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/insights/logic
git commit -m "feat(insights): get_life_goals + LifeGoal ref a domain-tükrökben (mezo-iizd.10)"
```

---

### Task 7: reggeli prompt-mondat (nem-nudge ellensúly)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java:78-88` (MORNING_PROMPT)

- [ ] **Step 1: A MORNING_PROMPT (5) pontja után új (6) pont**

```java
            + "készül: (1) az éjszakai alvásról és a testsúlyról/súlytrendről NE írj — azokról "
            ...
            + "vonatkozó változtatást SOHA ne javasolj — az orvosi döntés; (6) a [Célok] blokk "
            + "életcéljaira támogatóan utalhatsz, de a ha–akkor tervek emlékeztetőit külön "
            + "értesítés viszi — azok szövegét NE ismételd. "
```

(A meglévő (1)–(5) szöveg változatlan; csak a záró mondat elé kerül a (6).)

- [ ] **Step 2: Proactive tesztek zöldek**

Run: `cd backend && ./mvnw test -Dtest='CompanionMessageGenerator*' -Dmezo.test.use-testcontainers=true`
Expected: PASS (a fake LLM a MORNING_MARKER prefixre diszpécsel, azt nem bántottuk)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java
git commit -m "feat(proactive): reggeli prompt — célokra utalás igen, értesítés-ismétlés nem (mezo-iizd.10)"
```

---

### Task 8: dokumentáció + codemap

**Files:**
- Modify: `docs/features/companion.md` — blokk-szám állítások (kilenc→tíz, reggeli nyolc→kilenc), új `[Célok]` blokk-szekció, `LifeGoalSource` a portok közt, `get_life_goals` a tool-inventárban, key_files frontmatter (új fájlok).
- Modify: `docs/features/lifegoal.md` — a §1/§5/§9 „deferred" jelzések feloldása ([Célok] blokk + get_life_goals leszállítva), `LifeGoalCompanionAdapter` a key_files-ba, a „ma él" read-only kiértékelés dokumentálása (ritual_missed = tegnapra + adopciós kapu).
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Doksik átvezetése**

Greppel keresd az elavuló állításokat: `grep -n "kilenc\|nine\|eight\|nyolc\|deferred\|halasztva\|get_life_goals\|Célok" docs/features/companion.md docs/features/lifegoal.md` — minden találatot igazíts a leszállított állapothoz. A knowledge-base skill 10-szekciós szerkezetét kövesd (meglévő szekciókba írsz, nem újakat találsz ki).

- [ ] **Step 2: Codemap**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

Expected: a `--check` tiszta.

- [ ] **Step 3: Commit**

```bash
git add docs/features/companion.md docs/features/lifegoal.md docs/CODEMAP.md
git commit -m "docs(companion,lifegoal): [Célok] blokk + get_life_goals átvezetése (mezo-iizd.10)"
```

---

### Task 9: kapuk + push + self-PR

- [ ] **Step 1: Fókuszált backend-futás egyben**

```bash
cd backend && ./mvnw test -Dtest='LifeGoal*,ContextSnapshotAssembler*,CompanionTool*,ChatServiceIT,PeopleSnapshotBlockTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. (Az ArchUnit-ciklust CSAK a CI teljes suite-ja fogja el — ezért kötelező a self-PR-t megvárni.)

- [ ] **Step 2: Push + self-PR**

```bash
git pull --rebase && bd dolt push && git push -u origin claude/life-goals-companion-block-6aef2e
gh pr create --fill --title "feat(companion): [Célok] blokk + get_life_goals (mezo-iizd.10)"
```

- [ ] **Step 3: CI zöldre várás, majd lokális --no-ff merge main-re** (a CLAUDE.md git-workflow szerint), `bd close mezo-iizd.10` a merge után.

---

## Self-review jegyzet (a terv írása közben feloldva)

- A spec `GoalDetail.id` mezője elhagyva: az `addRef(kind, label)` címkét vár (a `GoalTools` a title-t adja), id-re nincs fogyasztó — YAGNI.
- A tool `LocalDate.now()`-t használ — ez a toolok bevett idiómája (`GoalTools`), a determinizmus-kényszer csak a snapshot-blokkra vonatkozik.
- A `[Célok]` blokk pozíciója: közvetlenül a `[Cél]` után (tematikus szomszédság) — az IT sorrend-assertje rögzíti.
- A `CheckInPopulator`/`PlanTriggerJson` pontos szignatúráit az implementáló ellenőrzi (Step-jegyzetek jelölik) — a szándék egyértelmű, a nevek a valósághoz igazítandók.
