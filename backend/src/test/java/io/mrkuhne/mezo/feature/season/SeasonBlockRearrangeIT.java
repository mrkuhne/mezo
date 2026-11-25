package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.feature.season.service.SeasonPreviewService;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/**
 * Évad spec §5.12-1 (mezo-r36n9.122): a gym-day change re-arranges the running block in the same accept — the
 * preview shows the block's new week, the fingerprint covers the block's days, and one apply moves goal, slots,
 * sleep need and block together.
 */
@Transactional
@Import(SeasonFixture.class)
class SeasonBlockRearrangeIT extends AbstractIntegrationTest {

    @Autowired private SeasonService seasonService;
    @Autowired private SeasonPreviewService previewService;
    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonTrainPort trainPort;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WorkoutSessionRepository sessionRepository;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private EntityManager em;

    private record Setup(UUID owner, SeasonEntity season, MesocycleEntity meso, Map<String, WorkoutSessionEntity> days) {
    }

    /** The fixture's season (gym hétfő, kedd, csütörtök, péntek) with a running upper/lower block on those days. */
    private Setup setup(String email) {
        UUID owner = fixture.owner(email);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        meso.setPhaseCurve(List.of("MEV", "MAV", "MAV", "MRV", "MRV", "Deload"));
        meso.setStartDate(LocalDate.now().minusWeeks(1));
        meso.setEndDate(LocalDate.now().plusWeeks(5));
        String[][] plan = {{"Hét", "Felső A", "chest"}, {"Kedd", "Alsó A", "quads"}, {"Csü", "Felső B", "back"},
            {"Pén", "Alsó B", "hamstrings"}};
        Map<String, WorkoutSessionEntity> days = new java.util.LinkedHashMap<>();
        for (int i = 0; i < plan.length; i++) {
            WorkoutSessionEntity d = trainPopulator.createWorkoutSession(owner, meso.getId(), plan[i][0], plan[i][1], i,
                "planned");
            trainPopulator.createExercise(owner, d.getId(), plan[i][1] + " 1", 0, plan[i][2], "compound", null);
            trainPopulator.createExercise(owner, d.getId(), plan[i][1] + " 2", 1, plan[i][2], "isolation", null);
            days.put(plan[i][1], d);
        }
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();
        return new Setup(owner, s, meso, days);
    }

    private static SeasonDraftJson gym(List<Integer> days) {
        return SeasonFixture.draft("cut", new BigDecimal("80.0"), null, days, SeasonFixture.SPORT);
    }

    private List<WorkoutSessionEntity> templateDays(Setup st) {
        em.flush();
        em.clear();
        return sessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(st.owner(), List.of(st.meso().getId()))
            .stream().filter(s -> s.getTemplateSessionId() == null).toList();
    }

    private List<String> exerciseNames(Setup st, UUID dayId) {
        return exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(st.owner(), List.of(dayId))
            .stream().map(ExerciseEntity::getName).toList();
    }

    @Test
    void previewShowsTheBlockWeek_whenTheGymDaysMove() {
        Setup st = setup("season-block-preview@test.local");

        SeasonPreviewService.Preview p = previewService.preview(st.owner(), st.season().getId(), gym(List.of(0, 1, 2, 3, 4)));

        assertThat(p.block()).isNotNull();
        assertThat(p.block().mesocycleId()).isEqualTo(st.meso().getId());
        assertThat(p.block().days()).hasSize(5);
        assertThat(p.block().days()).extracting(SeasonTrainPort.BlockDay::weekday).containsExactly(0, 1, 2, 3, 4);
        assertThat(p.block().days()).filteredOn(d -> d.change().equals("add")).hasSize(1);
        assertThat(p.block().dropped()).isEmpty();
        assertThat(p.after().gymPerWeek()).isEqualTo(5);
        assertThat(p.todo()).filteredOn(t -> t.key().equals("block")).singleElement()
            .satisfies(t -> assertThat(t.body()).startsWith("A futó blokkod napjai az új edzésnapokra kerülnek"));
    }

    @Test
    void previewHasNoBlockWeek_whenOnlyTheSportMoves() {
        Setup st = setup("season-block-sport@test.local");

        SeasonPreviewService.Preview p = previewService.preview(st.owner(), st.season().getId(),
            SeasonFixture.draft("cut", new BigDecimal("80.0"), null, SeasonFixture.GYM,
                List.of(new SeasonDraftJson.SportSlot(5, "10:00", 90, "volleyball"))));

        assertThat(p.block()).isNull();
    }

