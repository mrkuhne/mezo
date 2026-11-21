package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.YearBlock;
import io.mrkuhne.mezo.api.dto.YearNext;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesoTemplateRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Year blocks follow their mesocycles (mezo-r36n9.113 Task 6): a template start links the explicit or the nearest
 * planned block within ±14 days, the block status is reconciled from the mesocycle on read, a planned block starts on
 * its day, and the plan says what comes next. The clock is pinned to Saturday 2026-11-21; the plan starts Monday
 * 2026-11-23, so with 6-week blocks block 1 is due 2026-11-23, block 2 2027-01-04, block 3 2027-02-15. All values
 * invented.
 */
@Import(YearPlanContractIT.PinnedClockConfig.class)
class YearPlanLinkContractIT extends ApiIntegrationTest {

    private static final String PLANS = "/api/train/year-plans";
    private static final String TEMPLATES = "/api/train/meso-templates/";
    private static final String MESOS = "/api/train/mesocycles";
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 21);
    private static final LocalDate PLAN_START = LocalDate.of(2026, 11, 23);

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MesoTemplatePopulator templatePopulator;
    @Autowired private MesoTemplateRepository templateRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private JdbcTemplate jdbc;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** A 6-week template, so a linked run is exactly as long as its block. */
    private UUID template(UUID owner) {
        MesoTemplateEntity t = templatePopulator.template(owner);
        t.setWeeks(6);
        t.setPhaseCurve(List.of("MEV", "MAV", "MAV", "MRV", "MRV", "Deload"));
        return templateRepository.saveAndFlush(t).getId();
    }

    private MesocycleResponse start(UUID template, LocalDate date, String status, UUID yearBlockId,
                                    HttpHeaders auth) {
        Map<String, Object> body = new HashMap<>();
        body.put("startDate", date.toString());
        body.put("status", status);
        if (yearBlockId != null) body.put("yearBlockId", yearBlockId.toString());
        return postForBody(TEMPLATES + template + "/start", body, auth, HttpStatus.OK, MesocycleResponse.class);
    }

    private YearPlan plan(LocalDate start, HttpHeaders auth) {
        return postForBody(PLANS, Map.of("startDate", start.toString()), auth, HttpStatus.CREATED, YearPlan.class);
    }

    private YearPlan active(HttpHeaders auth) {
        return getForBody(PLANS + "/active", auth, HttpStatus.OK, YearPlan.class);
    }

    private static YearBlock at(YearPlan plan, int ordinal) {
        return plan.getBlocks().stream().filter(b -> b.getOrdinal() == ordinal).findFirst().orElseThrow();
    }

    private MesocycleResponse meso(UUID id, HttpHeaders auth) {
        return getForList(MESOS, auth, HttpStatus.OK, MesocycleResponse.class).stream()
            .filter(m -> m.getId().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void startWithYearBlockIdLinks() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        YearPlan plan = plan(PLAN_START, auth);

        MesocycleResponse run = start(template, TODAY, "active", at(plan, 2).getId(), auth);

        YearPlan after = active(auth);
        assertThat(at(after, 2).getStatus()).isEqualTo(YearBlock.StatusEnum.RUNNING);
        assertThat(at(after, 2).getMesocycleId()).isEqualTo(run.getId());
        assertThat(at(after, 1).getMesocycleId()).isNull();
        assertThat(at(after, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
        assertThat(after.getUnlinkedRunning()).isNull();
    }

    @Test
    void invalidYearBlockIdFallsBackToWindow() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        plan(PLAN_START, auth);

        MesocycleResponse run = start(template, TODAY, "active", UUID.randomUUID(), auth);

        YearPlan after = active(auth);
        assertThat(at(after, 1).getMesocycleId()).isEqualTo(run.getId());
        assertThat(at(after, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.RUNNING);
    }

    @Test
    void startWithinFourteenDaysAutoLinks() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        plan(PLAN_START, auth);

        MesocycleResponse run = start(template, LocalDate.of(2027, 1, 11), "planned", null, auth);

        YearPlan after = active(auth);
        assertThat(at(after, 2).getMesocycleId()).isEqualTo(run.getId());
        assertThat(at(after, 2).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
        assertThat(after.getBlocks()).filteredOn(b -> b.getMesocycleId() != null).hasSize(1);
    }

    @Test
    void startOutsideWindowIsUnlinkedRunning() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        YearPlan plan = plan(PLAN_START, auth);
        UUID block2 = at(plan, 2).getId();

        String nothing = patchForBody(PLANS + "/blocks/" + block2, Map.of("linkRunning", true), auth,
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(nothing, "TRAIN_YEAR_NOTHING_TO_LINK");

        // 21 days from both block 1 (2026-11-23) and block 2 (2027-01-04)
        MesocycleResponse run = start(template, LocalDate.of(2026, 12, 14), "planned", null, auth);

        YearPlan unlinked = active(auth);
        assertThat(unlinked.getBlocks()).allSatisfy(b -> assertThat(b.getMesocycleId()).isNull());
        assertThat(unlinked.getUnlinkedRunning()).isNotNull();
        assertThat(unlinked.getUnlinkedRunning().getMesocycleId()).isEqualTo(run.getId());
        assertThat(unlinked.getUnlinkedRunning().getStartDate()).isEqualTo(LocalDate.of(2026, 12, 14));
        assertThat(unlinked.getUnlinkedRunning().getTitle()).isEqualTo(run.getTitle());

        YearPlan linked = patchForBody(PLANS + "/blocks/" + block2, Map.of("linkRunning", true), auth, HttpStatus.OK,
            YearPlan.class);
        assertThat(at(linked, 2).getMesocycleId()).isEqualTo(run.getId());
        assertThat(linked.getUnlinkedRunning()).isNull();
        assertThat(active(auth).getUnlinkedRunning()).isNull();
    }

    @Test
    void lateStartRedates() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        YearPlan plan = plan(PLAN_START, auth);
        assertThat(at(plan, 3).getPlannedStart()).isEqualTo(LocalDate.of(2027, 2, 15));

        // block 2 is due Monday 2027-01-04; it starts 5 days late (Saturday)
        start(template, LocalDate.of(2027, 1, 9), "planned", null, auth);

        YearPlan after = active(auth);
        assertThat(at(after, 2).getPlannedStart()).isEqualTo(LocalDate.of(2027, 1, 9));
        assertThat(at(after, 3).getPlannedStart()).isEqualTo(LocalDate.of(2027, 2, 22));
        assertThat(jdbc.queryForObject("select planned_start from training_year_block where plan_id = ? and ordinal = 3",
            LocalDate.class, plan.getId())).isEqualTo(LocalDate.of(2027, 2, 22));
    }

    @Test
    void closeWithLogsDone() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        plan(PLAN_START, auth);
        MesocycleResponse run = start(template, TODAY, "active", null, auth);
        UUID day = jdbc.queryForObject("select id from workout_session where mesocycle_id = ? "
            + "and template_session_id is null order by order_index limit 1", UUID.class, run.getId());
        trainPopulator.startInstance(owner, day);

        postForBody(MESOS + "/" + run.getId() + "/close", null, auth, HttpStatus.OK, MesocycleResponse.class);

        YearPlan after = active(auth);
        assertThat(at(after, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.DONE);
        assertThat(at(after, 1).getMesocycleId()).isEqualTo(run.getId());
        assertThat(after.getReview().getBlocksDone()).isEqualTo(1);
    }

    @Test
    void closeWithoutLogsSkippedAndRedates() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        YearPlan plan = plan(PLAN_START, auth);
        assertThat(at(plan, 2).getPlannedStart()).isEqualTo(LocalDate.of(2027, 1, 4));
        MesocycleResponse run = start(template, TODAY, "active", null, auth);

        postForBody(MESOS + "/" + run.getId() + "/close", null, auth, HttpStatus.OK, MesocycleResponse.class);

        YearPlan after = active(auth);
        assertThat(at(after, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.SKIPPED);
        // the skipped block's weeks are free: block 2 moves up to the plan start
        assertThat(at(after, 2).getPlannedStart()).isEqualTo(PLAN_START);
        assertThat(after.getReview().getBlocksSkipped()).isEqualTo(1);
    }

    @Test
    void discardUnlinksBackToPlanned() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        plan(PLAN_START, auth);
        MesocycleResponse run = start(template, LocalDate.of(2027, 1, 11), "planned", null, auth);
        assertThat(at(active(auth), 2).getMesocycleId()).isEqualTo(run.getId());

        postForBody(MESOS + "/" + run.getId() + "/discard", null, auth, HttpStatus.NO_CONTENT, String.class);

        YearPlan after = active(auth);
        assertThat(at(after, 2).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
        assertThat(at(after, 2).getMesocycleId()).isNull();
        assertThat(jdbc.queryForObject("select count(*) from training_year_block where mesocycle_id = ?",
            Integer.class, run.getId())).isZero();
    }

    @Test
    void skipLinkedPlannedBlockDiscardsItsRun() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        plan(PLAN_START, auth);
        MesocycleResponse run = start(template, LocalDate.of(2027, 1, 11), "planned", null, auth);
        UUID block2 = at(active(auth), 2).getId();

        YearPlan skipped = patchForBody(PLANS + "/blocks/" + block2, Map.of("skip", true), auth, HttpStatus.OK,
            YearPlan.class);

        assertThat(at(skipped, 2).getStatus()).isEqualTo(YearBlock.StatusEnum.SKIPPED);
        assertThat(at(skipped, 2).getMesocycleId()).isNull();
        // the skip sticks: the reconciler has no run to pull it back to planned
        assertThat(at(active(auth), 2).getStatus()).isEqualTo(YearBlock.StatusEnum.SKIPPED);
        // the never-started run is discarded (soft delete), so the starter can never activate it
        assertThat(jdbc.queryForObject("select is_deleted from mesocycle where id = ?", Boolean.class, run.getId()))
            .isTrue();
        assertThat(getForList(MESOS, auth, HttpStatus.OK, MesocycleResponse.class))
            .noneMatch(m -> m.getId().equals(run.getId()));
    }

    @Test
    void plannedBlockActivatesOnItsDay() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        MesocycleResponse old = start(template, LocalDate.of(2026, 11, 2), "active", null, auth);
        MesocycleResponse next = start(template, TODAY, "planned", null, auth);

        getForBody("/api/train/workouts/today", auth, HttpStatus.OK, String.class);

        assertThat(meso(next.getId(), auth).getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        assertThat(meso(old.getId(), auth).getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED);
    }

    @Test
    void plannedBlockInTheFutureStaysPlannedOnListRead() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        MesocycleResponse later = start(template, TODAY.plusDays(2), "planned", null, auth);

        assertThat(meso(later.getId(), auth).getStatus()).isEqualTo(MesocycleResponse.StatusEnum.PLANNED);
    }

    @Test
    void nextInLastWeek() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        runningMeso(owner);
        plan(LocalDate.of(2026, 11, 16), auth);

        YearPlan after = active(auth);

        assertThat(at(after, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.RUNNING);
        YearNext next = after.getNext();
        assertThat(next).isNotNull();
        assertThat(next.getReason()).isEqualTo(YearNext.ReasonEnum.LAST_WEEK);
        assertThat(next.getBlockId()).isEqualTo(at(after, 2).getId());
        assertThat(next.getStartsOn()).isEqualTo(at(after, 2).getPlannedStart()).isEqualTo(LocalDate.of(2026, 11, 23));
    }

    @Test
    void nextWhenNoBlock() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        plan(PLAN_START, auth);

        YearPlan after = active(auth);

        YearNext next = after.getNext();
        assertThat(next).isNotNull();
        assertThat(next.getReason()).isEqualTo(YearNext.ReasonEnum.NO_BLOCK);
        assertThat(next.getBlockId()).isEqualTo(at(after, 1).getId());
        assertThat(next.getStartsOn()).isEqualTo(PLAN_START);
        assertThat(after.getUnlinkedRunning()).isNull();
    }

    @Test
    void noNextWhenNextAlreadyLinked() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        UUID template = template(owner);
        runningMeso(owner);
        plan(LocalDate.of(2026, 11, 16), auth);
        MesocycleResponse queued = start(template, LocalDate.of(2026, 11, 23), "planned", null, auth);

        YearPlan after = active(auth);

        assertThat(at(after, 2).getMesocycleId()).isEqualTo(queued.getId());
        assertThat(after.getNext()).isNull();
    }

    /** An active 6-week block started Monday 2026-10-12 (ends 2026-11-23, so 2026-11-21 is its last week). */
    private MesocycleEntity runningMeso(UUID owner) {
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Futó blokk", "active");
        m.setStartDate(LocalDate.of(2026, 10, 12));
        m.setEndDate(LocalDate.of(2026, 11, 23));
        m.setWeeks(6);
        m.setCurrentWeek(6);
        m.setMusclePriorities(Map.of("quad", "emphasize"));
        return mesocycleRepository.saveAndFlush(m);
    }
}
