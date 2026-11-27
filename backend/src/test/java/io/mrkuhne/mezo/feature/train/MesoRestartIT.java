package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MesocycleRestartRequest;
import io.mrkuhne.mezo.api.dto.MesocycleSettingsUpdateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.TrainingYearBlockRepository;
import io.mrkuhne.mezo.feature.train.service.YearGenerator;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.TrainingYearPlanPopulator;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * Restart and save-to-template of a running mesocycle (mezo-r36n9.177, spec §5.5): one transaction closes the run
 * with its report and stamps a new active run today from the run's CURRENT state; save-to-template overwrites the
 * run's template with that state. The atomic rollback is proven in {@code MesocycleRestartGateIT}.
 */
class MesoRestartIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MesoTemplatePopulator mesoTemplatePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private TrainingYearPlanPopulator yearPlanPopulator;
    @Autowired private TrainingYearBlockRepository yearBlockRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** Starts the populator template as the active run and replaces its first day with one edited exercise. */
    private MesocycleResponse startedAndEdited(MesoTemplateEntity template, HttpHeaders auth) {
        MesocycleResponse run = postForBody(TEMPLATES + "/" + template.getId() + "/start",
            MesoTemplateStartRequest.builder().startDate(LocalDate.now().minusWeeks(1))
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
        MesoDay first = listed(auth, run.getId()).getDays().get(0);
        putForBody(MESOCYCLES + "/" + run.getId() + "/days/" + first.getId() + "/exercises",
            List.of(GymExerciseInput.builder().name("Telefonon cserélt nyomás").muscle("chest")
                .warmupSets(1).workingSets(3).repMin(8).repMax(10).targetRIR(2)
                .type(GymExerciseInput.TypeEnum.COMPOUND).build()),
            auth, HttpStatus.OK, String.class);
        return run;
    }

    private MesocycleResponse listed(HttpHeaders auth, UUID id) {
        return getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class).stream()
            .filter(m -> m.getId().equals(id)).findFirst().orElseThrow();
    }

    private MesoTemplateResponse template(HttpHeaders auth, UUID id) {
        return getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
            .filter(t -> t.getId().equals(id)).findFirst().orElseThrow();
    }

    private static List<String> firstDayNames(List<MesoDay> days) {
        return days.get(0).getExercises().stream().map(GymExercise::getName).toList();
    }

    @Test
    void testRestart_shouldCloseOldAndStartNewFromCurrentState_whenActive() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse old = startedAndEdited(template, auth);

        MesocycleResponse fresh = postForBody(MESOCYCLES + "/" + old.getId() + "/restart", null, auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(fresh.getId()).isNotEqualTo(old.getId());
        assertThat(fresh.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        assertThat(fresh.getStartDate()).isEqualTo(LocalDate.now(ZoneId.of("Europe/Budapest")));
        assertThat(fresh.getCurrentWeek()).isEqualTo(1);
        assertThat(fresh.getTemplateId()).isEqualTo(template.getId());
        assertThat(firstDayNames(listed(auth, fresh.getId()).getDays())).containsExactly("Telefonon cserélt nyomás");

        MesocycleResponse closed = listed(auth, old.getId());
        assertThat(closed.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED);
        assertThat(closed.getClosedAt()).isNotNull();
        assertThat(closed.getHasReport()).isTrue();
        // The template is untouched without updateTemplate.
        assertThat(firstDayNames(template(auth, template.getId()).getDays()))
            .containsExactly("Bench Press", "Incline Bench Press");
    }

    @Test
    void testRestart_shouldOverwriteTemplate_whenUpdateTemplateTrue() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse old = startedAndEdited(template, auth);

        postForBody(MESOCYCLES + "/" + old.getId() + "/restart",
            MesocycleRestartRequest.builder().updateTemplate(true).build(), auth, HttpStatus.OK, MesocycleResponse.class);

        MesoTemplateResponse t = template(auth, template.getId());
        assertThat(firstDayNames(t.getDays())).containsExactly("Telefonon cserélt nyomás");
        assertThat(t.getRunCount()).isEqualTo(2);
    }

    @Test
    void testRestart_shouldMaterializeTemplate_whenLegacyRun() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Legacy mezociklus", "active");
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, legacy.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(owner, day.getId(), "Régi húzás", 0);
        HttpHeaders auth = ownerAuthHeaders();

        MesocycleResponse fresh = postForBody(MESOCYCLES + "/" + legacy.getId() + "/restart", null, auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(fresh.getTemplateId()).isNotNull();
        assertThat(listed(auth, legacy.getId()).getTemplateId()).isEqualTo(fresh.getTemplateId());
        assertThat(firstDayNames(listed(auth, fresh.getId()).getDays())).containsExactly("Régi húzás");
    }

    @Test
    void testRestart_shouldReturn409_whenRunArchived() {
        UUID owner = ownerId();
        MesocycleEntity archived = trainPopulator.createMesocycle(owner, "Lezárt", "archived");
        HttpHeaders auth = ownerAuthHeaders();

        String body = postForBody(MESOCYCLES + "/" + archived.getId() + "/restart", null, auth,
            HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "TRAIN_MESO_NOT_ACTIVE");
        assertThat(getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class)).hasSize(1);
    }

    @Test
    void testRestart_shouldReturn409_whenRunPlanned() {
        UUID owner = ownerId();
        MesocycleEntity planned = trainPopulator.createMesocycle(owner, "Tervezett", "planned");
        HttpHeaders auth = ownerAuthHeaders();

        String body = postForBody(MESOCYCLES + "/" + planned.getId() + "/restart", null, auth,
            HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "TRAIN_MESO_NOT_ACTIVE");
        // (A past-dated planned run is activated lazily on the next read — decision #106 — so only count rows.)
        assertThat(getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class)).hasSize(1);
    }

    @Test
    void testRestart_shouldReturn404_whenForeignOwner() {
        ownerId();
        UUID stranger = databasePopulator.populateUser("restart-stranger@test.local");
        MesocycleEntity foreign = trainPopulator.createMesocycle(stranger, "Idegen", "active");

        postForBody(MESOCYCLES + "/" + foreign.getId() + "/restart", null, ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testRestart_shouldKeepWeeklyReviewMode() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse old = startedAndEdited(template, auth);
        putForBody(MESOCYCLES + "/" + old.getId() + "/settings",
            MesocycleSettingsUpdateRequest.builder().weeklyReviewMode("manual").build(), auth, HttpStatus.OK, String.class);

        MesocycleResponse fresh = postForBody(MESOCYCLES + "/" + old.getId() + "/restart", null, auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(listed(auth, fresh.getId()).getWeeklyReviewMode()).hasToString("manual");
    }

    @Test
    void testSaveToTemplate_shouldOverwriteTemplateWithRunState_andLeaveRunUntouched() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse run = startedAndEdited(template, auth);

        MesoRerunResponse saved = postForBody(MESOCYCLES + "/" + run.getId() + "/save-to-template", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);
        MesoRerunResponse again = postForBody(MESOCYCLES + "/" + run.getId() + "/save-to-template", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        assertThat(saved.getTemplateId()).isEqualTo(template.getId()).isEqualTo(again.getTemplateId());
        assertThat(firstDayNames(template(auth, template.getId()).getDays())).containsExactly("Telefonon cserélt nyomás");
        MesocycleResponse still = listed(auth, run.getId());
        assertThat(still.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        assertThat(still.getTemplateId()).isEqualTo(template.getId());
    }

    @Test
    void testSaveToTemplate_shouldCreateAndLink_whenLegacyRun() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Legacy mezociklus", "active");
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, legacy.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(owner, day.getId(), "Régi húzás", 0);
        HttpHeaders auth = ownerAuthHeaders();

        MesoRerunResponse saved = postForBody(MESOCYCLES + "/" + legacy.getId() + "/save-to-template", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        assertThat(listed(auth, legacy.getId()).getTemplateId()).isEqualTo(saved.getTemplateId());
        assertThat(firstDayNames(template(auth, saved.getTemplateId()).getDays())).containsExactly("Régi húzás");
    }

    @Test
    void testSaveToTemplate_shouldReturn409_whenArchived() {
        UUID owner = ownerId();
        MesocycleEntity archived = trainPopulator.createMesocycle(owner, "Lezárt", "archived");

        String body = postForBody(MESOCYCLES + "/" + archived.getId() + "/save-to-template", null, ownerAuthHeaders(),
            HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "TRAIN_MESO_NOT_ACTIVE");
    }

    /**
     * Review Focus (Task 2 ruling): the restarted run keeps the old run's year block, even when the NEXT planned block
     * starts nearer to today than the old block did (5 weeks into a 6-week block, the next starts in a week).
     */
    @Test
    void testRestart_shouldRelinkSameYearBlock_whenNextBlockIsNearer() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Budapest"));
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(5);
        TrainingYearPlanEntity plan = yearPlanPopulator.plan(owner, monday, "back+biceps", "quad+glute");
        List<TrainingYearBlockEntity> blocks = yearBlockRepository.findByPlanIdAndDeletedFalseOrderByOrdinalAsc(plan.getId());
        MesocycleResponse old = postForBody(TEMPLATES + "/" + template.getId() + "/start",
            MesoTemplateStartRequest.builder().startDate(monday).status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
        // The state of a run that was linked when it started 5 weeks ago (a start in the past is not linked).
        TrainingYearBlockEntity linked = yearBlockRepository.findById(blocks.get(0).getId()).orElseThrow();
        linked.setMesocycleId(old.getId());
        linked.setStatus(YearGenerator.RUNNING);
        yearBlockRepository.saveAndFlush(linked);

        MesocycleResponse fresh = postForBody(MESOCYCLES + "/" + old.getId() + "/restart", null, auth,
            HttpStatus.OK, MesocycleResponse.class);

        TrainingYearBlockEntity first = yearBlockRepository.findById(blocks.get(0).getId()).orElseThrow();
        TrainingYearBlockEntity next = yearBlockRepository.findById(blocks.get(1).getId()).orElseThrow();
        assertThat(first.getMesocycleId()).isEqualTo(fresh.getId());
        assertThat(first.getStatus()).isEqualTo(YearGenerator.RUNNING);
        assertThat(next.getMesocycleId()).isNull();
        assertThat(next.getStatus()).isEqualTo(YearGenerator.PLANNED);
        assertThat(yearBlockRepository.findByCreatedByAndMesocycleIdAndDeletedFalse(owner, old.getId())).isEmpty();
    }
}
