package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.DayEvaluationResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import io.mrkuhne.mezo.feature.companion.entity.DayReviewEntity;
import io.mrkuhne.mezo.feature.companion.repository.DayReviewRepository;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayInputs;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.ObjectMapper;

/**
 * The lazy, clamped, cached prose layer over the deterministic day evaluation (mezo-jcpt.4,
 * task 8). The {@link DayEvaluationEngine} is a REAL instance here (its 27 unit tests own the
 * math); what this test pins is everything AROUND it:
 *
 * <ul>
 *   <li>the cache actually caches — a second read with unchanged inputs makes ZERO further LLM
 *       calls (the fake port counts them, so a lost cache cannot pass);</li>
 *   <li>an {@code inputsHash} mismatch regenerates — one more call, and the row is rewritten;</li>
 *   <li>the clamp is real: {@code delta: 9} reaches the response as {@code +5}, and {@code base}
 *       stays visible next to the corrected {@code score};</li>
 *   <li>an adjustment with no reason is DISCARDED entirely, never defaulted to a bare delta;</li>
 *   <li>a throwing port yields the full deterministic evaluation with an EMPTY narrative — the
 *       never-5xx rule, at the only level that can enforce it.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DayReviewServiceTest {

    private static final UUID USER = UUID.randomUUID();
    /** Deliberately in the past so the day is CLOSED — prose exists only for closed, scored days. */
    private static final LocalDate DAY = LocalDate.of(2026, 6, 15);

    @Mock private DayScoreService dayScoreService;
    @Mock private DayReviewRepository dayReviewRepository;
    @Mock private MetricSeriesService metricSeriesService;
    @Mock private WeightTrendService weightTrendService;

    private final DayEvaluationProperties props = new DayEvaluationProperties(
        new DayEvaluationProperties.Weights(0.30, 0.15, 0.20, 0.15, 0.10, 0.10),
        new DayEvaluationProperties.NutritionBands(0.10, 0.05, 3.0, 0.05, 2.5, 0.15, 1.5),
        150, 7.5, 7, 3, 120);

    /** Counts every completion so a silently-lost cache cannot pass a cache test. */
    private static final class FakeDayReviewLlm implements DayReviewLlm {
        private int calls;
        private String answer;
        private RuntimeException failure;
        private String lastUserMessage;

        @Override
        public String complete(String systemPrompt, String userMessage) {
            calls++;
            lastUserMessage = userMessage;
            if (failure != null) {
                throw failure;
            }
            return answer;
        }
    }

    /** Fluent {@link DayInputs} fixture (same pattern as {@code DayEvaluationEngineTest}'s
     *  {@code DayInputsBuilder}), introduced to retire the 6 raw positional {@code new
     *  DayInputs(...)} call sites this file used to carry — a 19-component positional record is
     *  exactly where an argument-order bug hides (mezo-jcpt.8). {@link #from} seeds every field
     *  from an existing instance so a test that only changes one or two fields (e.g. a
     *  retroactive sleep correction) states just that delta instead of repeating the whole row. */
    private static final class DayInputsBuilder {
        private LocalDate date;
        private boolean closed;
        private Double kcal;
        private Double proteinG;
        private Double carbsG;
        private Double fatG;
        private Double kcalTarget;
        private Double proteinTargetG;
        private Double carbsTargetG;
        private Double fatTargetG;
        private boolean workoutDay;
        private Integer plannedWorkouts;
        private Integer doneWorkouts;
        private Double sleepH;
        private Integer sleepQuality1to10;
        private List<DayEvaluationEngine.MealLogFact> meals = List.of();
        private boolean waterLogged;
        private int checkinCount;
        private Double weightKg;
        private Integer xp;
        private List<Integer> priorBaseScores = List.of();

        static DayInputsBuilder from(DayInputs in) {
            DayInputsBuilder b = new DayInputsBuilder();
            b.date = in.date();
            b.closed = in.closed();
            b.kcal = in.kcal();
            b.proteinG = in.proteinG();
            b.carbsG = in.carbsG();
            b.fatG = in.fatG();
            b.kcalTarget = in.kcalTarget();
            b.proteinTargetG = in.proteinTargetG();
            b.carbsTargetG = in.carbsTargetG();
            b.fatTargetG = in.fatTargetG();
            b.workoutDay = in.workoutDay();
            b.plannedWorkouts = in.plannedWorkouts();
            b.doneWorkouts = in.doneWorkouts();
            b.sleepH = in.sleepH();
            b.sleepQuality1to10 = in.sleepQuality1to10();
            b.meals = in.meals();
            b.waterLogged = in.waterLogged();
            b.checkinCount = in.checkinCount();
            b.weightKg = in.weightKg();
            b.xp = in.xp();
            b.priorBaseScores = in.priorBaseScores();
            return b;
        }

        DayInputsBuilder date(LocalDate v) {
            this.date = v;
            return this;
        }

        DayInputsBuilder closed(boolean v) {
            this.closed = v;
            return this;
        }

        DayInputsBuilder kcal(Double v) {
            this.kcal = v;
            return this;
        }

        DayInputsBuilder proteinG(Double v) {
            this.proteinG = v;
            return this;
        }

        DayInputsBuilder carbsG(Double v) {
            this.carbsG = v;
            return this;
        }

        DayInputsBuilder fatG(Double v) {
            this.fatG = v;
            return this;
        }

        DayInputsBuilder kcalTarget(Double v) {
            this.kcalTarget = v;
            return this;
        }

        DayInputsBuilder proteinTargetG(Double v) {
            this.proteinTargetG = v;
            return this;
        }

        DayInputsBuilder carbsTargetG(Double v) {
            this.carbsTargetG = v;
            return this;
        }

        DayInputsBuilder fatTargetG(Double v) {
            this.fatTargetG = v;
            return this;
        }

        DayInputsBuilder workoutDay(boolean v) {
            this.workoutDay = v;
            return this;
        }

        DayInputsBuilder plannedWorkouts(Integer v) {
            this.plannedWorkouts = v;
            return this;
        }

        DayInputsBuilder doneWorkouts(Integer v) {
            this.doneWorkouts = v;
            return this;
        }

        DayInputsBuilder sleepH(Double v) {
            this.sleepH = v;
            return this;
        }

        DayInputsBuilder sleepQuality1to10(Integer v) {
            this.sleepQuality1to10 = v;
            return this;
        }

        DayInputsBuilder meals(List<DayEvaluationEngine.MealLogFact> v) {
            this.meals = v;
            return this;
        }

        DayInputsBuilder waterLogged(boolean v) {
            this.waterLogged = v;
            return this;
        }

        DayInputsBuilder checkinCount(int v) {
            this.checkinCount = v;
            return this;
        }

        DayInputsBuilder priorBaseScores(List<Integer> v) {
            this.priorBaseScores = v;
            return this;
        }

        DayInputsBuilder weightKg(Double v) {
            this.weightKg = v;
            return this;
        }

        DayInputsBuilder xp(Integer v) {
            this.xp = v;
            return this;
        }

        DayInputs build() {
            return new DayInputs(date, closed, kcal, proteinG, carbsG, fatG,
                kcalTarget, proteinTargetG, carbsTargetG, fatTargetG, workoutDay,
                plannedWorkouts, doneWorkouts, sleepH, sleepQuality1to10, meals,
                waterLogged, checkinCount, weightKg, xp, priorBaseScores);
        }
    }

    private final FakeDayReviewLlm fakeLlm = new FakeDayReviewLlm();
    /** The single in-memory day_review row — the repository mock reads and writes through it. */
    private final AtomicReference<DayReviewEntity> stored = new AtomicReference<>();

    private DayReviewService service;
    /** A dense, fully-scoreable closed day; individual tests mutate it before calling. */
    private DayInputs inputs;

    @BeforeEach
    void setUp() {
        inputs = denseClosedDay();
        when(dayScoreService.inputsFor(eq(USER), eq(DAY), any())).thenAnswer(i -> inputs);
        when(dayReviewRepository.findByCreatedByAndDate(USER, DAY))
            .thenAnswer(i -> Optional.ofNullable(stored.get()));
        when(dayReviewRepository.save(any(DayReviewEntity.class))).thenAnswer(i -> {
            DayReviewEntity e = i.getArgument(0);
            // The real repository assigns the row's id on first insert (@GeneratedValue) — this
            // mock mirrors that so reviewId tests can observe a real, stable id (mezo-jcpt.9).
            if (e.getId() == null) {
                e.setId(UUID.randomUUID());
            }
            stored.set(e);
            return e;
        });
        when(metricSeriesService.series(any(), any(), any(), any())).thenReturn(Map.of());
        when(weightTrendService.computeTrend(USER)).thenReturn(null);

        ObjectProvider<DayReviewLlm> provider = provider(fakeLlm);
        service = new DayReviewService(dayScoreService, new DayEvaluationEngine(props),
            dayReviewRepository, metricSeriesService, weightTrendService, props,
            provider, new ObjectMapper(), new LlmCallContextHolder());
    }

    // --- (a) generate once, then serve from cache --------------------------------------------

    @Test
    void testAssemble_shouldGenerateThenServeFromCache_whenInputsUnchanged() {
        fakeLlm.answer = answer("""
            {"narrative":["Első.","Második."],
             "dimensionNotes":{"nutrition":"Szép fehérje."},
             "highlights":[{"kind":"win","label":"Edzés kész"}],
             "adjustment":null}""");

        DayEvaluationResponse first = service.assemble(USER, DAY);
        assertThat(first.getNarrative()).containsExactly("Első.", "Második.");
        assertThat(fakeLlm.calls).isEqualTo(1);
        assertThat(stored.get()).isNotNull();

        DayEvaluationResponse second = service.assemble(USER, DAY);
        assertThat(second.getNarrative()).containsExactly("Első.", "Második.");
        assertThat(second.getHighlights()).singleElement()
            .satisfies(h -> assertThat(h.getLabel()).isEqualTo("Edzés kész"));
        assertThat(second.getDimensions()).extracting("id")
            .containsExactly("nutrition", "quality", "training", "sleep", "logging", "rhythm");
        assertThat(second.getDimensions().getFirst().getNote()).isEqualTo("Szép fehérje.");
        // THE assertion of this test: the second read asked the model NOTHING.
        assertThat(fakeLlm.calls).isEqualTo(1);
    }

    @Test
    void testAssemble_shouldNormalizeHighlightKinds_whenTheModelInventsOne() {
        fakeLlm.answer = answer("""
            {"narrative":["Kiemelések."],"dimensionNotes":{},
             "highlights":[{"kind":"WIN","label":"Edzés kész"},
                           {"kind":"sparkle","label":"Kitalált fajta"},
                           {"kind":"","label":"Üres fajta"},
                           {"kind":"pattern","label":"Negyedik — el kell dobni"}],
             "adjustment":null}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        // capped at three, and every kind is one the day page knows how to colour
        assertThat(response.getHighlights()).extracting("kind", "label").containsExactly(
            org.assertj.core.groups.Tuple.tuple("win", "Edzés kész"),
            org.assertj.core.groups.Tuple.tuple("key", "Kitalált fajta"),
            org.assertj.core.groups.Tuple.tuple("key", "Üres fajta"));
    }

    // --- reviewId (mezo-jcpt.9): the feedback chips' artifact id -----------------------------

    /** The house pattern: the artifact id IS the artifact's own row id — never a natural key. */
    @Test
    void testAssemble_shouldCarryTheRowIdAsReviewId_afterFirstGeneration() {
        fakeLlm.answer = answer("""
            {"narrative":["Első."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getReviewId()).isNotNull();
        assertThat(response.getReviewId()).isEqualTo(stored.get().getId());
    }

    /** A cache hit must serve the SAME row's id, not a fresh one — voting on a cached narrative
     *  must not move the target out from under an already-cast vote. */
    @Test
    void testAssemble_shouldServeTheSameReviewId_whenServedFromCache() {
        fakeLlm.answer = answer("""
            {"narrative":["Első."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");

        UUID first = service.assemble(USER, DAY).getReviewId();
        UUID second = service.assemble(USER, DAY).getReviewId();

        assertThat(second).isEqualTo(first);
        assertThat(fakeLlm.calls).isEqualTo(1);
    }

    /** The row is rewritten IN PLACE on a hash change (the {@code existing} branch of upsert) —
     *  so the id stays stable even across a regenerate, exactly like the real one-row-per-day
     *  partial unique index guarantees. */
    @Test
    void testAssemble_shouldKeepTheSameReviewId_acrossARegenerate() {
        fakeLlm.answer = answer("""
            {"narrative":["Régi."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");
        UUID before = service.assemble(USER, DAY).getReviewId();

        // A builderen keresztül (mezo-jcpt.8): a DayInputs pozicionális rekord, és a
        // weightKg/xp felvétele óta egy nyers `new DayInputs(...)` másolat csendben elcsúszna.
        inputs = DayInputsBuilder.from(inputs).closed(true).sleepH(4.0).sleepQuality1to10(3).build();
        fakeLlm.answer = answer("""
            {"narrative":["Új."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");

        UUID after = service.assemble(USER, DAY).getReviewId();

        assertThat(after).isEqualTo(before);
    }

    /** No prose, no artifact, no chips — the house rule: an absent narrative means an absent id,
     *  never a dangling one the FE could try to vote on. */
    @Test
    void testAssemble_shouldHaveNoReviewId_whenAnswerIsGarbage() {
        fakeLlm.answer = "ez nem json egyáltalán";

        assertThat(service.assemble(USER, DAY).getReviewId()).isNull();
    }

    @Test
    void testAssemble_shouldHaveNoReviewId_whenPortAbsent() {
        service = new DayReviewService(dayScoreService, new DayEvaluationEngine(props),
            dayReviewRepository, metricSeriesService, weightTrendService, props,
            provider(null), new ObjectMapper(), new LlmCallContextHolder());

        assertThat(service.assemble(USER, DAY).getReviewId()).isNull();
    }

    @Test
    void testAssemble_shouldHaveNoReviewId_whenDayIsNotScored() {
        LocalDate today = LocalDate.now();
        DayInputs open = openDay(today);
        when(dayScoreService.inputsFor(eq(USER), eq(today), any())).thenReturn(open);

        assertThat(service.assemble(USER, today).getReviewId()).isNull();
    }

    // --- (b) an inputs change regenerates -----------------------------------------------------

    @Test
    void testAssemble_shouldRegenerate_whenInputsHashChanged() {
        fakeLlm.answer = answer("""
            {"narrative":["Régi."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");
        service.assemble(USER, DAY);
        assertThat(fakeLlm.calls).isEqualTo(1);
        String hashBefore = stored.get().getInputsHash();

        // The day's numbers moved (a retroactively logged sleep) -> the cached prose is stale.
        inputs = DayInputsBuilder.from(inputs).sleepH(4.0).sleepQuality1to10(3).build();
        fakeLlm.answer = answer("""
            {"narrative":["Új."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");

        DayEvaluationResponse regenerated = service.assemble(USER, DAY);

        assertThat(fakeLlm.calls).isEqualTo(2);
        assertThat(regenerated.getNarrative()).containsExactly("Új.");
        assertThat(stored.get().getInputsHash()).isNotEqualTo(hashBefore);
    }

    /**
     * The facts are IN the key (review round 2, Minor). Dimension scores are integers 0..100, so a
     * retroactively corrected macro can move a fact the narrative quotes ("300 g · 80 g" ->
     * "320 g · 80 g") while leaving every dimension score, status and the base untouched. A
     * score-only key would keep serving prose quoting the old grams.
     */
    @Test
    void testAssemble_shouldRegenerate_whenOnlyAFactMovedAndNoScoreDid() {
        fakeLlm.answer = answer("""
            {"narrative":["300 g szenhidrat."],"dimensionNotes":{},"highlights":[],
             "adjustment":null}""");
        DayEvaluationResponse before = service.assemble(USER, DAY);
        assertThat(fakeLlm.calls).isEqualTo(1);
        String hashBefore = stored.get().getInputsHash();

        // carbs 300 -> 320 g against a 300 g target: still inside the .15 carb/fat band, so
        // carbFatFit stays 1.0 and nutrition stays 100 -- only the "c · f" FACT moved.
        inputs = DayInputsBuilder.from(inputs).carbsG(320.0).build();
        fakeLlm.answer = answer("""
            {"narrative":["320 g szenhidrat."],"dimensionNotes":{},"highlights":[],
             "adjustment":null}""");

        DayEvaluationResponse after = service.assemble(USER, DAY);

        // no score, status or base moved -- the fact alone did
        assertThat(after.getBase()).isEqualTo(before.getBase());
        assertThat(after.getDimensions()).extracting("id", "score", "status")
            .containsExactlyElementsOf(before.getDimensions().stream()
                .map(d -> org.assertj.core.groups.Tuple.tuple(d.getId(), d.getScore(), d.getStatus()))
                .toList());
        assertThat(stored.get().getInputsHash()).isNotEqualTo(hashBefore);
        assertThat(fakeLlm.calls).isEqualTo(2);
        assertThat(after.getNarrative()).containsExactly("320 g szenhidrat.");
    }

    // --- (c) the clamp is real ----------------------------------------------------------------

    @Test
    void testAssemble_shouldClampDelta_whenModelAsksForNine() {
        fakeLlm.answer = answer("""
            {"narrative":["Refeed nap."],"dimensionNotes":{},"highlights":[],
             "adjustment":{"delta":9,"reason":"Edzésnapi refeed, a kcal-túllépés szándékos."}}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getAdjustment()).isNotNull();
        assertThat(response.getAdjustment().getDelta()).isEqualTo(5);
        assertThat(response.getBase()).isNotNull();
        // base stays visible on its own; the correction is never silently folded in
        assertThat(response.getScore())
            .isEqualTo(Math.min(100, response.getBase() + 5));
    }

    @Test
    void testAssemble_shouldClampDelta_whenModelAsksForMinusNine() {
        fakeLlm.answer = answer("""
            {"narrative":["Betegnap."],"dimensionNotes":{},"highlights":[],
             "adjustment":{"delta":-9,"reason":"Betegnap-jel: a számok nem látják."}}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getAdjustment().getDelta()).isEqualTo(-5);
        assertThat(response.getScore()).isEqualTo(Math.max(0, response.getBase() - 5));
    }

    // --- (d) an adjustment with no reason is discarded ----------------------------------------

    @Test
    void testAssemble_shouldDiscardAdjustment_whenReasonMissing() {
        fakeLlm.answer = answer("""
            {"narrative":["Nincs indok."],"dimensionNotes":{},"highlights":[],
             "adjustment":{"delta":4}}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getAdjustment()).isNull();
        // discarded ENTIRELY — not defaulted to a bare delta on the score either
        assertThat(response.getScore()).isEqualTo(response.getBase());
        assertThat(response.getNarrative()).containsExactly("Nincs indok.");
    }

    @Test
    void testAssemble_shouldDiscardAdjustment_whenReasonBlank() {
        fakeLlm.answer = answer("""
            {"narrative":["Üres indok."],"dimensionNotes":{},"highlights":[],
             "adjustment":{"delta":3,"reason":"   "}}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getAdjustment()).isNull();
        assertThat(response.getScore()).isEqualTo(response.getBase());
    }

    // --- (e) never 5xx ------------------------------------------------------------------------

    @Test
    void testAssemble_shouldServeDeterministicWithEmptyNarrative_whenPortThrows() {
        fakeLlm.failure = new IllegalStateException("provider timeout");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getState()).isEqualTo("scored");
        assertThat(response.getBase()).isNotNull();
        assertThat(response.getScore()).isEqualTo(response.getBase());
        assertThat(response.getNarrative()).isEmpty();
        assertThat(response.getAdjustment()).isNull();
        assertThat(response.getDimensions()).hasSize(6);
        // a failed generation persists NOTHING — the next read retries rather than caching a lie
        assertThat(stored.get()).isNull();
    }

    @Test
    void testAssemble_shouldServeDeterministicWithEmptyNarrative_whenAnswerIsGarbage() {
        fakeLlm.answer = "ez nem json egyáltalán";

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getNarrative()).isEmpty();
        assertThat(response.getDimensions()).hasSize(6);
        assertThat(stored.get()).isNull();
    }

    @Test
    void testAssemble_shouldServeDeterministicWithEmptyNarrative_whenPortAbsent() {
        service = new DayReviewService(dayScoreService, new DayEvaluationEngine(props),
            dayReviewRepository, metricSeriesService, weightTrendService, props,
            provider(null), new ObjectMapper(), new LlmCallContextHolder());

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getState()).isEqualTo("scored");
        assertThat(response.getDimensions()).hasSize(6);
        assertThat(response.getNarrative()).isEmpty();
        assertThat(fakeLlm.calls).isZero();
    }

    // --- states -------------------------------------------------------------------------------

    @Test
    void testAssemble_shouldReportFuture_andAskNothing_whenDateIsAhead() {
        LocalDate ahead = LocalDate.now().plusDays(3);
        DayInputs open = openDay(ahead);
        when(dayScoreService.inputsFor(eq(USER), eq(ahead), any())).thenReturn(open);

        DayEvaluationResponse response = service.assemble(USER, ahead);

        assertThat(response.getState()).isEqualTo("future");
        assertThat(response.getScore()).isNull();
        assertThat(response.getBase()).isNull();
        assertThat(response.getDimensions()).hasSize(6);
        assertThat(fakeLlm.calls).isZero();
    }

    @Test
    void testAssemble_shouldReportInProgress_andAskNothing_whenDateIsToday() {
        LocalDate today = LocalDate.now();
        DayInputs open = openDay(today);
        when(dayScoreService.inputsFor(eq(USER), eq(today), any())).thenReturn(open);

        DayEvaluationResponse response = service.assemble(USER, today);

        assertThat(response.getState()).isEqualTo("in_progress");
        assertThat(response.getScore()).isNull();
        assertThat(fakeLlm.calls).isZero();
    }

    /**
     * The priors are deliberately NON-empty (review round 2, Important): with an empty prior list
     * `rhythm` degrades and the day trivially has one DONE dimension, which proves the gate only
     * for a brand-new user. A user with three scored days behind them has `rhythm` DONE on this
     * untouched day too -- and `rhythm` describes those OTHER days, so it must not open the gate.
     * Before the fix this exact input scored base = round(0.5*0 + 0.5*76) = 38 and rendered a full
     * scored page (LLM call included) for a day with nothing in it.
     */
    @Test
    void testAssemble_shouldReportEmpty_andAskNothing_whenNothingWasLogged() {
        inputs = new DayInputsBuilder()
            .date(DAY).closed(true)
            .kcalTarget(2600.0).proteinTargetG(160.0).carbsTargetG(300.0).fatTargetG(80.0)
            .priorBaseScores(List.of(70, 78, 80))
            .build();

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getState()).isEqualTo("empty");
        assertThat(response.getScore()).isNull();
        assertThat(fakeLlm.calls).isZero();
    }

    @Test
    void testAssemble_shouldReportThin_whenTooFewDimensionsHaveData() {
        // A single sleep log and nothing else: logging is DONE (a real, measured zero-effort day)
        // and sleep is DONE -> two dimensions, so this day IS scoreable; drop the sleep log to a
        // lone check-in instead, which leaves only logging DONE -> base null, but something WAS
        // logged, so the honest state is "thin", not "empty".
        inputs = new DayInputsBuilder()
            .date(DAY).closed(true)
            .kcalTarget(2600.0).proteinTargetG(160.0).carbsTargetG(300.0).fatTargetG(80.0)
            .checkinCount(1)
            .build();

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getState()).isEqualTo("thin");
        assertThat(response.getScore()).isNull();
        assertThat(fakeLlm.calls).isZero();
    }

    /**
     * The headline user-visible fix this task (`mezo-jcpt.8`) closes: before it, a day with
     * ONLY a morning weigh-in and nothing else looked exactly like a fully untouched day --
     * both read "empty". A logged weight IS a log, so this must read "thin" (something was
     * measured, just not enough dimensions for a base score), never "empty".
     */
    @Test
    void testAssemble_shouldReportThin_whenOnlyAWeighInWasLogged() {
        inputs = new DayInputsBuilder()
            .date(DAY).closed(true)
            .kcalTarget(2600.0).proteinTargetG(160.0).carbsTargetG(300.0).fatTargetG(80.0)
            .weightKg(74.2)
            .build();

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getState()).isEqualTo("thin");
        assertThat(response.getScore()).isNull();
        assertThat(fakeLlm.calls).isZero();
    }

    /**
     * The XP half of the same `mezo-jcpt.8` fix: a day with ONLY an XP grant and nothing else
     * logged must also read "thin", not "empty" -- an XP grant is a real, measured signal.
     */
    @Test
    void testAssemble_shouldReportThin_whenOnlyXpWasLogged() {
        inputs = new DayInputsBuilder()
            .date(DAY).closed(true)
            .kcalTarget(2600.0).proteinTargetG(160.0).carbsTargetG(300.0).fatTargetG(80.0)
            .xp(120)
            .build();

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getState()).isEqualTo("thin");
        assertThat(response.getScore()).isNull();
        assertThat(fakeLlm.calls).isZero();
    }

    // --- context signals ----------------------------------------------------------------------

    @Test
    void testAssemble_shouldCarryDeterministicContextSignals_intoResponseAndPrompt() {
        Map<LocalDate, Double> energy = new HashMap<>(Map.of(DAY, 6.5));
        Map<LocalDate, Double> sleepSeries = new HashMap<>(Map.of(
            DAY, 6.0, DAY.minusDays(1), 6.5, DAY.minusDays(2), 8.0));
        when(metricSeriesService.series(USER, MetricKey.CHECKIN_ENERGY, DAY, DAY))
            .thenReturn(energy);
        when(metricSeriesService.series(eq(USER), eq(MetricKey.SLEEP_DURATION_H), any(), any()))
            .thenReturn(sleepSeries);
        when(weightTrendService.computeTrend(USER)).thenReturn(
            io.mrkuhne.mezo.api.dto.WeightTrendResponse.builder()
                .weeklyRateKgPerWeek(new java.math.BigDecimal("-0.35")).build());
        fakeLlm.answer = answer("""
            {"narrative":["Kontextus."],"dimensionNotes":{},"highlights":[],"adjustment":null}""");

        DayEvaluationResponse response = service.assemble(USER, DAY);

        assertThat(response.getContext()).extracting("label", "value").contains(
            org.assertj.core.groups.Tuple.tuple("energia", "6.5 / 10"),
            org.assertj.core.groups.Tuple.tuple("súlytrend", "-0.35 kg/hét"),
            org.assertj.core.groups.Tuple.tuple("alvás cél alatt", "2 napja"));
        // the model is TOLD the signals — it never invents them
        assertThat(fakeLlm.lastUserMessage).contains("energia").contains("súlytrend")
            .contains("alvás cél alatt");
    }

    // --- helpers ------------------------------------------------------------------------------

    /** The model is free to wrap its JSON in prose — the parser finds the object either way. */
    private static String answer(String json) {
        return "Íme:\n" + json + "\nRemélem segít.";
    }

    private static ObjectProvider<DayReviewLlm> provider(DayReviewLlm port) {
        @SuppressWarnings("unchecked")
        ObjectProvider<DayReviewLlm> provider = org.mockito.Mockito.mock(ObjectProvider.class);
        org.mockito.Mockito.when(provider.getIfAvailable()).thenReturn(port);
        return provider;
    }

    /** Enough logged on a closed day that several dimensions are DONE and a base exists. */
    private static DayInputs denseClosedDay() {
        List<DayEvaluationEngine.MealLogFact> meals = new ArrayList<>();
        meals.add(new DayEvaluationEngine.MealLogFact("lunch",
            java.time.LocalTime.of(12, 30), java.time.LocalTime.of(12, 0), 0.9, 0.8, 1200));
        meals.add(new DayEvaluationEngine.MealLogFact("dinner",
            java.time.LocalTime.of(19, 10), java.time.LocalTime.of(19, 0), 0.8, 0.7, 1400));
        return new DayInputsBuilder()
            .date(DAY).closed(true)
            .kcal(2600.0).proteinG(160.0).carbsG(300.0).fatG(80.0)
            .kcalTarget(2600.0).proteinTargetG(160.0).carbsTargetG(300.0).fatTargetG(80.0)
            .workoutDay(true).plannedWorkouts(1).doneWorkouts(1)
            .sleepH(7.5).sleepQuality1to10(8)
            .meals(meals).waterLogged(true).checkinCount(4)
            .priorBaseScores(List.of(70, 75, 80, 78))
            .build();
    }

    private static DayInputs openDay(LocalDate date) {
        return new DayInputsBuilder()
            .date(date).closed(false)
            .kcalTarget(2600.0).proteinTargetG(160.0).carbsTargetG(300.0).fatTargetG(80.0)
            .build();
    }
}
