package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.service.MemoirGenerator;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W2 generation flow over the fake LLM (prompt v2: mezo-uajy): gather = the WEEK'S summaries
 * [weekStart, weekStart+6] + relevant patterns (CONFIRMED or event-bearing) + life events +
 * week PRs + predictions + the WeeklyReviewContextSources wider context + facts, with numbered
 * anchor candidates; strict-JSON {title, body, anchors:[{index,note}]} (legacy anchorIndexes
 * still accepted) scripted via [fake-memoir:{…}] (check-in note → the note is NOT in the memoir
 * gather, so the sentinel is planted via a daily-summary NARRATIVE instead — summaries carry
 * free text).
 *
 * <p>No class-level {@code @Transactional} — an emit-reachable service running under
 * {@code AppNotificationEmitter}'s {@code REQUIRES_NEW} deadlocks against an uncommitted
 * test-user row (bd mezo-gzhp.1 precedent). Isolation comes from {@code ResetDatabase} via
 * {@link AbstractIntegrationTest}.
 */
@ActiveProfiles("companion-fake")
class MemoirGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    @Autowired private MemoirGenerator generator;
    @Autowired private MemoirRepository repository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private GraphNodeRepository graphNodeRepository;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private TrainPopulator trainPopulator;

    @Test
    void testGather_shouldComposeWeekSummariesAndCandidates_whenDataExists() {
        UUID user = userPopulator.createUser("mg-gather@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Kedden kemény edzés volt.");
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Előző vasárnap — nem tartozik bele.");

        MemoirGenerator.MemoirGather gather = generator.gather(user, WEEK_START);

        assertThat(gather).isNotNull();
        assertThat(gather.payload())
                .contains("Kedden kemény edzés volt.")
                .doesNotContain("Előző vasárnap — nem tartozik bele.")
                .contains("HORGONY-JELÖLTEK");
        // one Memory candidate per included summary
        assertThat(gather.candidates()).hasSize(1);
        assertThat(gather.candidates().get(0).kind()).isEqualTo("Memory");
    }

    @Test
    void testGather_shouldFilterPatternsAndRenderWiderSections_whenWeekIsRich() {
        UUID user = userPopulator.createUser("mg-rich@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Kedden kemény edzés volt.");

        PatternEntity confirmed = patternPopulator.createPattern(user, "pk-c", "Megerősített minta");
        confirmed.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(confirmed);
        PatternEntity rejected = patternPopulator.createPattern(user, "pk-r", "Elvetett minta");
        rejected.setStatus(PatternEntity.STATUS_REJECTED);
        patternPopulator.save(rejected);
        // monitoring pattern with an IN-WEEK event — included by the event rule, not by status
        PatternEntity monitoring = patternPopulator.createPattern(user, "pk-m", "Figyelt minta");
        monitoring.setStatus(PatternEntity.STATUS_MONITORING);
        patternPopulator.save(monitoring);
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(user);
        event.setPatternId(monitoring.getId());
        event.setKind(PatternEventEntity.KIND_CONFIRMED);
        event.setOccurredAt(WEEK_START.plusDays(2).atStartOfDay(ZoneOffset.UTC).toInstant());
        patternEventRepository.saveAndFlush(event);

        GraphNodeEntity lifeEvent = graphPopulator.createNode(
                user, GraphNodeEntity.KIND_LIFE_EVENT, "Költözés az új lakásba");
        lifeEvent.setOccurredOn(WEEK_START.plusDays(3));
        graphNodeRepository.saveAndFlush(lifeEvent);

        journalPopulator.createEntry(user, WEEK_START.plusDays(2),
                "Fáradt nap volt, de bementem.", "quickinput");
        predictionPopulator.prediction(user, WEEK_START, "sleep", "up",
                PredictionEntity.STATUS_VALIDATED);

        MemoirGenerator.MemoirGather gather = generator.gather(user, WEEK_START);

        assertThat(gather.payload())
                .contains("Megerősített minta")
                .contains("Figyelt minta")
                .doesNotContain("Elvetett minta")
                .contains("ÉLETESEMÉNYEK")
                .contains("Költözés az új lakásba")
                .contains("NAPLÓBEJEGYZÉSEK")
                .contains("Fáradt nap volt, de bementem.")
                .contains("PREDIKCIÓK")
                .contains("Teszt predikció");
        assertThat(gather.candidates())
                .extracting(MemoirAnchorsEnvelope.Anchor::kind)
                .contains("Memory", "Pattern", "LifeEvent");
        assertThat(gather.candidates())
                .extracting(MemoirAnchorsEnvelope.Anchor::label)
                .contains("Költözés az új lakásba", "Megerősített minta", "Figyelt minta")
                .doesNotContain("Elvetett minta", "Teszt predikció");
    }

    @Test
    void testGather_shouldIncludeWeekPr_whenAllTimeBestFellInWeek() {
        UUID user = userPopulator.createUser("mg-pr@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(4), "Csúcs-nap.");

        MesocycleEntity meso = trainPopulator.createActiveMeso(user);
        WorkoutSessionEntity session = trainPopulator.createWorkoutSession(
                user, meso.getId(), "Pull A", "instance", 0, "completed");
        ExerciseEntity exercise = trainPopulator.createExercise(user, session.getId(), "Lat Pulldown", 0);
        // earlier, weaker best OUTSIDE the week — the all-time best must fall IN-week to count
        trainPopulator.createLoggedSet(user, exercise.getId(), session.getId(), 0, "100", 8, 1,
                WEEK_START.minusDays(10).atTime(12, 0).toInstant(ZoneOffset.UTC));
        trainPopulator.createLoggedSet(user, exercise.getId(), session.getId(), 1, "105", 9, 1,
                WEEK_START.plusDays(4).atTime(12, 0).toInstant(ZoneOffset.UTC));

        MemoirGenerator.MemoirGather gather = generator.gather(user, WEEK_START);

        assertThat(gather.payload())
                .contains("A HÉT EDZÉS-CSÚCSAI")
                .contains("Lat Pulldown");
        assertThat(gather.candidates())
                .anySatisfy(a -> {
                    assertThat(a.kind()).isEqualTo("PR");
                    assertThat(a.label()).isEqualTo("Lat Pulldown 105 kg");
                });
    }

    @Test
    void testGather_shouldOmitPrSection_whenBestFellOutsideWeek() {
        UUID user = userPopulator.createUser("mg-nopr@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Sima nap.");

        MesocycleEntity meso = trainPopulator.createActiveMeso(user);
        WorkoutSessionEntity session = trainPopulator.createWorkoutSession(
                user, meso.getId(), "Pull A", "instance", 0, "completed");
        ExerciseEntity exercise = trainPopulator.createExercise(user, session.getId(), "Lat Pulldown", 0);
        trainPopulator.createLoggedSet(user, exercise.getId(), session.getId(), 0, "105", 9, 1,
                WEEK_START.minusDays(10).atTime(12, 0).toInstant(ZoneOffset.UTC));

        assertThat(generator.gather(user, WEEK_START).payload())
                .doesNotContain("A HÉT EDZÉS-CSÚCSAI");
    }

    @Test
    void testGather_shouldReturnNull_whenWeekEmpty() {
        UUID user = userPopulator.createUser("mg-empty@test.local").getId();

        assertThat(generator.gather(user, WEEK_START)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedMemoir_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("mg-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(2),
                "[fake-memoir:{\"title\":\"A várakozás hete\",\"body\":\"Szép hét volt.\",\"anchorIndexes\":[0]}]");

        MemoirEntity memoir = generator.generate(user, WEEK_START);

        assertThat(memoir).isNotNull();
        assertThat(memoir.getTitle()).isEqualTo("A várakozás hete");
        assertThat(memoir.getBody()).isEqualTo("Szép hét volt.");
        assertThat(memoir.getAnchors().anchors()).hasSize(1);
        assertThat(memoir.getAnchors().anchors().get(0).kind()).isEqualTo("Memory");
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("memoir_ready");
                    assertThat(n.getDeeplink()).isEqualTo("/insights/memoir");
                });
    }

    @Test
    void testGenerate_shouldComposeHumanMemoryLabels_whenAnchorsCarryNotes() {
        UUID user = userPopulator.createUser("mg-anchors@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(2),
                "[fake-memoir:{\"title\":\"A csendes hét\","
                        + "\"body\":\"Első bekezdés.\\n\\nMásodik bekezdés.\","
                        + "\"anchors\":[{\"index\":0,\"note\":\"a négyórás verseny\"}]}]");

        MemoirEntity memoir = generator.generate(user, WEEK_START);

        assertThat(memoir).isNotNull();
        assertThat(memoir.getBody()).isEqualTo("Első bekezdés.\n\nMásodik bekezdés.");
        assertThat(memoir.getAnchors().anchors()).hasSize(1);
        MemoirAnchorsEnvelope.Anchor anchor = memoir.getAnchors().anchors().get(0);
        assertThat(anchor.kind()).isEqualTo("Memory");
        assertThat(anchor.label())
                .isEqualTo(MemoirGenerator.memoryLabel(WEEK_START.plusDays(2), "a négyórás verseny"))
                .endsWith(" — a négyórás verseny");
    }

    @Test
    void testGenerate_shouldEmitOnlyOneMemoirReadyRow_whenCalledTwice() {
        UUID user = userPopulator.createUser("mg-emit-once@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(2),
                "[fake-memoir:{\"title\":\"Ismétlődő hét\",\"body\":\"Ugyanaz a hét.\",\"anchorIndexes\":[0]}]");

        generator.generate(user, WEEK_START);
        generator.generate(user, WEEK_START);

        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(user)
                .stream().filter(n -> n.getKind().equals("memoir_ready")).count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnExisting_whenRowAlreadyExists() {
        UUID user = userPopulator.createUser("mg-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Volt nap.");
        MemoirEntity existing = memoirPopulator.memoir(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerUnparseable() {
        UUID user = userPopulator.createUser("mg-broken@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "[fake-memoir:{\"title\":}]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }
}
