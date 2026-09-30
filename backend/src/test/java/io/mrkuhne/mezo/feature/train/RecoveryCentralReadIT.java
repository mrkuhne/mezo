package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PlannedSkipResponse;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.repository.RecoveryDayReleaseRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy.Source;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipPolicy.Verdict;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PlannedSkipPopulator;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kihagyás S2 (mezo-q4xt2.2, spec 2026-09-28 §9.2): an open kímélő-mód period flows through the S1
 * central skip read — every planned gym day, sport slot occurrence and prescribed run on a
 * protected date reads as an excused RECOVERY skip, a released date ("Ma mégis edzek") reads as
 * normal again, and the REST list never exposes the virtual RECOVERY rows.
 */
@Transactional
class RecoveryCentralReadIT extends AbstractIntegrationTest {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    @Autowired private UserPopulator userPopulator;
    @Autowired private RecoveryPeriodPopulator periods;
    @Autowired private RecoveryDayReleaseRepository releases;
    @Autowired private PlannedSkipPopulator plannedSkips;
    @Autowired private TrainPopulator train;
    @Autowired private RunningPopulator running;
    @Autowired private PlannedSkipService plannedSkipService;
    @Autowired private SportSlotSkipService sportSlotSkipService;
    @Autowired private WorkoutWindowQueryService windows;

    private final LocalDate today = LocalDate.now(TZ);
    /** Legacy SPORT weekday: 0=Hét..6=Vas. */
    private final int dow = today.getDayOfWeek().getValue() - 1;

    private UUID user() {
        return userPopulator.createUser().getId();
    }

    /** A gym slot, a sport slot and a prescribed run on today's weekday. */
    private void plannedDay(UUID user) {
        train.createGymSlot(user, dow, "07:00");
        train.createScheduleSlot(user, dow, "18:00", 90, "training");
        running.createBlockAnchored(user, today.minusDays(dow), 8, 1, 1, dow, "12:00");
    }

    private RecoveryPeriodEntity illnessSinceYesterday(UUID user) {
        return periods.open(user, Reason.ILLNESS, today.minusDays(1), Estimate.FEW_DAYS);
    }

    private void release(UUID user, RecoveryPeriodEntity period, LocalDate date) {
        RecoveryDayReleaseEntity r = new RecoveryDayReleaseEntity();
        r.setCreatedBy(user);
        r.setPeriodId(period.getId());
        r.setDate(date);
        releases.saveAndFlush(r);
    }

    @Test
    void testCentralRead_shouldExcuseEveryPlannedOccurrence_whenTodayIsProtected() {
        UUID user = user();
        plannedDay(user);
        illnessSinceYesterday(user);

        assertThat(plannedSkipService.excusedDates(user, Kind.GYM, today, today)).containsExactly(today);
        assertThat(plannedSkipService.isGymSkipped(user, today)).isTrue();
        assertThat(plannedSkipService.bridgedWeeks(user, today, today))
            .containsExactly(PlannedSkipPolicy.isoWeekKey(today));
        assertThat(sportSlotSkipService.isSkipped(user, dow, "18:00", today)).isTrue();
        assertThat(sportSlotSkipService.skipsBetween(user, today, today).contains(dow, "18:00", today)).isTrue();
        assertThat(plannedSkipService.isRunSkipped(user, today, "w2-long")).isTrue();
        assertThat(plannedSkipService.isRunSkipped(user, today, null))
            .as("consistent with RunSkips.contains: a protected date covers any run").isTrue();
        assertThat(plannedSkipService.skippedRuns(user, today, today).contains(today, "w1-sprint")).isTrue();
        assertThat(windows.windowsFor(user, today))
            .as("no gym / sport / run window on a protected day — Fuel must not score around them")
            .isEmpty();
        assertThat(windows.windowsFor(user, today.minusDays(1), today).get(today))
            .as("the ranged path honours protection too").isEmpty();
    }

    @Test
    void testCentralRead_shouldJudgeTheVirtualRowAsExcusedRecovery_withoutAFreePass() {
        UUID user = user();
        train.createGymSlot(user, dow, "07:00");
        RecoveryPeriodEntity period = illnessSinceYesterday(user);

        List<Verdict> verdicts = plannedSkipService.verdictsBetween(user, today, today);

        assertThat(verdicts).hasSize(1);
        Verdict v = verdicts.getFirst();
        assertThat(v.row().source()).isEqualTo(Source.RECOVERY);
        assertThat(v.row().kind()).isEqualTo(Kind.GYM);
        assertThat(v.row().reason()).isEqualTo(Reason.ILLNESS);
        assertThat(v.row().createdAt()).isEqualTo(period.getCreatedAt());
        assertThat(v.row().id())
            .isEqualTo(UUID.nameUUIDFromBytes(("recovery:" + user + ":" + today).getBytes()));
        assertThat(v.excused()).isTrue();
        assertThat(v.freePass()).isFalse();
    }

    @Test
    void testCentralRead_shouldReadNormally_whenTheProtectedDateIsReleased() {
        UUID user = user();
        plannedDay(user);
        train.createGymSlot(user, today.minusDays(1).getDayOfWeek().getValue() - 1, "07:00");
        RecoveryPeriodEntity period = illnessSinceYesterday(user);
        release(user, period, today);

        assertThat(plannedSkipService.excusedDates(user, Kind.GYM, today, today)).isEmpty();
        assertThat(plannedSkipService.isGymSkipped(user, today)).isFalse();
        assertThat(sportSlotSkipService.isSkipped(user, dow, "18:00", today)).isFalse();
        assertThat(plannedSkipService.isRunSkipped(user, today, "w1-sprint")).isFalse();
        assertThat(windows.windowsFor(user, today))
            .extracting(WorkoutWindowQueryService.Window::kind)
            .containsExactlyInAnyOrder("gym", "sport", "run");
        assertThat(plannedSkipService.excusedDates(user, Kind.GYM, today.minusDays(1), today.minusDays(1)))
            .as("only the released date is back; yesterday stays protected")
            .containsExactly(today.minusDays(1));
    }

