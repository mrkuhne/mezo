package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.api.dto.WeekProposalLine;
import io.mrkuhne.mezo.api.dto.WeekProposalLineDecision;
import io.mrkuhne.mezo.api.dto.WeekProposalMuscle;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * HTTP round-trip through the GENERATED weekly-proposal API (volume engine v2 S3, mezo-r36n9.78,
 * api/feature/train/train-week-proposal.yml) in {@code manual} mode: the read generates the week's
 * proposal once and returns it pending; per-line and rest decisions write (set lines, only while the row
 * still holds {@code from}), re-sync the ledger and close the proposal once every line is decided.
 * Every test uses a freshly registered user.
 */
@TestPropertySource(properties = "mezo.volume.weekly-review.mode=manual")
class WeekProposalApiIT extends ApiIntegrationTest {

    private static final List<String> CURVE = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired private TrainPopulator train;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private MesoWeekProposalRepository proposalRepository;
    @Autowired private MuscleGroupVolumeLogRepository volumeRepository;

    private record Back(UUID owner, MesocycleEntity meso, ExerciseEntity mon4, ExerciseEntity mon2,
                        ExerciseEntity thu3, ExerciseEntity thu2) {}

    @Test
    void readGeneratesTheWeeksProposalOnceAndReturnsItPending() {
        RegisteredUser u = registerUser("Week Proposal Read");
        Back b = back(u.id());

        List<WeekProposal> first = read(u, b.meso());
        List<WeekProposal> second = read(u, b.meso());

        assertThat(first).singleElement().satisfies(p -> {
            assertThat(p.getWeek()).isEqualTo(2);
            assertThat(p.getKind()).isEqualTo(WeekProposal.KindEnum.WEEKLY);
            assertThat(p.getStatus()).isEqualTo(WeekProposal.StatusEnum.PENDING);
            assertThat(p.getMode()).isEqualTo(WeekProposal.ModeEnum.MANUAL);
            assertThat(p.getMesocycleId()).isEqualTo(b.meso().getId());
            assertThat(p.getDecidedAt()).isNull();
            assertThat(setLines(p)).extracting(WeekProposalLine::getExerciseId)
                .containsExactly(b.thu2().getId(), b.mon2().getId());
            assertThat(setLines(p)).allSatisfy(l -> {
                assertThat(l.getFrom()).isEqualByComparingTo(BigDecimal.valueOf(2));
                assertThat(l.getTo()).isEqualByComparingTo(BigDecimal.valueOf(3));
                assertThat(l.getDecision()).isNull();
                assertThat(l.getMuscleGroup()).isEqualTo("back");
                assertThat(l.getDayName()).isNotBlank();
            });
            WeekProposalMuscle back = muscle(p, "back");
            assertThat(back.getTier()).isEqualTo(WeekProposalMuscle.TierEnum.EMPHASIZE);
            assertThat(back.getSetsBefore()).isEqualTo(11);
            assertThat(back.getSetsAfter()).isEqualTo(13);
            assertThat(back.getLineCount())
                .isEqualTo((int) p.getLines().stream().filter(l -> "back".equals(l.getMuscleGroup())).count());
            assertThat(back.getReasons()).isNotEmpty();
        });
        assertThat(second).singleElement().satisfies(p -> assertThat(p.getId()).isEqualTo(first.get(0).getId()));
        assertThat(proposalRepository.findAll().stream()
            .filter(p -> p.getMesocycleId().equals(b.meso().getId()))).hasSize(1);
        assertThat(List.of(sets(b.mon4()), sets(b.mon2()), sets(b.thu3()), sets(b.thu2())))
            .containsExactly(4, 2, 3, 2);
    }

