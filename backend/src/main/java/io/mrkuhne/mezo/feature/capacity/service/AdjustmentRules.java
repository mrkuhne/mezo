package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.SkipSession;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/**
 * The accept rules of one ledger step as a pure check (Boop B7 K3, mezo-r36n9.17): {@link DayAdjustmentService} throws
 * the violation on accept, and {@link ProposalGenerator} drops a draft that would get one, so Boop never proposes
 * something the accept would refuse. The plan is read through {@link PlanView} — the ledger's raw-plan ports on accept,
 * the {@link WeekPicture} in the generator.
 */
public final class AdjustmentRules {

    /** Train's code for "a workout of that day is running" — surfaced as-is so the phone shows train's own words. */
    static final String TRAIN_DAY_WORKOUT_RUNNING = "TRAIN_DAY_WORKOUT_RUNNING";

    private AdjustmentRules() {
    }

    /** What the rules need to know about the plan (always the RAW plan, never the ledger itself). */
    public interface PlanView {
        boolean gymPlanned(LocalDate date);

        boolean gymDoneOn(LocalDate date);

        Optional<UUID> plannedTemplate(LocalDate date);

        boolean ownsTemplate(UUID templateSessionId);

        boolean workoutRunning(UUID templateSessionId);

        boolean gymSkipped(LocalDate date);
    }

    /** A refused step: the error code and its status. */
    public record Violation(String code, HttpStatus status) {
    }

    /**
     * The first rule {@code step} breaks, or empty. A passing move claims its days in {@code claimedTargets} /
     * {@code movedFrom} (so the next step of the same bundle sees it).
     */
    public static Optional<Violation> check(AdjustmentPayload step, LocalDate today, PlanView plan,
                                            Set<LocalDate> claimedTargets, Set<LocalDate> movedFrom) {
        for (LocalDate d : step.touchedDays()) {
            if (d.isBefore(today)) {
                return violation("CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
            }
        }
        return switch (step) {
            case MoveSessionDay m -> move(m, plan, claimedTargets, movedFrom);
            case SkipSession s -> {
                Optional<Violation> v = sessionNotStarted(plan, s.date());
                if (v.isPresent()) {
                    yield v;
                }
                yield !plan.gymPlanned(s.date()) || plan.gymSkipped(s.date())
                    ? violation("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT) : Optional.empty();
            }
            case AdjustmentPayload.ShiftSessionTime x -> sessionNotStarted(plan, x.date());
            case AdjustmentPayload.ShortenSession x -> sessionNotStarted(plan, x.date());
            case AdjustmentPayload.LightenSession x -> sessionNotStarted(plan, x.date());
            case AdjustmentPayload.SwapSessionKind x -> sessionNotStarted(plan, x.date());
            case AdjustmentPayload.ShiftBedtime x -> Optional.empty();
            case AdjustmentPayload.MoveMealEnergy x -> Optional.empty();
            case AdjustmentPayload.CalendarTodo x -> Optional.empty();
        };
    }

    private static Optional<Violation> move(MoveSessionDay m, PlanView plan, Set<LocalDate> claimedTargets,
                                            Set<LocalDate> movedFrom) {
        if (!plan.ownsTemplate(m.templateSessionId())) {
            return violation("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);
        }
        if (!monday(m.fromDate()).equals(monday(m.toDate()))) {
            return violation("CAPACITY_MOVE_OTHER_WEEK", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (plan.workoutRunning(m.templateSessionId())) {
            return violation(TRAIN_DAY_WORKOUT_RUNNING, HttpStatus.CONFLICT);
        }
        if (plan.gymDoneOn(m.fromDate())) {
            return violation("CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
        }
        if (!plan.gymPlanned(m.fromDate()) || movedFrom.contains(m.fromDate())) {
            return violation("CAPACITY_PROPOSAL_STALE", HttpStatus.CONFLICT);
        }
        if (claimedTargets.contains(m.toDate()) || plan.gymPlanned(m.toDate()) || plan.gymDoneOn(m.toDate())) {
            return violation("CAPACITY_MOVE_NOT_EMPTY_DAY", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        claimedTargets.add(m.toDate());
        movedFrom.add(m.fromDate());
        return Optional.empty();
    }

    /** The day's planned session must not be running (train's 409) or already done. */
    private static Optional<Violation> sessionNotStarted(PlanView plan, LocalDate date) {
        Optional<UUID> template = plan.plannedTemplate(date);
        if (template.isPresent() && plan.workoutRunning(template.get())) {
            return violation(TRAIN_DAY_WORKOUT_RUNNING, HttpStatus.CONFLICT);
        }
        if (plan.gymDoneOn(date)) {
            return violation("CAPACITY_DAY_STARTED", HttpStatus.CONFLICT);
        }
        return Optional.empty();
    }

    static LocalDate monday(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private static Optional<Violation> violation(String code, HttpStatus status) {
        return Optional.of(new Violation(code, status));
    }
}
