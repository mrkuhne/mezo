package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveMealEnergy;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftSessionTime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShortenSession;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.SkipSession;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

/**
 * Boop B7 K3 (mezo-r36n9.17): the day-adjustment ledger's week rules, staleness and undo over real data. Fixtures hang
 * off the week of {@link #MON} (Monday 2026-11-23, Europe/Budapest); the application clock is set per test (default:
 * Tuesday 07:00 local). The plan: a gym slot on Friday, the active meso's "Csü" template day on Thursday.
 */
@Import(DayAdjustmentServiceIT.ClockConfig.class)
class DayAdjustmentServiceIT extends AbstractIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");
    private static final LocalDate MON = LocalDate.of(2026, 11, 23);
    private static final LocalDate TUE = MON.plusDays(1);
    private static final LocalDate WED = MON.plusDays(2);
    private static final LocalDate THU = MON.plusDays(3);
    private static final LocalDate FRI = MON.plusDays(4);
    private static final LocalDate SAT = MON.plusDays(5);
    private static final LocalDate SUN = MON.plusDays(6);

    static final class MutableClock extends Clock {
        private volatile Clock delegate = Clock.systemUTC();

        void set(Instant instant) { delegate = Clock.fixed(instant, ZoneOffset.UTC); }
        void reset() { delegate = Clock.systemUTC(); }
        @Override public ZoneId getZone() { return delegate.getZone(); }
        @Override public Clock withZone(ZoneId zone) { return delegate.withZone(zone); }
        @Override public Instant instant() { return delegate.instant(); }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        MutableClock dayAdjustmentTestClock() {
            return new MutableClock();
        }
    }

    @Autowired private DayAdjustmentService service;
    @Autowired private CapacityProposalRepository proposals;
    @Autowired private DayAdjustmentRepository adjustments;
    @Autowired private PlannedSkipRepository plannedSkips;
    @Autowired private PlannedSkipService plannedSkipService;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MutableClock clock;
    @Autowired private CapacityLock capacityLock;
    @Autowired private org.springframework.transaction.support.TransactionTemplate transactions;

    private UUID owner;
    private WorkoutSessionEntity thursday;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("cap-ledger@test.local");
        thursday = trainPopulator.createTemplateDay(owner, trainPopulator.createActiveMeso(owner).getId(), "Csü");
        trainPopulator.createExercise(owner, thursday.getId(), "Evezés", 0); // an empty template day is a rest day
        trainPopulator.createGymSlot(owner, 4, "17:30"); // Friday
        at(TUE, 7, 0);
    }

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    private void at(LocalDate date, int hour, int minute) {
        clock.set(LocalDateTime.of(date, LocalTime.of(hour, minute)).atZone(BUD).toInstant());
    }

    private UUID proposal(AdjustmentPayload... steps) {
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setCreatedBy(owner);
        p.setWeekStart(MON);
        p.setKind(steps[0].kind().name());
        p.setBundle(AdjustmentDraft.toBundle(Arrays.stream(steps).map(AdjustmentDraft::of).toList()));
        p.setTitle("például: áttesszük");
        p.setGeneratorVersion((short) 1);
        p.setStatus("open");
        return proposals.saveAndFlush(p).getId();
    }

    private List<DayAdjustmentView> accept(AdjustmentPayload... steps) {
        return service.applyBundle(owner, proposal(steps), UUID.randomUUID());
    }

    private MoveSessionDay move(LocalDate from, LocalDate to) {
        return new MoveSessionDay(thursday.getId(), from, to);
    }

    private static void refused(ThrowingCallable call, String code, HttpStatus status) {
        assertThatThrownBy(call)
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage(code)
            .satisfies(e -> assertThat(((SystemRuntimeErrorException) e).getStatus()).isEqualTo(status));
    }

    @Test
    void moveOnlyToEmptyDaySameWeek() {
        refused(() -> accept(move(THU, FRI)), "CAPACITY_MOVE_NOT_EMPTY_DAY", HttpStatus.UNPROCESSABLE_ENTITY);
        refused(() -> accept(move(THU, MON.plusDays(7))), "CAPACITY_MOVE_OTHER_WEEK", HttpStatus.UNPROCESSABLE_ENTITY);

        List<DayAdjustmentView> rows = accept(move(THU, SAT));

        assertThat(rows).singleElement().satisfies(v -> {
            assertThat(v.state()).isEqualTo(AdjustmentState.ACTIVE);
            assertThat(v.date()).isEqualTo(THU);
            assertThat(v.payload()).isEqualTo(move(THU, SAT));
        });
        assertThat(proposals.findById(rows.get(0).proposalId()).orElseThrow())
            .satisfies(p -> {
                assertThat(p.getStatus()).isEqualTo("accepted");
                assertThat(p.getDecidedAt()).isNotNull();
            });
        // Saturday is now taken by the moved session: Friday's cannot follow it there.
        refused(() -> accept(new MoveSessionDay(thursday.getId(), FRI, SAT)), "CAPACITY_MOVE_NOT_EMPTY_DAY",
            HttpStatus.UNPROCESSABLE_ENTITY);
        // The move counts on both of its days, never on the others.
        assertThat(service.activeFor(owner, THU)).hasSize(1);
        assertThat(service.activeFor(owner, SAT)).hasSize(1);
        assertThat(service.activeFor(owner, FRI)).isEmpty();
        assertThat(service.activeForRange(owner, MON, SUN)).hasSize(1);
    }

    @Test
    void sundayLateLocalIsStillThisWeek() {
        trainPopulator.createGymSlot(owner, 6, "18:00"); // Sunday
        at(SUN, 23, 30);

        // Still Sunday in his zone: today's bedtime can move, the session cannot cross into next week.
        assertThat(accept(new ShiftBedtime(SUN, LocalTime.of(23, 45)))).hasSize(1);
        refused(() -> accept(new MoveSessionDay(thursday.getId(), SUN, MON.plusDays(7))), "CAPACITY_MOVE_OTHER_WEEK",
            HttpStatus.UNPROCESSABLE_ENTITY);
        refused(() -> accept(new MoveSessionDay(thursday.getId(), SUN, SAT)), "CAPACITY_DAY_STARTED",
            HttpStatus.CONFLICT);

        // 00:30 Monday local is still Sunday 23:30 in UTC — but Sunday has passed for him.
        at(MON.plusDays(7), 0, 30);
        refused(() -> accept(new ShiftBedtime(SUN, LocalTime.of(23, 45))), "CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
    }

    @Test
    void pastDayIsRefused() {
        refused(() -> accept(new ShortenSession(MON, 40)), "CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
        refused(() -> accept(move(THU, MON)), "CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
        assertThat(adjustments.findAll()).isEmpty();
    }

    @Test
    void runningSessionIsNeverMoved() {
        trainPopulator.createWorkoutInstance(owner, thursday, TUE, "active");

        refused(() -> accept(move(THU, SAT)), "TRAIN_DAY_WORKOUT_RUNNING", HttpStatus.CONFLICT);
        assertThat(adjustments.findAll()).isEmpty();
    }

    @Test
    void targetDayGainedSessionExpiresMove() {
        UUID id = accept(move(THU, SAT)).get(0).id();
        assertThat(service.expireStale(owner, TUE)).isEmpty();

        trainPopulator.createGymSlot(owner, 5, "10:00"); // the schedule now puts a session on Saturday

        assertThat(service.expireStale(owner, TUE)).singleElement()
            .satisfies(v -> assertThat(v.state()).isEqualTo(AdjustmentState.EXPIRED));
        assertThat(adjustments.findById(id).orElseThrow().getState()).isEqualTo("expired");
        assertThat(service.activeFor(owner, SAT)).isEmpty();
    }

    @Test
    void passedMoveIsDoneWhetherOrNotHeTrained() {
        UUID moved = accept(move(THU, SAT)).get(0).id();
        UUID todo = accept(new AdjustmentPayload.CalendarTodo(WED, "evt-1", "cancel", null, null)).get(0).id();
        assertThat(adjustments.findById(todo).orElseThrow().getState()).isEqualTo("waiting");

        assertThat(service.expireStale(owner, THU)).extracting(DayAdjustmentView::id).containsExactly(todo);
        assertThat(adjustments.findById(todo).orElseThrow().getState()).isEqualTo("expired");

        // No workout on Saturday: once Saturday has passed the move is still history — done, not expired.
        assertThat(service.expireStale(owner, SUN)).singleElement()
            .satisfies(v -> assertThat(v.state()).isEqualTo(AdjustmentState.DONE));
        assertThat(service.activeFor(owner, SAT)).extracting(DayAdjustmentView::id).containsExactly(moved);
    }

    @Test
    void moveWhoseOldDayPassedSettlesDoneNeverExpired() {
        UUID id = accept(move(THU, SAT)).get(0).id();
        trainPopulator.createGymSlot(owner, 5, "10:00"); // Saturday gains a session — but Thursday is already behind

        // Expiring now would put the session back on a Thursday that has passed: a missed workout he never chose.
        assertThat(service.expireStale(owner, FRI)).singleElement()
            .satisfies(v -> assertThat(v.state()).isEqualTo(AdjustmentState.DONE));
        assertThat(adjustments.findById(id).orElseThrow().getState()).isEqualTo("done");
    }

    @Test
    void expireStaleWaitsForTheOwnersLock() throws Exception {
        accept(move(THU, SAT));
        trainPopulator.createGymSlot(owner, 5, "10:00");
        java.util.concurrent.CountDownLatch held = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            // An undo / accept in flight holds the owner's lock …
            java.util.concurrent.Future<?> holder = pool.submit(() -> transactions.executeWithoutResult(s -> {
                capacityLock.lock(owner);
                held.countDown();
                try {
                    release.await(10, java.util.concurrent.TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(held.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            // … so the sweep waits instead of writing over what that transaction is about to commit.
            java.util.concurrent.Future<List<DayAdjustmentView>> sweep = pool.submit(() -> service.expireStale(owner, TUE));
            Thread.sleep(500);
            assertThat(sweep.isDone()).isFalse();
            release.countDown();
            holder.get(10, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(sweep.get(10, java.util.concurrent.TimeUnit.SECONDS)).singleElement()
                .satisfies(v -> assertThat(v.state()).isEqualTo(AdjustmentState.EXPIRED));
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void moveDoneOnItsNewDayIsDoneAtOnce() {
        UUID moved = accept(move(THU, SAT)).get(0).id();
        trainPopulator.createWorkoutInstance(owner, thursday, SAT, "completed");

        assertThat(service.expireStale(owner, SAT)).singleElement()
            .satisfies(v -> assertThat(v.state()).isEqualTo(AdjustmentState.DONE));
        assertThat(adjustments.findById(moved).orElseThrow().getState()).isEqualTo("done");
    }

    @Test
    void undoRestores() {
        List<DayAdjustmentView> bundle = accept(new ShiftBedtime(WED, LocalTime.of(23, 15)),
            new ShiftSessionTime(THU, LocalTime.of(7, 45)));
        assertThat(bundle).hasSize(2);
        assertThat(bundle).extracting(DayAdjustmentView::bundleId).containsOnly(bundle.get(0).bundleId());

        service.undo(owner, bundle.get(1).id());

        assertThat(adjustments.findAll()).extracting(e -> e.getState()).containsOnly("undone");
        assertThat(proposals.findById(bundle.get(0).proposalId()).orElseThrow().getStatus()).isEqualTo("undone");
        assertThat(service.activeForRange(owner, MON, SUN)).isEmpty();
        assertThat(service.list(owner, MON, SUN)).hasSize(2);
        refused(() -> service.undo(owner, bundle.get(0).id()), "CAPACITY_ADJUSTMENT_NOT_UNDOABLE",
            HttpStatus.CONFLICT);
        // The freed day takes a move again.
        assertThat(accept(move(THU, SAT))).hasSize(1);
    }

    @Test
    void undoAfterDayStartRefused() {
        UUID id = accept(new ShiftBedtime(WED, LocalTime.of(23, 15)), move(THU, SAT)).get(0).id();

        at(THU, 8, 0); // Wednesday's night has passed
        refused(() -> service.undo(owner, id), "CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
        assertThat(adjustments.findAll()).extracting(e -> e.getState()).containsOnly("active");
        refused(() -> service.undo(owner, UUID.randomUUID()), "RESOURCE_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    @Test
    void mealSplitMustKeepDayTotal() {
        refused(() -> accept(new MoveMealEnergy(WED, Map.of("lunch", 200, "dinner", -150))),
            "VALIDATION_INVALID_VALUE", HttpStatus.BAD_REQUEST);
        refused(() -> accept(new MoveMealEnergy(WED, Map.of("brunch", 200, "dinner", -200))),
            "VALIDATION_INVALID_VALUE", HttpStatus.BAD_REQUEST);

        assertThat(accept(new MoveMealEnergy(WED, Map.of("lunch", 200, "dinner", -200)))).singleElement()
            .satisfies(v -> assertThat(((MoveMealEnergy) v.payload()).slotKcal())
                .containsExactlyInAnyOrderEntriesOf(Map.of("lunch", 200, "dinner", -200)));
    }

    @Test
    void sameClientRefNeverAppliesTwice() {
        UUID proposalId = proposal(new ShiftBedtime(WED, LocalTime.of(23, 15)), move(THU, SAT));
        UUID clientRef = UUID.randomUUID();

        List<DayAdjustmentView> first = service.applyBundle(owner, proposalId, clientRef);
        List<DayAdjustmentView> replay = service.applyBundle(owner, proposalId, clientRef);

        assertThat(replay).extracting(DayAdjustmentView::id)
            .containsExactlyInAnyOrderElementsOf(first.stream().map(DayAdjustmentView::id).toList());
        assertThat(adjustments.findAll()).hasSize(2);
        // A second accept under a new clientRef finds the proposal already decided.
        refused(() -> service.applyBundle(owner, proposalId, UUID.randomUUID()), "CAPACITY_PROPOSAL_STALE",
            HttpStatus.CONFLICT);
    }

    @Test
    void declinedProposalIsStale() {
        UUID proposalId = proposal(new ShiftBedtime(WED, LocalTime.of(23, 15)));
        CapacityProposalEntity p = proposals.findById(proposalId).orElseThrow();
        p.setStatus("declined");
        proposals.saveAndFlush(p);

        refused(() -> service.applyBundle(owner, proposalId, UUID.randomUUID()), "CAPACITY_PROPOSAL_STALE",
            HttpStatus.CONFLICT);
        UUID stranger = databasePopulator.populateUser("cap-ledger-other@test.local");
        refused(() -> service.applyBundle(stranger, proposalId, UUID.randomUUID()), "RESOURCE_NOT_FOUND",
            HttpStatus.NOT_FOUND);
    }

    /**
     * The skip goes through train's planned-skip path, whose date window follows the real calendar — so this test runs
     * on today's real date (any weekday) with a gym slot on it.
     */
    @Test
    void skipUsesThePlannedSkipPathAndUndoRemovesIt() {
        clock.reset();
        LocalDate today = LocalDate.now(BUD);
        trainPopulator.createGymSlot(owner, today.getDayOfWeek().getValue() - 1, "23:50");

        DayAdjustmentView row = accept(new SkipSession(today, null)).get(0);

        UUID skipId = ((SkipSession) row.payload()).skipId();
        assertThat(skipId).isNotNull();
        assertThat(plannedSkips.findByIdAndCreatedByAndDeletedFalse(skipId, owner)).hasValueSatisfying(s -> {
            assertThat(s.getKind()).isEqualTo(PlannedSkipEntity.Kind.GYM);
            assertThat(s.getReasonCategory()).isEqualTo(PlannedSkipEntity.Reason.KAPACITAS);
        });
        assertThat(plannedSkipService.excusedDates(owner, PlannedSkipEntity.Kind.GYM, today, today)).contains(today);
        // A day already skipped is not skipped again.
        refused(() -> accept(new SkipSession(today, null)), "CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);

        service.undo(owner, row.id());

        assertThat(plannedSkips.findByIdAndCreatedByAndDeletedFalse(skipId, owner)).isEmpty();
        assertThat(service.activeFor(owner, today)).isEmpty();
        assertThat(adjustments.findById(row.id()).orElseThrow().getKind())
            .isEqualTo(AdjustmentKind.SKIP_SESSION.name());
    }
}
