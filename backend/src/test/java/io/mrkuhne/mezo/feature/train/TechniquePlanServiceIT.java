package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.TrainingStyle;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.Technique;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanService;
import io.mrkuhne.mezo.feature.train.service.TechniquePlanner;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The planner snapshot and the run start's week-1 challenges (mezo-r36n9.81, T3 Task 3): a styled block with the
 * techniques flag gets each training day's challenge written on its run rows (source planner); an unstyled or
 * unflagged block gets nothing; an owner challenge keeps its day; a sport slot on the day's weekday moves the
 * challenge off a sport-loaded group. The draft projection plans the same way.
 */
class TechniquePlanServiceIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private TechniquePlanService planService;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private UUID catalog(String slug) {
        return catalogRepository.findBySlug(slug).orElseThrow().getId();
    }

    @Test
    void runStartPlacesWeekOneChallenges() {
        ownerId();
        MesocycleResponse run = startRun(TrainingStyle.BALANCED, true, null,
            day("Hét", pecDeck(), cableFly(), legExtension()));

        // the day's first stable + lengthened-friendly counting row is the challenge, written by the planner
        assertThat(challengeRows(run.getId())).containsExactly("Pec Deck|planner|null");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from exercise e join workout_session s on s.id = e.workout_session_id "
                + "where s.mesocycle_id = ? and e.technique is not null", Integer.class, run.getId())).isZero();
    }

    @Test
    void unstyledRunStartWritesNothing() {
        ownerId();
        MesocycleResponse run = startRun(null, true, null, day("Hét", pecDeck(), cableFly()));
        assertThat(challengeRows(run.getId())).isEmpty();
        assertThat(planService.projectRun(ownerId(), entity(run))).isEmpty();
    }

    @Test
    void flagOffRunStartWritesNothing() {
        ownerId();
        MesocycleResponse run = startRun(TrainingStyle.BALANCED, null, null, day("Hét", pecDeck(), cableFly()));
        assertThat(challengeRows(run.getId())).isEmpty();
        assertThat(planService.projectRun(ownerId(), entity(run))).isEmpty();
    }

    @Test
    void ownerChallengeDayGetsNoPlannerChallenge() {
        ownerId();
        GymExerciseInput ownerChallenge = cableFly();
        ownerChallenge.setChallenge(true);
        MesocycleResponse run = startRun(TrainingStyle.BALANCED, true, null,
            day("Hét", pecDeck(), ownerChallenge),
            day("Csü", pecDeck(), legExtension()));

        // day 1 keeps the owner's challenge only; day 2 gets the planner's
        assertThat(challengeRows(run.getId())).containsExactly("Cable Fly|owner|null", "Pec Deck|planner|null");
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from exercise e join workout_session s on s.id = e.workout_session_id "
                + "where s.mesocycle_id = ? and s.order_index = 0 and e.challenge", Integer.class, run.getId()))
            .isEqualTo(1);
    }

    @Test
    void sportDayFromScheduleSlot() {
        UUID owner = ownerId();
        trainPopulator.createScheduleSlot(owner, 0, "18:00", 90, "training"); // Hét
        MesocycleResponse run = startRun(TrainingStyle.BALANCED, true, List.of("chest"),
            day("Hét", pecDeck(), legExtension()),
            day("Kedd", pecDeck(), legExtension()));

        TechniquePlanner.Input in = planService.snapshotRun(owner, entity(run), 1, null);
        assertThat(in.days()).extracting(TechniquePlanner.PlanDay::sportDay).containsExactly(true, false);
        assertThat(in.sportGroups()).containsExactly("chest");
        // Hét: chest is sport-loaded on a sport day → the challenge moves to the quad row; Kedd: the chest row
        assertThat(challengeRows(run.getId())).containsExactly("Leg Extension|planner|null", "Pec Deck|planner|null");
    }

    @Test
    void snapshotRunUsesTheOverlayAndTheEvaluatorIndices() {
        UUID owner = ownerId();
        GymExerciseInput warmup = legExtension();
        warmup.setCountsTowardVolume(false);
        MesocycleResponse run = startRun(TrainingStyle.BALANCED, true, null, day("Hét", warmup, pecDeck(), cableFly()));
        UUID flyId = run.getDays().get(0).getExercises().get(2).getId();

        TechniquePlanner.Input in = planService.snapshotRun(owner, entity(run), 3, Map.of(flyId, 5));

        List<TechniquePlanner.PlanRow> rows = in.days().get(0).rows();
        assertThat(rows).extracting(TechniquePlanner.PlanRow::exerciseIndex).containsExactly(0, 1, 2);
        assertThat(rows.get(0).counts()).isFalse();
        assertThat(rows.get(2).id()).isEqualTo(flyId);
        assertThat(rows.get(2).workingSets()).isEqualTo(5);
        assertThat(rows.get(2).group()).isEqualTo("chest");
        assertThat(rows.get(2).attrs().equipment()).isEqualTo("cable");
        assertThat(rows.get(2).effectiveStyle()).isNotNull();
        assertThat(in.week()).isEqualTo(3);
        assertThat(in.deloadWeek()).isFalse();
        assertThat(planService.snapshotRun(owner, entity(run), 4, null).deloadWeek()).isTrue();
    }

    @Test
    void projectDraftPlansTechniquesFromWeekThree() {
        UUID owner = ownerId();
        MesoPlanEvaluateRequest flagged = draft(TrainingStyle.BALANCED, true);

        List<TechniquePlanner.Week> weeks = planService.projectDraft(owner, flagged);

        assertThat(weeks).hasSize(4);
        assertThat(weeks.get(0).techniques()).isEmpty();
        assertThat(weeks.get(0).challenges()).extracting(TechniquePlanner.Pick::exerciseIndex).containsExactly(0);
        assertThat(weeks.get(2).techniques()).extracting(TechniquePlanner.Pick::technique)
            .containsExactly(Technique.REST_DROP);
        assertThat(weeks.get(2).techniques().get(0).exerciseIndex()).isEqualTo(1);
        assertThat(weeks.get(3).techniques()).isEmpty(); // deload
        assertThat(weeks.get(3).challenges()).isEmpty();

        assertThat(planService.projectDraft(owner, draft(TrainingStyle.BALANCED, null))).isEmpty();
        assertThat(planService.projectDraft(owner, draft(null, true))).isEmpty();
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private io.mrkuhne.mezo.feature.train.entity.MesocycleEntity entity(MesocycleResponse run) {
        return mesocycleRepository.findById(run.getId()).orElseThrow();
    }

    /** "name|source|technique" of every challenge row of the run, by day then position. */
    private List<String> challengeRows(UUID runId) {
        return jdbcTemplate.queryForList(
            "select e.name || '|' || coalesce(e.technique_source, 'null') || '|' || coalesce(e.technique, 'null') "
                + "from exercise e join workout_session s on s.id = e.workout_session_id "
                + "where s.mesocycle_id = ? and s.template_session_id is null and e.challenge and not e.is_deleted "
                + "order by s.order_index, e.order_index", String.class, runId);
    }

    private MesocycleResponse startRun(TrainingStyle style, Boolean techniquesEnabled, List<String> sportGroups,
                                       MesoDayInput... days) {
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = MesoTemplateUpsertRequest.builder()
            .title("Terv sablon").shortTitle("Terv").goal("Hipertrófia").weeks(4)
            .split("Push · 2×/hét").style("RP · 4 hét").trainingStyle(style).techniquesEnabled(techniquesEnabled)
            .sportGroups(sportGroups)
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV, MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .volumePerMuscle(Map.of("chest", VolumeBaseline.builder()
                .name("RP guidelines · intermediate").mev(8).mav(14).mrv(20).build()))
            .days(List.of(days))
            .build();
        MesoTemplateResponse t = postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        return postForBody(TEMPLATES + "/" + t.getId() + "/start",
            MesoTemplateStartRequest.builder().startDate(LocalDate.now())
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
    }

    private MesoPlanEvaluateRequest draft(TrainingStyle style, Boolean techniquesEnabled) {
        return MesoPlanEvaluateRequest.builder().weeks(4).trainingStyle(style).techniquesEnabled(techniquesEnabled)
            .phaseCurve(List.of(MesoPlanEvaluateRequest.PhaseCurveEnum.MEV, MesoPlanEvaluateRequest.PhaseCurveEnum.MAV,
                MesoPlanEvaluateRequest.PhaseCurveEnum.MRV, MesoPlanEvaluateRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(day("Hét", pecDeck(), cableFly())))
            .build();
    }

    private static MesoDayInput day(String label, GymExerciseInput... exercises) {
        return MesoDayInput.builder().day(label).type("Push").muscle("chest").exercises(List.of(exercises)).build();
    }

    private GymExerciseInput pecDeck() {
        return ex("Pec Deck", "chest-mid", catalog("pec-deck"));
    }

    private GymExerciseInput cableFly() {
        return ex("Cable Fly", "chest-mid", catalog("cable-fly"));
    }

    private GymExerciseInput legExtension() {
        return ex("Leg Extension", "quad", catalog("leg-extension"));
    }

    private static GymExerciseInput ex(String name, String muscle, UUID catalogId) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(3)
            .repMin(8).repMax(12).targetRIR(1).type(GymExerciseInput.TypeEnum.ISOLATION).catalogId(catalogId).build();
    }
}