    @Test
    void applyWithMoreGymDays_addsTheChosenDayToTheBlock_inTheSameAccept() {
        Setup st = setup("season-block-more@test.local");
        SeasonDraftJson change = gym(List.of(0, 1, 2, 3, 4));
        SeasonPreviewService.Preview p = previewService.preview(st.owner(), st.season().getId(), change);
        SeasonTrainPort.BlockDay added = p.block().days().stream().filter(d -> d.change().equals("add")).findFirst()
            .orElseThrow();

        seasonService.apply(st.owner(), st.season().getId(), change, p.fingerprint());

        List<WorkoutSessionEntity> days = templateDays(st);
        assertThat(trainPort.currentSchedule(st.owner()).gymDays()).containsExactly(0, 1, 2, 3, 4);
        assertThat(days).extracting(WorkoutSessionEntity::getDayLabel).containsExactly("Hét", "Kedd", "Sze", "Csü", "Pén");
        assertThat(days).extracting(WorkoutSessionEntity::getOrderIndex).containsExactly(0, 1, 2, 3, 4);
        assertThat(days).extracting(WorkoutSessionEntity::getType)
            .containsExactlyElementsOf(p.block().days().stream().map(SeasonTrainPort.BlockDay::title).toList());
        WorkoutSessionEntity copy = days.get(added.weekday());
        assertThat(exerciseNames(st, copy.getId())).containsExactly(added.title() + " 1", added.title() + " 2");
        // the days that were already there keep their rows (and so their history)
        assertThat(days).extracting(WorkoutSessionEntity::getId)
            .containsAll(st.days().values().stream().map(WorkoutSessionEntity::getId).toList());
    }

    @Test
    void applyWithFewerGymDays_dropsOneDay_andMovesTheRest() {
        Setup st = setup("season-block-fewer@test.local");
        SeasonDraftJson change = gym(List.of(0, 2, 4));
        SeasonPreviewService.Preview p = previewService.preview(st.owner(), st.season().getId(), change);
        assertThat(p.block().dropped()).hasSize(1);

        seasonService.apply(st.owner(), st.season().getId(), change, p.fingerprint());

        List<WorkoutSessionEntity> days = templateDays(st);
        assertThat(days).extracting(WorkoutSessionEntity::getDayLabel).containsExactly("Hét", "Sze", "Pén");
        assertThat(days).extracting(WorkoutSessionEntity::getType)
            .doesNotContain(p.block().dropped().get(0).title());
        assertThat(exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(st.owner(),
            List.of(st.days().get(p.block().dropped().get(0).title()).getId()))).isEmpty();
    }

    @Test
    void applyWithTheSameCount_relabelsTheDaysInOrder_keepingTheirRows() {
        Setup st = setup("season-block-move@test.local");
        SeasonDraftJson change = gym(List.of(0, 2, 3, 5));
        SeasonPreviewService.Preview p = previewService.preview(st.owner(), st.season().getId(), change);

        seasonService.apply(st.owner(), st.season().getId(), change, p.fingerprint());

        Map<String, String> labelByTitle = templateDays(st).stream()
            .collect(Collectors.toMap(WorkoutSessionEntity::getType, WorkoutSessionEntity::getDayLabel));
        assertThat(labelByTitle).containsExactlyInAnyOrderEntriesOf(
            Map.of("Felső A", "Hét", "Alsó A", "Sze", "Felső B", "Csü", "Alsó B", "Szo"));
        assertThat(exerciseNames(st, st.days().get("Alsó A").getId())).containsExactly("Alsó A 1", "Alsó A 2");
    }

    @Test
    void fingerprintCoversTheBlockDays() {
        Setup st = setup("season-block-stale@test.local");
        SeasonDraftJson change = gym(List.of(0, 1, 2, 3, 4));
        String fingerprint = previewService.preview(st.owner(), st.season().getId(), change).fingerprint();
        ExerciseEntity row = exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(st.owner(),
            List.of(st.days().get("Felső A").getId())).get(0);
        row.setWorkingSets(5); // the block was edited in the day editor after the preview
        exerciseRepository.saveAndFlush(row);

        assertThatThrownBy(() -> seasonService.apply(st.owner(), st.season().getId(), change, fingerprint))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessage()).isEqualTo("SEASON_PREVIEW_STALE"));
    }

    @Test
    void droppingADayWhoseWorkoutRuns_isRefused() {
        Setup st = setup("season-block-running@test.local");
        st.days().values().forEach(d -> trainPopulator.startInstance(st.owner(), d.getId()));
        SeasonDraftJson change = gym(List.of(0, 2, 4));
        String fingerprint = previewService.preview(st.owner(), st.season().getId(), change).fingerprint();

        assertThatThrownBy(() -> seasonService.apply(st.owner(), st.season().getId(), change, fingerprint))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getMessage()).isEqualTo("TRAIN_DAY_WORKOUT_RUNNING");
                assertThat(e.getStatus().value()).isEqualTo(409);
            });
    }

    @Test
    void noGymDayWhileTheBlockRuns_isAWarningInThePreview_andRefusedOnApply() {
        Setup st = setup("season-block-noday@test.local");
        SeasonDraftJson change = gym(List.of());
        SeasonPreviewService.Preview p = previewService.preview(st.owner(), st.season().getId(), change);

        assertThat(p.block()).isNull();
        assertThat(p.warnings()).extracting(SeasonPreviewService.Warning::key).contains("block_no_day");
        assertThatThrownBy(() -> seasonService.apply(st.owner(), st.season().getId(), change, p.fingerprint()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getMessage()).isEqualTo("SEASON_BLOCK_NEEDS_GYM_DAY"));
    }
}