    @Test
    void acceptingOneLineWritesTheExerciseAndSyncsTheLedger() {
        RegisteredUser u = registerUser("Week Proposal Accept");
        Back b = back(u.id());
        WeekProposal p = read(u, b.meso()).get(0);
        String thuLine = lineOf(p, b.thu2()).getId();

        WeekProposal after = decide(u, b.meso(), p, new WeekProposalDecisionRequest()
            .decisions(List.of(decision(thuLine, WeekProposalLineDecision.DecisionEnum.ACCEPTED))), HttpStatus.OK,
            WeekProposal.class);

        assertThat(sets(b.thu2())).isEqualTo(3);
        assertThat(sets(b.mon2())).isEqualTo(2);
        assertThat(after.getStatus()).isEqualTo(WeekProposal.StatusEnum.PENDING);
        assertThat(lineOf(after, b.thu2()).getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.ACCEPTED);
        assertThat(lineOf(after, b.mon2()).getDecision()).isNull();
        MuscleGroupVolumeLogEntity ledger = ledger(u.id(), b.meso(), "back");
        assertThat(ledger.getCurrentSets()).isEqualTo(12);
        assertThat(ledger.getSource().adjustments()).singleElement().satisfies(a -> {
            assertThat(a.kind()).isEqualTo("pattern");
            assertThat(a.label()).isEqualTo("W2: +1 (11 → 12)");
        });

        // the same decision again is a no-op
        WeekProposal again = decide(u, b.meso(), p, new WeekProposalDecisionRequest()
            .decisions(List.of(decision(thuLine, WeekProposalLineDecision.DecisionEnum.ACCEPTED))), HttpStatus.OK,
            WeekProposal.class);
        assertThat(lineOf(again, b.thu2()).getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.ACCEPTED);
        assertThat(sets(b.thu2())).isEqualTo(3);
        assertThat(ledger(u.id(), b.meso(), "back").getSource().adjustments()).hasSize(1);
    }

    @Test
    void keepingALineWritesNothing() {
        RegisteredUser u = registerUser("Week Proposal Keep");
        Back b = back(u.id());
        WeekProposal p = read(u, b.meso()).get(0);

        WeekProposal after = decide(u, b.meso(), p, new WeekProposalDecisionRequest()
            .decisions(List.of(decision(lineOf(p, b.thu2()).getId(), WeekProposalLineDecision.DecisionEnum.KEPT))),
            HttpStatus.OK, WeekProposal.class);

        assertThat(lineOf(after, b.thu2()).getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.KEPT);
        assertThat(List.of(sets(b.mon4()), sets(b.mon2()), sets(b.thu3()), sets(b.thu2())))
            .containsExactly(4, 2, 3, 2);
        assertThat(volumeRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(u.id(), List.of(b.meso().getId())))
            .isEmpty();
    }