    @Test
    void testList_shouldNotExposeRecoveryRows_whenAPeriodIsOpen() {
        UUID user = user();
        illnessSinceYesterday(user);
        plannedSkips.create(user, today, Kind.RUN, null, null, "w1-sprint", Reason.TIRED);

        List<PlannedSkipResponse> listed = plannedSkipService.list(user, today.minusDays(1), today);

        assertThat(listed).hasSize(1);
        assertThat(listed.getFirst().getSource()).isEqualTo(PlannedSkipResponse.SourceEnum.USER);
    }

    @Test
    void testCentralRead_shouldKeepTheUserRowAndItsFreePass_whenASoftSkipFallsInAProtectedWeek() {
        UUID user = user();
        illnessSinceYesterday(user);
        plannedSkips.create(user, today, Kind.GYM, null, null, null, Reason.TIRED);

        List<Verdict> todays = plannedSkipService.verdictsBetween(user, today, today);

        assertThat(todays).as("the real USER row replaces the virtual one on its date").hasSize(1);
        assertThat(todays.getFirst().row().source()).isEqualTo(Source.USER);
        assertThat(todays.getFirst().freePass()).as("RECOVERY rows stay out of the pass race").isTrue();
        assertThat(todays.getFirst().excused()).isTrue();
    }

    @Test
    void testCentralRead_shouldAddNoGymVerdictNorBridge_whenTheProtectedDayIsARestDay() {
        UUID user = user();                       // no gym slot, no meso: today is a rest day
        train.createScheduleSlot(user, dow, "18:00", 90, "training");
        illnessSinceYesterday(user);

        assertThat(plannedSkipService.verdictsBetween(user, today, today)).isEmpty();
        assertThat(plannedSkipService.isGymSkipped(user, today)).isFalse();
        assertThat(plannedSkipService.bridgedWeeks(user, today, today))
            .as("a protected rest day never bridges a week on its own").isEmpty();
        assertThat(sportSlotSkipService.isSkipped(user, dow, "18:00", today))
            .as("sport protection stays date-wide").isTrue();
    }

    @Test
    void testCentralRead_shouldExcuseAndBridge_whenTheProtectedDayIsAMesoTemplateDay() {
        UUID user = user();                       // planned via the active meso's template label only
        var meso = train.createActiveMeso(user);
        train.createTemplateDay(user, meso.getId(), WorkoutService.HU_DAY_LABELS.get(dow));
        illnessSinceYesterday(user);

        assertThat(plannedSkipService.excusedDates(user, Kind.GYM, today, today)).containsExactly(today);
        assertThat(plannedSkipService.bridgedWeeks(user, today, today))
            .containsExactly(PlannedSkipPolicy.isoWeekKey(today));
    }

    @Test
    void testCentralRead_shouldKeepTheFreePass_whenASoftSkipFallsOnAnUnprotectedDayOfAProtectedWeek() {
        UUID user = user();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate thursday = monday.plusDays(3);
        train.createGymSlot(user, 0, "07:00");    // Monday
        train.createGymSlot(user, 3, "07:00");    // Thursday
        periods.ended(user, Reason.ILLNESS, monday, monday.plusDays(2));   // protects Mon + Tue
        plannedSkips.create(user, thursday, Kind.GYM, null, null, null, Reason.TIRED);

        List<Verdict> week = plannedSkipService.verdictsBetween(user, monday, monday.plusDays(6));

        assertThat(week).extracting(v -> v.row().date()).containsExactly(monday, thursday);
        Verdict recovery = week.get(0);
        assertThat(recovery.row().source()).isEqualTo(Source.RECOVERY);
        assertThat(recovery.freePass()).isFalse();
        Verdict soft = week.get(1);
        assertThat(soft.row().source()).isEqualTo(Source.USER);
        assertThat(soft.freePass()).as("RECOVERY rows never take the week's pass").isTrue();
        assertThat(soft.excused()).isTrue();
    }

    @Test
    void testCentralRead_shouldNotSpendThePass_whenASoftSkipFallsOnAProtectedPlannedDay() {
        UUID user = user();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate thursday = monday.plusDays(3);
        train.createGymSlot(user, 0, "07:00");    // Monday
        train.createGymSlot(user, 3, "07:00");    // Thursday
        periods.ended(user, Reason.ILLNESS, monday, monday.plusDays(2));   // protects Mon + Tue
        plannedSkips.create(user, monday, Kind.GYM, null, null, null, Reason.TIRED);
        plannedSkips.create(user, thursday, Kind.GYM, null, null, null, Reason.TIRED);

        List<Verdict> week = plannedSkipService.verdictsBetween(user, monday, monday.plusDays(6));

        assertThat(week).extracting(v -> v.row().date()).containsExactly(monday, thursday);
        Verdict onProtected = week.get(0);
        assertThat(onProtected.row().source()).isEqualTo(Source.USER);
        assertThat(onProtected.excused()).isTrue();
        assertThat(onProtected.freePass()).as("the protection excuses it — no pass spent").isFalse();
        Verdict later = week.get(1);
        assertThat(later.freePass()).as("the week's pass is still there for the unprotected day").isTrue();
        assertThat(later.excused()).isTrue();
    }
}
