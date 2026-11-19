package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.api.dto.WeekProposalLineDecision;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The AI refinement of a waiting weekly review (T4, {@code mezo-r36n9.82}): a styled, technique-flagged run in
 * manual review mode gets its planner technique lines refined by the {@link TechniqueLlm} port (mocked) — only valid
 * changes, reason {@code ai_suggested} plus the model's note, accepting writes source {@code ai}. A failing or empty
 * model, an already-decided technique line, auto mode or a run that does not opt in leave the planner's review as T3
 * made it.
 */
class TechniqueAiRefinerIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired TechniqueAiRefiner refiner;
    @Autowired WeekProposalService proposals;
    @Autowired WeekProposalDecisionService decisions;
    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseCatalogRepository catalogRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean TechniqueLlm llm;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("technique-ai-refiner@test.local");
    }

    /** Week-3 chest day: Pec Deck (the challenge) then Cable Fly (the planner's rest-drop), 3 sets each. */
    private record Chest(MesocycleEntity meso, ExerciseEntity pecDeck, ExerciseEntity cableFly) {}

    private Chest chest(String mode, boolean techniques) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 2, 6, NO_DELOAD);
        meso.setMusclePriorities(Map.of("chest", "emphasize"));
        meso.setTrainingStyle("balanced");
        meso.setTechniquesEnabled(techniques);
        meso.setWeeklyReviewMode(mode);
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), "Hét", "gym", 0, "active");
        return new Chest(meso, exercise(day, "Pec Deck", 0, "pec-deck"), exercise(day, "Cable Fly", 1, "cable-fly"));
    }

    private MesoWeekProposalEntity build(Chest c) {
        return new TransactionTemplate(transactionManager).execute(status ->
            proposals.build(owner, mesocycleRepository.findById(c.meso().getId()).orElseThrow(), 3).proposal());
    }

    private static TechniqueLlm.Suggestion flyToDrop(Chest c) {
        return new TechniqueLlm.Suggestion(
            List.of(new TechniqueLlm.Change(c.cableFly().getId(), "drop", "A kábeles tárogatáson a klasszikus drop jobban ment.")),
            List.of());
    }

    @Test
    void aiSwapBecomesAnAiLineWithItsNoteAndAcceptWritesTheAiSource() {
        Chest c = chest("manual", true);
        MesoWeekProposalEntity built = build(c);
        String challengeLineId = techniqueLines(built).stream().filter(l -> Boolean.TRUE.equals(l.challenge()))
            .findFirst().orElseThrow().id();
        when(llm.refine(any())).thenReturn(Optional.of(flyToDrop(c)));

        refiner.refine(owner, built.getId());

        MesoWeekProposalEntity p = proposalRepository.findById(built.getId()).orElseThrow();
        List<WeekProposalLineJson> lines = techniqueLines(p);
        assertThat(lines).hasSize(2);
        assertThat(lines).filteredOn(l -> l.exerciseId().equals(c.pecDeck().getId())).singleElement()
            .satisfies(l -> {
                assertThat(l.challenge()).isTrue();
                assertThat(l.id()).isEqualTo(challengeLineId);   // untouched line keeps its id
                assertThat(l.reasons()).containsExactly("challenge");
                assertThat(l.note()).isNull();
            });
        WeekProposalLineJson fly = lines.stream().filter(l -> l.exerciseId().equals(c.cableFly().getId()))
            .findFirst().orElseThrow();
        assertThat(fly.toTechnique()).isEqualTo("drop");
        assertThat(fly.from()).isEqualTo(3);
        assertThat(fly.to()).isEqualTo(2);
        assertThat(fly.reasons()).containsExactly("ai_suggested");
        assertThat(fly.note()).isEqualTo("A kábeles tárogatáson a klasszikus drop jobban ment.");
        // the request carried the code's frame
        ArgumentCaptor<TechniqueLlm.Request> req = ArgumentCaptor.forClass(TechniqueLlm.Request.class);
        verify(llm).refine(req.capture());
        assertThat(req.getValue().week()).isEqualTo(3);
        assertThat(req.getValue().days()).singleElement().satisfies(d -> assertThat(d.rows())
            .anySatisfy(r -> {
                assertThat(r.exerciseId()).isEqualTo(c.cableFly().getId());
                assertThat(r.eligible()).isTrue();
                assertThat(r.plannedTechnique()).isEqualTo("rest_drop");
            }));

        WeekProposal after = decisions.decide(owner, c.meso().getId(), p.getId(), new WeekProposalDecisionRequest()
            .decisions(List.of(new WeekProposalLineDecision().lineId(fly.id())
                .decision(WeekProposalLineDecision.DecisionEnum.ACCEPTED))));
        assertThat(after.getLines()).filteredOn(l -> l.getId().equals(fly.id())).singleElement()
            .satisfies(l -> assertThat(l.getNote()).isEqualTo(fly.note()));
        ExerciseEntity row = fresh(c.cableFly());
        assertThat(row.getTechnique()).isEqualTo("drop");
        assertThat(row.getTechniqueSource()).isEqualTo("ai");
        assertThat(row.getWorkingSets()).isEqualTo(2);
    }

    @Test
    void failingEmptyOrInvalidAnswersLeaveThePlannerReview() {
        Chest c = chest("manual", true);
        MesoWeekProposalEntity built = build(c);
        List<WeekProposalLineJson> before = techniqueLines(built);

        when(llm.refine(any())).thenThrow(new RuntimeException("429 no credits"));
        refiner.refine(owner, built.getId());
        doReturn(Optional.empty()).when(llm).refine(any());
        refiner.refine(owner, built.getId());
        // the Pec Deck is the challenge: no technique may join it
        doReturn(Optional.of(new TechniqueLlm.Suggestion(
            List.of(new TechniqueLlm.Change(c.pecDeck().getId(), "myo", "Nem lehet.")), List.of()))).when(llm).refine(any());
        refiner.refine(owner, built.getId());

        assertThat(techniqueLines(proposalRepository.findById(built.getId()).orElseThrow())).isEqualTo(before);
    }

    @Test
    void aDecidedTechniqueLineMeansTheAiResultIsDropped() {
        Chest c = chest("manual", true);
        MesoWeekProposalEntity built = build(c);
        WeekProposalLineJson challenge = techniqueLines(built).stream().filter(l -> Boolean.TRUE.equals(l.challenge()))
            .findFirst().orElseThrow();
        decisions.decide(owner, c.meso().getId(), built.getId(), new WeekProposalDecisionRequest()
            .decisions(List.of(new WeekProposalLineDecision().lineId(challenge.id())
                .decision(WeekProposalLineDecision.DecisionEnum.KEPT))));
        when(llm.refine(any())).thenReturn(Optional.of(flyToDrop(c)));

        refiner.refine(owner, built.getId());

        verify(llm, never()).refine(any());
        assertThat(techniqueLines(proposalRepository.findById(built.getId()).orElseThrow()))
            .noneMatch(l -> "ai_suggested".equals(l.reasons().get(0)));
    }

    @Test
    void manualWeekThroughGetTodayIsRefinedInTheBackground() {
        Chest c = chest("manual", true);
        when(llm.refine(any())).thenReturn(Optional.of(flyToDrop(c)));

        workoutService.getToday(owner, null);

        verify(llm, timeout(10_000)).refine(any());
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(techniqueLines(
                proposalRepository.findWeekly(owner, c.meso().getId(), 3).orElseThrow()))
            .anySatisfy(l -> assertThat(l.note()).isNotNull()));
    }

    @Test
    void autoModeAndRunsWithoutTechniquesNeverAskTheAi() {
        Chest auto = chest("auto", true);
        workoutService.getToday(owner, null);
        assertThat(proposalRepository.findWeekly(owner, auto.meso().getId(), 3).orElseThrow().getStatus())
            .isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);

        UUID other = databasePopulator.populateUser("technique-ai-refiner-2@test.local");
        owner = other;
        chest("manual", false);
        workoutService.getToday(owner, null);

        verify(llm, after(2_000).never()).refine(any());
    }

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, int order, String slug) {
        UUID catalogId = catalogRepository.findBySlug(slug).orElseThrow().getId();
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, order, "chest-mid", "isolation", catalogId);
        e.setWorkingSets(3);
        return train.save(e);
    }

    private static List<WeekProposalLineJson> techniqueLines(MesoWeekProposalEntity p) {
        return p.getLines().stream().filter(l -> WeekProposalLineJson.KIND_TECHNIQUE.equals(l.kind())).toList();
    }

    private ExerciseEntity fresh(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow();
    }
}
