package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.YearBlock;
import io.mrkuhne.mezo.api.dto.YearNext;
import io.mrkuhne.mezo.api.dto.YearPlan;
import io.mrkuhne.mezo.api.dto.YearUnlinkedRunning;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesoTemplateRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.YearPlanLinker;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * The whole-branch review's fixes of the Éves terv (mezo-r36n9.113): what „Jövő évi terv" may adopt and where it
 * starts, a linked planned block's lock, a block started today taking over from an earlier-made planned run, and the
 * smaller reconciliation/layout/next fixes. The clock is movable (Europe/Budapest, Saturday 2026-11-21 by default).
 * All values invented.
 */
@Import(YearPlanFinalReviewIT.MovableClockConfig.class)
class YearPlanFinalReviewIT extends ApiIntegrationTest {

    private static final String PLANS = "/api/train/year-plans";
    private static final String BLOCKS = PLANS + "/blocks/";
    private static final String TEMPLATES = "/api/train/meso-templates/";
    private static final String MESOS = "/api/train/mesocycles";
    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 21);

    static final class MovableClock extends Clock {
        private volatile Clock delegate = fixedOn(TODAY);

        static Clock fixedOn(LocalDate day) {
            return Clock.fixed(day.atTime(9, 0).atZone(BUD).toInstant(), BUD);
        }

        void set(LocalDate day) { delegate = fixedOn(day); }
        @Override public ZoneId getZone() { return delegate.getZone(); }
        @Override public Clock withZone(ZoneId zone) { return delegate.withZone(zone); }
        @Override public Instant instant() { return delegate.instant(); }
    }

    @TestConfiguration
    static class MovableClockConfig {
        @Bean
        MovableClock yearPlanMovableClock() {
            return new MovableClock();
        }
    }

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MesoTemplatePopulator templatePopulator;
    @Autowired private MesoTemplateRepository templateRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MovableClock clock;
    @MockitoSpyBean private YearPlanLinker linker;

    private UUID owner;
    private HttpHeaders auth;

    @BeforeEach
    void setUp() {
        clock.set(TODAY);
        owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        auth = ownerAuthHeaders();
    }

    @AfterEach
    void resetClock() {
        clock.set(TODAY);
    }

    // ---- helpers ----

    private UUID template() {
        MesoTemplateEntity t = templatePopulator.template(owner);
        t.setWeeks(6);
        t.setPhaseCurve(List.of("MEV", "MAV", "MAV", "MRV", "MRV", "Deload"));
        return templateRepository.saveAndFlush(t).getId();
    }

    private MesocycleResponse start(UUID template, LocalDate date, String status, UUID yearBlockId) {
        Map<String, Object> body = new HashMap<>();
        body.put("startDate", date.toString());
        body.put("status", status);
        if (yearBlockId != null) body.put("yearBlockId", yearBlockId.toString());
        return postForBody(TEMPLATES + template + "/start", body, auth, HttpStatus.OK, MesocycleResponse.class);
    }

    private YearPlan plan(LocalDate start) {
        return postForBody(PLANS, Map.of("startDate", start.toString()), auth, HttpStatus.CREATED, YearPlan.class);
    }

    private YearPlan active() {
        return getForBody(PLANS + "/active", auth, HttpStatus.OK, YearPlan.class);
    }

    private static YearBlock at(YearPlan plan, int ordinal) {
        return plan.getBlocks().stream().filter(b -> b.getOrdinal() == ordinal).findFirst().orElseThrow();
    }

    private static YearBlock consolidation(YearPlan plan) {
        return plan.getBlocks().getLast();
    }

    private MesocycleEntity meso(String status, LocalDate start, int weeks, List<String> curve) {
        MesocycleEntity m = trainPopulator.createMesocycle(owner, "Blokk " + start, status);
        m.setStartDate(start);
        m.setEndDate(start.plusWeeks(weeks));
        m.setWeeks(weeks);
        m.setCurrentWeek(1);
        m.setPhaseCurve(curve);
        return mesocycleRepository.saveAndFlush(m);
    }

    private void link(UUID blockId, UUID mesoId, String status) {
        jdbc.update("update training_year_block set mesocycle_id = ?, status = ? where id = ?", mesoId, status, blockId);
    }

    private void logSession(UUID mesoId) {
        UUID day = trainPopulator.createTemplateDay(owner, mesoId, "Hét").getId();
        trainPopulator.startInstance(owner, day);
    }

    private boolean deleted(UUID mesoId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select is_deleted from mesocycle where id = ?", Boolean.class,
            mesoId));
    }

    private Map<String, Object> blockRow(UUID blockId) {
        return jdbc.queryForMap("select status, mesocycle_id, weeks from training_year_block where id = ?", blockId);
    }

    // ---- I1: „Jövő évi terv" never adopts the consolidation; the server says where the next year starts ----

    @Test
    void lateConsolidationIsNotAdoptedAndNextYearStartsAfterIt() {
        YearPlan plan = plan(LocalDate.of(2026, 11, 23));
        jdbc.update("update training_year_block set status = 'skipped' where plan_id = ? and kind <> 'consolidation'",
            plan.getId());
        LocalDate consStart = consolidation(active()).getPlannedStart();
        // The consolidation starts 2 days late (within the tolerance, so the plan keeps its day) and runs 2 weeks.
        LocalDate late = consStart.plusDays(2);
        clock.set(late);
        MesocycleEntity cons = meso("active", late, 2, List.of("MEV", "MEV"));
        link(consolidation(plan).getId(), cons.getId(), "running");

        YearPlan now = active();

        assertThat(now.getEndDate()).isEqualTo(consStart.plusWeeks(2).minusDays(1));
        // Its own last day is late + 13: the next plan starts the Monday after that, not the plan's end + 1.
        assertThat(now.getNextYearStart()).isEqualTo(consStart.plusWeeks(3)).isAfter(cons.getEndDate().minusDays(1));

        Map<String, Object> body = new HashMap<>();
        body.put("startDate", consStart.plusWeeks(2).toString()); // before the consolidation run ends
        body.put("replaceActive", true);
        YearPlan next = postForBody(PLANS, body, auth, HttpStatus.CREATED, YearPlan.class);
        assertThat(at(next, 1).getAdopted()).isFalse();
        assertThat(at(next, 1).getMesocycleId()).isNull();
        assertThat(next.getStartDate()).isEqualTo(consStart.plusWeeks(2));
    }

    @Test
    void flatMevOrShortRunIsNeverAdopted() {
        MesocycleEntity flat = meso("active", LocalDate.of(2026, 11, 16), 6, List.of("MEV", "MEV", "MEV", "MEV",
            "MEV", "MEV"));
        YearPlan plan = plan(LocalDate.of(2026, 11, 23));
        assertThat(at(plan, 1).getAdopted()).isFalse();
        assertThat(plan.getBlocks()).noneMatch(b -> flat.getId().equals(b.getMesocycleId()));
    }

    @Test
    void threeWeekRunIsNeverAdopted() {
        meso("active", LocalDate.of(2026, 11, 16), 3, List.of("MEV", "MAV", "Deload"));
        YearPlan plan = plan(LocalDate.of(2026, 11, 23));
        assertThat(at(plan, 1).getAdopted()).isFalse();
    }

    @Test
    void nextYearStartIsTheMondayAfterThePlanEnd() {
        YearPlan plan = plan(LocalDate.of(2026, 11, 23));
        assertThat(plan.getNextYearStart()).isEqualTo(plan.getEndDate().plusDays(1));
        assertThat(active().getNextYearStart()).isEqualTo(plan.getEndDate().plusDays(1));
    }

    // ---- I2: a planned block linked to a planned run is edited in the block builder, not here ----

    @Test
    void linkedPlannedBlockRefusesEditsButCanBeSkipped() {
        UUID template = template();
        plan(LocalDate.of(2026, 11, 23));
        start(template, LocalDate.of(2027, 1, 11), "planned", null);
        UUID block2 = at(active(), 2).getId();
        assertThat(at(active(), 2).getMesocycleId()).isNotNull();

        for (Map<String, Object> edit : List.<Map<String, Object>>of(Map.of("focus", List.of("ham")),
                Map.of("weeks", 5), Map.of("ordinal", 3), Map.of("shiftWeeks", 1))) {
            String body = patchForBody(BLOCKS + block2, edit, auth, HttpStatus.CONFLICT, String.class);
            assertHasRequestError(body, "TRAIN_YEAR_BLOCK_LOCKED");
        }

        YearPlan skipped = patchForBody(BLOCKS + block2, Map.of("skip", true), auth, HttpStatus.OK, YearPlan.class);
        assertThat(at(skipped, 2).getStatus()).isEqualTo(YearBlock.StatusEnum.SKIPPED);
    }

    // ---- I3: a block started today discards an earlier-made planned run dated after it ----

    @Test
    void startingTodayDiscardsALaterPlannedRun() {
        UUID template = template();
        plan(LocalDate.of(2026, 11, 30));
        MesocycleResponse queued = start(template, LocalDate.of(2026, 12, 1), "planned", null);
        YearPlan before = active();
        assertThat(at(before, 1).getMesocycleId()).isEqualTo(queued.getId());

        MesocycleResponse now = start(template(), TODAY, "active", at(before, 2).getId());

        assertThat(deleted(queued.getId())).isTrue();
        YearPlan after = active();
        assertThat(at(after, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
        assertThat(at(after, 1).getMesocycleId()).isNull();

        clock.set(LocalDate.of(2026, 12, 1));
        getForBody("/api/train/workouts/today", auth, HttpStatus.OK, String.class);
        active();
        assertThat(mesocycleRepository.findById(now.getId()).orElseThrow().getStatus()).isEqualTo("active");
        assertThat(jdbc.queryForObject("select count(*) from mesocycle where created_by = ? and status = 'active' "
            + "and is_deleted = false", Integer.class, owner)).isEqualTo(1);
    }

    // ---- minor 4: un-skipping a block reality skipped keeps it planned ----

    @Test
    void unskipRealitySkippedBlockUnlinksItsArchivedRun() {
        YearPlan plan = plan(LocalDate.of(2026, 11, 23));
        UUID block1 = at(plan, 1).getId();
        MesocycleEntity closed = meso("archived", LocalDate.of(2026, 11, 23), 6, List.of("MEV", "MAV", "Deload"));
        link(block1, closed.getId(), "planned");
        assertThat(at(active(), 1).getStatus()).isEqualTo(YearBlock.StatusEnum.SKIPPED);

        YearPlan unskipped = patchForBody(BLOCKS + block1, Map.of("skip", false), auth, HttpStatus.OK, YearPlan.class);

        assertThat(at(unskipped, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
        assertThat(at(unskipped, 1).getMesocycleId()).isNull();
        assertThat(at(active(), 1).getStatus()).isEqualTo(YearBlock.StatusEnum.PLANNED);
    }

    // ---- minor 6: an archived run without a close date ends where the next linked run starts ----

    @Test
    void archivedRunWithoutCloseDateIsCappedAtTheNextRun() {
        YearPlan plan = plan(LocalDate.of(2026, 11, 23)); // first: an active run made earlier would be adopted
        MesocycleEntity first = meso("archived", LocalDate.of(2026, 11, 23), 6, List.of("MEV", "MAV", "Deload"));
        logSession(first.getId());
        MesocycleEntity second = meso("active", LocalDate.of(2026, 12, 16), 6, List.of("MEV", "MAV", "Deload"));
        link(at(plan, 1).getId(), first.getId(), "done");
        link(at(plan, 2).getId(), second.getId(), "running");
        clock.set(LocalDate.of(2026, 12, 20));

        YearPlan now = active();

        assertThat(at(now, 1).getStatus()).isEqualTo(YearBlock.StatusEnum.DONE);
        assertThat(at(now, 2).getStatus()).isEqualTo(YearBlock.StatusEnum.RUNNING);
        assertThat(at(now, 1).getLastDay()).isBefore(at(now, 2).getPlannedStart());
    }

    // ---- minor 7: next() ----

    @Test
    void unlinkedPlannedRunDoesNotHideNoBlock() {
        UUID template = template();
        plan(LocalDate.of(2026, 11, 23));
        start(template, LocalDate.of(2026, 12, 14), "planned", null); // 21 days from both block 1 and block 2

        YearPlan now = active();

        assertThat(now.getUnlinkedRunning()).isNotNull();
        assertThat(now.getNext()).isNotNull();
        assertThat(now.getNext().getReason()).isEqualTo(YearNext.ReasonEnum.NO_BLOCK);
        assertThat(now.getNext().getBlockId()).isEqualTo(at(now, 1).getId());
    }

    @Test
    void unlinkedActiveRunInItsLastWeekPointsAtTheFirstPlannedBlock() {
        meso("active", LocalDate.of(2026, 10, 12), 6, List.of("MEV", "MAV", "Deload")); // ends 2026-11-23
        YearPlan plan = plan(LocalDate.of(2026, 11, 23));
        jdbc.update("update training_year_block set status = 'done' where id = ?", at(plan, 1).getId());

        YearPlan now = active();

        assertThat(now.getNext()).isNotNull();
        assertThat(now.getNext().getReason()).isEqualTo(YearNext.ReasonEnum.LAST_WEEK);
        assertThat(now.getNext().getBlockId()).isEqualTo(at(now, 2).getId());
    }

    // ---- minor 8: a run longer than 8 weeks is adopted as an 8-week block ----

    @Test
    void longRunIsAdoptedClampedToEightWeeks() {
        MesocycleEntity longRun = meso("active", LocalDate.of(2026, 11, 16), 10,
            List.of("MEV", "MAV", "MAV", "MAV", "MRV", "MRV", "MRV", "MRV", "MRV", "Deload"));

        YearPlan plan = plan(LocalDate.of(2026, 11, 23));

        YearBlock first = at(plan, 1);
        assertThat(first.getAdopted()).isTrue();
        assertThat(first.getMesocycleId()).isEqualTo(longRun.getId());
        assertThat(blockRow(first.getId()).get("weeks")).isEqualTo(8);
        // The strip keeps the run's real length.
        assertThat(first.getWeeks()).isEqualTo(10);
    }

    // ---- minor 9: replacing the plan keeps the old plan's history ----

    @Test
    void replacingThePlanReconcilesAndKeepsTheOldHistory() {
        MesocycleEntity done = meso("archived", LocalDate.of(2026, 10, 5), 6, List.of("MEV", "MAV", "Deload"));
        logSession(done.getId());
        MesocycleEntity running = meso("active", LocalDate.of(2026, 11, 16), 6, List.of("MEV", "MAV", "Deload"));
        YearPlan old = plan(LocalDate.of(2026, 11, 23)); // adopts the running run as block 1
        assertThat(at(old, 1).getMesocycleId()).isEqualTo(running.getId());
        UUID oldBlock2 = at(old, 2).getId();
        link(oldBlock2, done.getId(), "running"); // stale: the run behind it closed with a logged session

        Map<String, Object> body = new HashMap<>();
        body.put("startDate", LocalDate.of(2026, 11, 30).toString());
        body.put("replaceActive", true);
        YearPlan next = postForBody(PLANS, body, auth, HttpStatus.CREATED, YearPlan.class);

        assertThat(at(next, 1).getMesocycleId()).isEqualTo(running.getId());
        Map<String, Object> oldRow2 = blockRow(oldBlock2);
        assertThat(oldRow2.get("status")).isEqualTo("done");
        assertThat(oldRow2.get("mesocycle_id")).isEqualTo(done.getId());
        Map<String, Object> oldRow1 = blockRow(at(old, 1).getId());
        assertThat(oldRow1.get("mesocycle_id")).isNull();
        assertThat(oldRow1.get("status")).isEqualTo("running");
    }

    // ---- minor 11: a linker failure never fails the start ----

    @Test
    void failingLinkerStillCommitsTheStart() {
        UUID template = template();
        plan(LocalDate.of(2026, 11, 23));
        doThrow(new IllegalStateException("linker boom")).when(linker).linkStarted(any(), any(), any());

        MesocycleResponse run = start(template, TODAY, "active", null);

        assertThat(mesocycleRepository.findById(run.getId())).isPresent();
        assertThat(getForList(MESOS, auth, HttpStatus.OK, MesocycleResponse.class))
            .anyMatch(m -> m.getId().equals(run.getId()));
    }

    // ---- minor 12: the unlinked banner tells a planned run from a running one ----

    @Test
    void unlinkedRunCarriesItsStatus() {
        UUID template = template();
        plan(LocalDate.of(2026, 11, 23));
        start(template, LocalDate.of(2026, 12, 14), "planned", null);

        YearUnlinkedRunning u = active().getUnlinkedRunning();

        assertThat(u).isNotNull();
        assertThat(u.getStatus()).isEqualTo(YearUnlinkedRunning.StatusEnum.PLANNED);
    }
}