    @Test
    void acceptRestOnAFreshProposalAppliesIt() {
        RegisteredUser u = registerUser("Week Proposal Accept Rest");
        Back b = back(u.id());
        WeekProposal p = read(u, b.meso()).get(0);

        WeekProposal after = decide(u, b.meso(), p, new WeekProposalDecisionRequest().acceptRest(true),
            HttpStatus.OK, WeekProposal.class);

        assertThat(after.getStatus()).isEqualTo(WeekProposal.StatusEnum.APPLIED);
        assertThat(after.getDecidedAt()).isNotNull();
        assertThat(after.getLines()).allSatisfy(l ->
            assertThat(l.getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.ACCEPTED));
        assertThat(List.of(sets(b.mon4()), sets(b.mon2()), sets(b.thu3()), sets(b.thu2())))
            .containsExactly(4, 3, 3, 3);
        MesoWeekProposalEntity stored = proposalRepository.findById(p.getId()).orElseThrow();
        assertThat(stored.getPlanAfter()).containsEntry(b.mon2().getId().toString(), 3)
            .containsEntry(b.thu2().getId().toString(), 3).containsEntry(b.mon4().getId().toString(), 4);
        assertThat(ledger(u.id(), b.meso(), "back").getCurrentSets()).isEqualTo(13);
        assertThat(ledger(u.id(), b.meso(), "back").getSource().adjustments()).singleElement()
            .satisfies(a -> assertThat(a.label()).isEqualTo("W2: +2 (11 → 13)"));

        // closed: any further decision is refused
        String body = decide(u, b.meso(), p, new WeekProposalDecisionRequest().keepRest(true),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_WEEK_PROPOSAL_CLOSED");
    }

    @Test
    void keepRestClosesTheProposalWithNothingWritten() {
        RegisteredUser u = registerUser("Week Proposal Keep Rest");
        Back b = back(u.id());
        WeekProposal p = read(u, b.meso()).get(0);

        WeekProposal after = decide(u, b.meso(), p, new WeekProposalDecisionRequest().keepRest(true),
            HttpStatus.OK, WeekProposal.class);

        assertThat(after.getStatus()).isEqualTo(WeekProposal.StatusEnum.APPLIED);
        assertThat(after.getLines()).allSatisfy(l ->
            assertThat(l.getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.KEPT));
        assertThat(List.of(sets(b.mon4()), sets(b.mon2()), sets(b.thu3()), sets(b.thu2())))
            .containsExactly(4, 2, 3, 2);
    }

    @Test
    void aLineWhoseRowHeEditedSinceIsRecordedKeptAndHisNumberStands() {
        RegisteredUser u = registerUser("Week Proposal Stale");
        Back b = back(u.id());
        WeekProposal p = read(u, b.meso()).get(0);
        ExerciseEntity edited = exerciseRepository.findById(b.thu2().getId()).orElseThrow();
        edited.setWorkingSets(5);
        exerciseRepository.saveAndFlush(edited);

        WeekProposal after = decide(u, b.meso(), p, new WeekProposalDecisionRequest()
            .decisions(List.of(decision(lineOf(p, b.thu2()).getId(), WeekProposalLineDecision.DecisionEnum.ACCEPTED))),
            HttpStatus.OK, WeekProposal.class);

        assertThat(lineOf(after, b.thu2()).getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.KEPT);
        assertThat(sets(b.thu2())).isEqualTo(5);
    }

    @Test
    void invalidDecisionsAreRefused() {
        RegisteredUser u = registerUser("Week Proposal Invalid");
        Back b = back(u.id());
        WeekProposal p = read(u, b.meso()).get(0);
        String thuLine = lineOf(p, b.thu2()).getId();

        assertHasRequestError(decide(u, b.meso(), p, new WeekProposalDecisionRequest()
                .decisions(List.of(decision("no-such-line", WeekProposalLineDecision.DecisionEnum.ACCEPTED))),
            HttpStatus.BAD_REQUEST, String.class), "TRAIN_WEEK_PROPOSAL_DECISION_INVALID");
        assertHasRequestError(decide(u, b.meso(), p, new WeekProposalDecisionRequest(),
            HttpStatus.BAD_REQUEST, String.class), "TRAIN_WEEK_PROPOSAL_DECISION_INVALID");
        assertHasRequestError(decide(u, b.meso(), p, new WeekProposalDecisionRequest().decisions(List.of())
                .acceptRest(false), HttpStatus.BAD_REQUEST, String.class), "TRAIN_WEEK_PROPOSAL_DECISION_INVALID");
        assertHasRequestError(decide(u, b.meso(), p, new WeekProposalDecisionRequest().acceptRest(true).keepRest(true),
            HttpStatus.BAD_REQUEST, String.class), "TRAIN_WEEK_PROPOSAL_DECISION_INVALID");
        assertHasRequestError(decide(u, b.meso(), p, new WeekProposalDecisionRequest().decisions(List.of(
                decision(thuLine, WeekProposalLineDecision.DecisionEnum.ACCEPTED),
                decision(thuLine, WeekProposalLineDecision.DecisionEnum.KEPT))),
            HttpStatus.BAD_REQUEST, String.class), "TRAIN_WEEK_PROPOSAL_DECISION_INVALID");
        assertThat(sets(b.thu2())).isEqualTo(2); // nothing of the refused requests was written

        decide(u, b.meso(), p, new WeekProposalDecisionRequest()
            .decisions(List.of(decision(thuLine, WeekProposalLineDecision.DecisionEnum.KEPT))), HttpStatus.OK,
            WeekProposal.class);
        assertHasRequestError(decide(u, b.meso(), p, new WeekProposalDecisionRequest()
                .decisions(List.of(decision(thuLine, WeekProposalLineDecision.DecisionEnum.ACCEPTED))),
            HttpStatus.BAD_REQUEST, String.class), "TRAIN_WEEK_PROPOSAL_DECISION_INVALID");
        assertThat(sets(b.thu2())).isEqualTo(2);
    }

    @Test
    void anotherUsersRunAndProposalAreNotFound() {
        RegisteredUser owner = registerUser("Week Proposal Owner");
        RegisteredUser other = registerUser("Week Proposal Other");
        Back b = back(owner.id());
        WeekProposal p = read(owner, b.meso()).get(0);

        String readBody = getForBody(url(b.meso()), other.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(readBody, "TRAIN_MESO_NOT_FOUND");
        String decideBody = decide(other, b.meso(), p, new WeekProposalDecisionRequest().acceptRest(true),
            HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(decideBody, "TRAIN_WEEK_PROPOSAL_NOT_FOUND");
        String unknown = postForBody(url(b.meso()) + "/" + UUID.randomUUID() + "/decisions",
            new WeekProposalDecisionRequest().acceptRest(true), owner.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(unknown, "TRAIN_WEEK_PROPOSAL_NOT_FOUND");
        assertThat(sets(b.thu2())).isEqualTo(2);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    /** Back at 11 (Mon 4 + 2, Thu 3 + 2), emphasized, every planned set logged in week 1; the run is in week 2. */
    private Back back(UUID owner) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 1, 6, CURVE);
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(owner, meso.getId(), "Csütörtök", "gym", 3, "active");
        Back b = new Back(owner, meso,
            exercise(owner, mon, "Evezés", "back-mid", 4), exercise(owner, mon, "Lehúzás", "back-wide", 2),
            exercise(owner, thu, "Kábeles evezés", "back-mid", 3), exercise(owner, thu, "Húzódzkodás", "back-wide", 2));
        logWeek(owner, meso, mon, 0, b.mon4(), b.mon2());
        logWeek(owner, meso, thu, 3, b.thu3(), b.thu2());
        return b;
    }

    private ExerciseEntity exercise(UUID owner, WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private void logWeek(UUID owner, MesocycleEntity meso, WorkoutSessionEntity day, int dayOffset,
                         ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(owner, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }

    private static String url(MesocycleEntity meso) {
        return "/api/train/mesocycles/" + meso.getId() + "/week-proposals";
    }

    private List<WeekProposal> read(RegisteredUser u, MesocycleEntity meso) {
        return getForList(url(meso), u.headers(), HttpStatus.OK, WeekProposal.class);
    }

    private <T> T decide(RegisteredUser u, MesocycleEntity meso, WeekProposal p, WeekProposalDecisionRequest request,
                         HttpStatus expected, Class<T> type) {
        return postForBody(url(meso) + "/" + p.getId() + "/decisions", request, u.headers(), expected, type);
    }

    private static WeekProposalLineDecision decision(String lineId, WeekProposalLineDecision.DecisionEnum d) {
        return new WeekProposalLineDecision().lineId(lineId).decision(d);
    }

    private static List<WeekProposalLine> setLines(WeekProposal p) {
        return p.getLines().stream().filter(l -> l.getKind() == WeekProposalLine.KindEnum.SETS).toList();
    }

    private static WeekProposalLine lineOf(WeekProposal p, ExerciseEntity e) {
        return setLines(p).stream().filter(l -> l.getExerciseId().equals(e.getId())).findFirst().orElseThrow();
    }

    private static WeekProposalMuscle muscle(WeekProposal p, String name) {
        return p.getMuscles().stream().filter(m -> name.equals(m.getMuscle())).findFirst().orElseThrow();
    }

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }

    private MuscleGroupVolumeLogEntity ledger(UUID owner, MesocycleEntity meso, String group) {
        return volumeRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId())).stream()
            .filter(r -> group.equals(r.getMuscle())).findFirst().orElseThrow();
    }
}
