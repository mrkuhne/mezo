package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.MesoTemplateService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop B6 Évad (mezo-r36n9.16, spec §5.12-5): no new training block without a season — every create / start path
 * (template start, re-run → start, planned → activate) refuses with 409 {@code SEASON_REQUIRED} unless a season is
 * active or a planned one starts within 7 days. A block already running is untouched. The test profile switches the
 * gate off for the rest of the suite; this class switches it back on.
 */
@Transactional
@Import(SeasonFixture.class)
@TestPropertySource(properties = "mezo.season.mesocycle-gate.enabled=true")
class MesocycleGateIT extends AbstractIntegrationTest {

    @Autowired private MesoTemplateService mesoTemplateService;
    @Autowired private TrainService trainService;
    @Autowired private WorkoutService workoutService;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private MesoTemplatePopulator templatePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonGoalPort goalPort;

    @Test
    void templateStartWithoutSeasonIs409() {
        UUID owner = databasePopulator.populateUser("gate-none@test.local");
        UUID template = templatePopulator.template(owner).getId();

        assertThatThrownBy(() -> start(owner, template, LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, e -> {
                assertThat(e.getMessage()).isEqualTo("SEASON_REQUIRED");
                assertThat(e.getStatus().value()).isEqualTo(409);
            });
        assertThat(mesocycleRepository.findByCreatedByAndDeletedFalseOrderByStartDateAsc(owner)).isEmpty();
    }

    @Test
    void templateStartWithPlannedSeasonIn5DaysPasses() {
        UUID owner = fixture.owner("gate-planned@test.local");
        SeasonDraftJson d = SeasonFixture.draft();
        fixture.plannedSeason(owner, new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), null, null,
            LocalDate.now().plusDays(5), d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(), d.allowedRecipeIds(),
            null));
        UUID template = templatePopulator.template(owner).getId();

        MesocycleResponse run = start(owner, template, LocalDate.now(), MesoTemplateStartRequest.StatusEnum.PLANNED);

        assertThat(run.getId()).isNotNull();
    }

    @Test
    void plannedSeasonTooFarAheadDoesNotOpenTheGate() {
        UUID owner = fixture.owner("gate-far@test.local");
        SeasonDraftJson d = SeasonFixture.draft();
        SeasonEntity far = fixture.plannedSeason(owner, new SeasonDraftJson(d.title(), d.trajectory(), new BigDecimal("80.0"),
            null, null, LocalDate.now().plusDays(10), d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(),
            d.allowedRecipeIds(), null));
        UUID template = templatePopulator.template(owner).getId();

        assertThat(far.getStartDate()).isAfter(LocalDate.now().plusDays(7));
        assertThatThrownBy(() -> start(owner, template, LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE))
            .hasMessage("SEASON_REQUIRED");
    }

    @Test
    void activatingAPlannedBlockWithoutSeasonIs409() {
        UUID owner = databasePopulator.populateUser("gate-activate@test.local");
        MesocycleEntity planned = trainPopulator.createMesocycle(owner, "Tervezett blokk", "planned");

        assertThatThrownBy(() -> trainService.activateMesocycle(owner, planned.getId())).hasMessage("SEASON_REQUIRED");
    }

    @Test
    void plannedBlockWithoutSeasonStaysPlanned() {
        UUID owner = databasePopulator.populateUser("gate-due-planned@test.local");
        MesocycleEntity planned = trainPopulator.createMesocycle(owner, "Esedékes blokk", "planned");
        assertThat(planned.getStartDate()).isBeforeOrEqualTo(LocalDate.now());

        // the today read starts due planned blocks, but never past the season gate — and never fails because of it
        workoutService.getToday(owner, null);

        assertThat(mesocycleRepository.findById(planned.getId()).orElseThrow().getStatus()).isEqualTo("planned");
    }

    @Test
    void runningMesocycleKeepsRunningWithoutSeason() {
        UUID owner = databasePopulator.populateUser("gate-running@test.local");
        MesocycleEntity running = trainPopulator.createActiveMeso(owner);

        MesocycleResponse again = trainService.activateMesocycle(owner, running.getId());

        assertThat(again.getStatus().getValue()).isEqualTo("active");
        assertThat(mesocycleRepository.findById(running.getId()).orElseThrow().getStatus()).isEqualTo("active");
    }

    @Test
    void activatingASeasonStartsItsTemplateBlockThroughTheGate() {
        UUID owner = fixture.owner("gate-season-template@test.local");
        UUID template = templatePopulator.template(owner).getId();
        SeasonDraftJson d = SeasonFixture.draft();
        SeasonEntity season = seasonService.create(owner, new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(),
            null, null, d.startDate(), d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(),
            d.allowedRecipeIds(), new SeasonDraftJson.Block("template", null, template)));

        SeasonEntity active = seasonService.activate(owner, season.getId());

        assertThat(mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active")).hasSize(1);
        UUID runId = mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").get(0).getId();
        assertThat(goalPort.linkedMesocycles(owner, active.getGoalId())).containsExactly(runId);
        assertThat(active.getDraft().block()).isEqualTo(new SeasonDraftJson.Block("adopt", runId, null));
    }

    private MesocycleResponse start(UUID owner, UUID template, LocalDate date, MesoTemplateStartRequest.StatusEnum status) {
        return mesoTemplateService.start(owner, template,
            MesoTemplateStartRequest.builder().startDate(date).status(status).build());
    }
}
