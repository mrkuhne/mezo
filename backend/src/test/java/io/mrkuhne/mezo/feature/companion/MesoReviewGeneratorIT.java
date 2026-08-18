package io.mrkuhne.mezo.feature.companion;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.MesoContextWeek;
import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.MesoReviewGenerator;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import io.mrkuhne.mezo.feature.train.entity.json.MesoContextJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleReportRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.MesocycleReportService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S3 AI-review generation over the fake LLM (mezo-meyc.3): the companion assembles the closed
 * run's lifestyle context into the train-owned {@code mesocycle_report.context} jsonb, then makes
 * ONE smart-tier call whose answer lands in {@code ai_eval} / {@code ready}.
 *
 * <p>Service-level and deliberately NOT {@code @Transactional}: the last test drives the REAL
 * event path ({@code closeMesocycle} → AFTER_COMMIT → {@code @Async} listener), which only fires
 * on a genuinely committed transaction.
 *
 * <p>The first three tests create the pending report row through
 * {@link MesocycleReportService#computeAndStore} — the one report-writing entry point that does
 * NOT publish {@code MesocycleClosed} — so the explicit {@code generate()} under test can never
 * race the async listener doing the same work.
 */
@ActiveProfiles("companion-fake")
class MesoReviewGeneratorIT extends AbstractIntegrationTest {

    @Autowired private MesoReviewGenerator generator;
    @Autowired private TrainService trainService;
    @Autowired private MesocycleReportService reportService;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private MesocycleReportRepository reportRepository;
    @Autowired private TrainPopulator train;
    @Autowired private RunningPopulator running;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private CheckInPopulator checkIns;
    @Autowired private WeightLogPopulator weightLogs;
    @Autowired private WaterLogPopulator waterLogs;
    @Autowired private PantryItemPopulator pantryItems;
    @Autowired private MealPopulator meals;
    @Autowired private DatabasePopulator databasePopulator;

    // ── generate on a pending report ────────────────────────────────────────────

    @Test
    void testGenerate_shouldPersistContextAndReview_whenStatusPending() {
        UUID owner = databasePopulator.populateUser("meso-review-a@test.local");
        MesocycleEntity run = twoWeekRunWithLifestyleData(owner);
        reportService.computeAndStore(run);

        generator.generate(owner, run.getId());

        MesocycleReportEntity row = reportRow(owner, run.getId());
        assertThat(row.getAiEval()).isEqualTo(FakeCompanionLlm.MESO_REVIEW_ANSWER);
        assertThat(row.getAiEvalStatus()).isEqualTo(MesocycleReportEntity.AI_EVAL_STATUS_READY);
        assertThat(row.getAiEvalGeneratedAt()).isNotNull();

        MesoContextJson context = row.getContext();
        assertThat(context).isNotNull();
        assertThat(context.weeks()).extracting(MesoContextJson.Week::week).containsExactly(1, 2);

        // W1 = [start, start+6]: two sleep rows, one check-in, one sport session, one run log,
        // one 2 l water day, one meal day, one weigh-in delta.
        MesoContextJson.Week w1 = context.weeks().get(0);
        assertThat(w1.sleepAvgH()).isEqualTo(7.75);
        assertThat(w1.sleepQualityAvg()).isEqualTo(4.5);
        assertThat(w1.energyAvg()).isEqualTo(4.0);
        assertThat(w1.stressAvg()).isEqualTo(2.0);
        assertThat(w1.waterAvgMl()).isEqualTo(2000.0);
        assertThat(w1.weightDeltaKg()).isEqualTo(-0.5);
        assertThat(w1.sportMinutes()).isEqualTo(90.0);
        assertThat(w1.sportSessions()).isEqualTo(1.0);
        assertThat(w1.runSessions()).isEqualTo(1.0);
        assertThat(w1.gymRpeAvg()).isEqualTo(7.4); // avg(sport rpe 6.8, run rpeActual 8)
        assertThat(w1.mealCoverageDays()).isEqualTo(1.0);
        assertThat(w1.kcalAvg()).isNotNull();
        assertThat(w1.kcalTargetAvg()).isNotNull();

        // W2 = [start+7, windowEnd]: only the one sleep row — everything else is honestly absent.
        MesoContextJson.Week w2 = context.weeks().get(1);
        assertThat(w2.sleepAvgH()).isEqualTo(6.5);
        assertThat(w2.sportMinutes()).isNull();
        assertThat(w2.weightDeltaKg()).isNull();
        assertThat(w2.sportSessions()).isEqualTo(0.0);
        assertThat(w2.mealCoverageDays()).isEqualTo(0.0);

        MesoContextJson.Totals totals = context.totals();
        assertThat(totals.daysTotal()).isEqualTo(14);
        assertThat(totals.sleepAvgH()).isEqualTo(7.33); // avg(7.5, 8, 6.5)
        assertThat(totals.sportMinutes()).isEqualTo(90.0);
        assertThat(totals.sportSessions()).isEqualTo(1.0);
        assertThat(totals.runSessions()).isEqualTo(1.0);
        assertThat(totals.weightChangeKg()).isEqualTo(-0.5);
        assertThat(totals.mealCoverageDays()).isEqualTo(1.0);

        // …and the whole thing survives the jsonb -> MesoReportMapper -> contract DTO trip the FE
        // actually reads (S2 could only ever assert this block as null).
        MesocycleReportResponse response = reportService.getReport(owner, run.getId());
        assertThat(response.getAiEvalEnabled()).isTrue();
        assertThat(response.getAiEval()).isEqualTo(FakeCompanionLlm.MESO_REVIEW_ANSWER);
        assertThat(response.getAiEvalStatus())
            .isEqualTo(MesocycleReportResponse.AiEvalStatusEnum.READY);
        assertThat(response.getAiEvalGeneratedAt()).isNotNull();
        assertThat(response.getContext().getTotals().getDaysTotal()).isEqualTo(14);
        assertThat(response.getContext().getWeeks())
            .extracting(MesoContextWeek::getWeek).containsExactly(1, 2);
        assertThat(response.getContext().getWeeks().get(0).getSleepAvgH())
            .isEqualByComparingTo("7.75");
        assertThat(response.getContext().getWeeks().get(1).getSportMinutes()).isNull();
    }

    /**
     * The metric legend must travel WITH the data (fix round 1): three context fields measure less than
     * their names promise, so the payload spells the caveats out before the JSON blocks and the system
     * prompt tells the model to qualify accordingly. Asserted on the real prompt, echoed back verbatim
     * by the fake.
     */
    @Test
    void testGenerate_shouldPrependMetricLegend_whenAssemblingThePayload() {
        UUID owner = databasePopulator.populateUser("meso-review-f@test.local");
        MesocycleEntity run = titled(twoWeekRunWithLifestyleData(owner),
            "Legenda-futam " + FakeCompanionLlm.MESO_REVIEW_ECHO);
        reportService.computeAndStore(run);

        generator.generate(owner, run.getId());

        // the echo channel returns the assembled USER PAYLOAD, so ai_eval IS the prompt the model saw
        String prompt = reportRow(owner, run.getId()).getAiEval();
        assertThat(prompt).contains("JELMAGYARÁZAT");
        // (a) gymRpeAvg is sport+run RPE and carries NO gym data
        assertThat(prompt).contains("gymRpeAvg").contains("NEM a gym-edzésekéé");
        // (b) the weight fields are sums of consecutive-MEASURED-day deltas, not a run-long change
        assertThat(prompt).contains("weightDeltaKg / weightChangeKg")
            .contains("KÖVETŐ MÉRT napok")
            .contains("NEM a futam teljes súlyváltozása");
        // (c) averages carry no coverage denominator — the row counts are the only coverage signal
        assertThat(prompt).contains("KIZÁRÓLAG az adattal rendelkező napokra")
            .contains("mealCoverageDays");
        // (d) the late-close bucket caveat
        assertThat(prompt).contains("HOSSZABB időszakot is fedhet");
        // and it PRECEDES the data it qualifies — a legend after the JSON is a legend the model skipped
        assertThat(prompt.indexOf("JELMAGYARÁZAT"))
            .isLessThan(prompt.indexOf("ÉLETMÓD-KONTEXTUS"));
    }

    /**
     * The narrative is written onto a FRESHLY RE-READ row, not the pre-call snapshot: seconds pass
     * during a real LLM round trip, and a {@code regenerate} landing in that window has already stored
     * a new {@code report} jsonb (and possibly a {@code selfEval}). Merging the snapshot would silently
     * revert both. Driven directly — the fake answers before any concurrent write could be orchestrated
     * end-to-end, so this is the only place the behaviour is observable.
     */
    @Test
    void testMarkReady_shouldWriteOnlyAiFieldsOnAFreshRow_whenTheRowMovedMeanwhile() {
        UUID owner = databasePopulator.populateUser("meso-review-g@test.local");
        MesocycleEntity run = twoWeekRunWithLifestyleData(owner);
        reportService.computeAndStore(run);
        // whatever else the row gained while the model was thinking
        MesocycleReportEntity concurrent = reportRow(owner, run.getId());
        concurrent.setSelfEval("közben mentett önértékelés");
        reportRepository.saveAndFlush(concurrent);

        generator.markReady(run.getId(), owner, "AI-értékelés szövege");

        MesocycleReportEntity after = reportRow(owner, run.getId());
        assertThat(after.getAiEval()).isEqualTo("AI-értékelés szövege");
        assertThat(after.getAiEvalStatus()).isEqualTo(MesocycleReportEntity.AI_EVAL_STATUS_READY);
        assertThat(after.getAiEvalGeneratedAt()).isNotNull();
        // the concurrent write survives — only the three AI fields were touched
        assertThat(after.getSelfEval()).isEqualTo("közben mentett önértékelés");
        assertThat(after.getReport()).isNotNull();
    }

    /** The run TITLE reaches the prompt — the sentinel-planting channel the failure test rides too. */
    @Test
    void testGenerate_shouldUseScriptedAnswer_whenSentinelPlantedInTitle() {
        UUID owner = databasePopulator.populateUser("meso-review-b@test.local");
        MesocycleEntity run = titled(twoWeekRunWithLifestyleData(owner),
            "Nyári blokk [fake-meso-review:Egyedi futam-értékelés.]");
        reportService.computeAndStore(run);

        generator.generate(owner, run.getId());

        assertThat(reportRow(owner, run.getId()).getAiEval()).isEqualTo("Egyedi futam-értékelés.");
    }

    // ── idempotency ─────────────────────────────────────────────────────────────

    @Test
    void testGenerate_shouldSkip_whenStatusAlreadyReady() {
        UUID owner = databasePopulator.populateUser("meso-review-c@test.local");
        MesocycleEntity run = twoWeekRunWithLifestyleData(owner);
        MesocycleReportEntity row = reportService.computeAndStore(run);
        row.setAiEval("KORÁBBI ÉRTÉKELÉS");
        row.setAiEvalStatus(MesocycleReportEntity.AI_EVAL_STATUS_READY);
        reportRepository.saveAndFlush(row);

        generator.generate(owner, run.getId());

        MesocycleReportEntity after = reportRow(owner, run.getId());
        // untouched narrative == the fake was never called a second time
        assertThat(after.getAiEval()).isEqualTo("KORÁBBI ÉRTÉKELÉS");
        assertThat(after.getAiEvalStatus()).isEqualTo(MesocycleReportEntity.AI_EVAL_STATUS_READY);
        // the skip happens BEFORE the assemble step, so not even the context is rewritten
        assertThat(after.getContext()).isNull();
    }

    // ── LLM failure ─────────────────────────────────────────────────────────────

    @Test
    void testGenerate_shouldPersistFailedAndKeepContext_whenLlmThrows() {
        UUID owner = databasePopulator.populateUser("meso-review-d@test.local");
        MesocycleEntity run = titled(twoWeekRunWithLifestyleData(owner),
            "Bukó blokk " + FakeCompanionLlm.FAIL_COMPLETE);
        reportService.computeAndStore(run);

        generator.generate(owner, run.getId());

        MesocycleReportEntity row = reportRow(owner, run.getId());
        assertThat(row.getAiEvalStatus()).isEqualTo(MesocycleReportEntity.AI_EVAL_STATUS_FAILED);
        assertThat(row.getAiEval()).isNull();
        assertThat(row.getAiEvalGeneratedAt()).isNull();
        // the context half is written BEFORE the call, so a failed narrative never loses it
        assertThat(row.getContext()).isNotNull();
        assertThat(row.getContext().weeks()).isNotEmpty();
    }

    // ── the real event path ─────────────────────────────────────────────────────

    @Test
    void testCloseMesocycle_shouldGenerateReviewAsync_whenRunCloses() {
        UUID owner = databasePopulator.populateUser("meso-review-e@test.local");
        MesocycleEntity run = twoWeekRunWithLifestyleData(owner);

        trainService.closeMesocycle(owner, run.getId(), "Jó blokk volt.");

        await().atMost(15, SECONDS).untilAsserted(() -> {
            MesocycleReportEntity row = reportRow(owner, run.getId());
            assertThat(row.getAiEvalStatus()).isEqualTo(MesocycleReportEntity.AI_EVAL_STATUS_READY);
            assertThat(row.getAiEval()).isEqualTo(FakeCompanionLlm.MESO_REVIEW_ANSWER);
            assertThat(row.getContext()).isNotNull();
            assertThat(row.getContext().weeks()).isNotEmpty();
        });
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    /**
     * A 2-week ACTIVE run started 7 days ago (so the window {@code [today-7, today+6]} splits into
     * exactly W1/W2) carrying one datapoint per context source in W1 and a single sleep row in W2 —
     * the honest-absence half of every assertion.
     */
    private MesocycleEntity twoWeekRunWithLifestyleData(UUID owner) {
        MesocycleEntity run =
            train.activeMesoStartedWeeksAgo(owner, 1, 2, 2, List.of("MEV", "MAV"));
        LocalDate start = run.getStartDate();

        sleepLogs.createSleepLog(owner, start.plusDays(1), new BigDecimal("7.5"), 4);
        sleepLogs.createSleepLog(owner, start.plusDays(2), new BigDecimal("8.0"), 5);
        sleepLogs.createSleepLog(owner, start.plusDays(7), new BigDecimal("6.5"), 3); // W2
        checkIns.createCheckIn(owner, start.plusDays(1), "08:00", 4, 2, null);
        waterLogs.createWaterLog(owner, start.plusDays(1), 2000);
        weightLogs.createWeightLog(owner, start.plusDays(1), new BigDecimal("90.0"));
        weightLogs.createWeightLog(owner, start.plusDays(2), new BigDecimal("89.5"));
        train.createSportSession(owner, start.plusDays(3)); // 90 min, rpe 6.8
        running.createRunLog(owner, running.createBlock(owner, "Futóblokk", "active").getId(),
            1, "tue-sprint", start.plusDays(4), 6, 8, null, null, 30);
        PantryItemEntity food = pantryItems.createFoodWithNutrients(owner, "Túró");
        meals.createPantryMeal(owner, food, start.plusDays(1));
        return run;
    }

    private MesocycleEntity titled(MesocycleEntity run, String title) {
        run.setTitle(title);
        return mesocycleRepository.saveAndFlush(run);
    }

    private MesocycleReportEntity reportRow(UUID owner, UUID mesoId) {
        return reportRepository.findByMesocycleIdAndCreatedByAndDeletedFalse(mesoId, owner)
            .orElseThrow();
    }
}
