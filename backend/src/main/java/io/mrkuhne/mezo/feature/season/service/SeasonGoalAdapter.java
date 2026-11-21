package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.FeasibilityPreviewRequest;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalFeasibilityService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalPrescriptionCalculator;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalPlanLinkService;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.DayTargetProjector;
import io.mrkuhne.mezo.feature.nutrition.service.EnergyBase;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.DayMovement;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SeasonGoalPort} over the goal engine. Lives in the season feature (not in goal) on purpose: the season sits
 * ABOVE goal / train / biometrics in the feature graph (it also implements train's {@code SeasonGatePort}), so a
 * goal-side adapter would close a goal → season → goal cycle. The draft projection runs the SAME
 * {@link GoalPrescriptionCalculator} and {@link DayTargetProjector} the saved path and the Fuel day use, on a
 * detached, never-saved goal.
 */
@Component
@RequiredArgsConstructor
public class SeasonGoalAdapter implements SeasonGoalPort {

    private static final String PLAN_MESOCYCLE = "mesocycle";

    private final GoalService goalService;
    private final GoalRepository goalRepository;
    private final GoalPrescriptionCalculator calculator;
    private final GoalFeasibilityService feasibilityService;
    private final GoalPlanLinkService linkService;
    private final GoalPlanLinkRepository linkRepository;
    private final NutritionTargetsProperties nutritionTargets;

    @Override
    public UUID createGoal(UUID owner, GoalFields f) {
        return goalService.createGoal(owner, upsert(f, null)).getId();
    }

    @Override
    public void updateGoal(UUID owner, UUID goalId, GoalFields f) {
        GoalEntity existing = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, owner).orElse(null);
        goalService.updateGoal(owner, goalId, upsert(f, existing));
    }

    @Override
    public void activate(UUID owner, UUID goalId) {
        goalService.activateGoal(owner, goalId);
    }

    @Override
    public void archive(UUID owner, UUID goalId) {
        goalService.archiveGoal(owner, goalId);
    }

    @Override
    public Optional<GoalView> goal(UUID owner, UUID goalId) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, owner).map(SeasonGoalAdapter::view);
    }

    @Override
    public Optional<Expenditure> learnedExpenditure(UUID owner, UUID goalId) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, owner)
            .map(GoalEntity::getTdeeBootstrap)
            .filter(b -> b.learned() && b.formulaNeatBaselineKcal() != null && b.neatBaselineKcal() != null)
            .map(b -> {
                BigDecimal eat = b.weeklyEatKcalPerDay() == null ? BigDecimal.ZERO : b.weeklyEatKcalPerDay();
                return new Expenditure(b.formulaNeatBaselineKcal().add(eat).setScale(0, RoundingMode.HALF_UP).intValue(),
                    b.neatBaselineKcal().add(eat).setScale(0, RoundingMode.HALF_UP).intValue());
            });
    }

    @Override
    public Optional<GoalView> liveActive(UUID owner) {
        return goalRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active").stream()
            .filter(g -> !g.isDeleted())
            .findFirst().map(SeasonGoalAdapter::view);
    }

    @Override
    public Optional<DraftTargets> previewTargets(UUID owner, UUID existingGoalId, GoalFields draft,
                                                 DraftEnergy energy, LocalDate on) {
        GoalEntity existing = existingGoalId == null ? null
            : goalRepository.findByIdAndCreatedByAndDeletedFalse(existingGoalId, owner).orElse(null);
        GoalEntity g = detached(owner, existing, draft);
        AtomicReference<BigDecimal> rest = new AtomicReference<>();
        GoalPrescriptionCalculator.Calculation calc = calculator.calculate(owner, g, null, r -> {
            rest.set(r);
            return energy.weeklyEat(r);
        });
        if (calc.bootstrap() == null || calc.prescription() == null) {
            return Optional.empty();
        }
        long week = Math.max(1, ChronoUnit.DAYS.between(draft.startDate(), on) / 7 + 1);
        GoalPrescriptionJson.Segment seg = segmentFor(calc.prescription(), week);
        if (seg == null || seg.kcal() == null) {
            return Optional.empty();
        }
        EnergyBase base = EnergyBase.of(calc.bootstrap());
        int move = energy.trainDayMovementKcal(rest.get());
        DailyTargets train = project(seg, base, move);
        DailyTargets restDay = DayTargetProjector.project(seg, base, () -> DayMovement.NONE, nutritionTargets);
        // A gym + sport day serves both sessions (the served-target model credits every logged session), so the
        // preview projects it — and every weekday of the week total — through the same projector with that day's
        // own movement.
        Integer bothMove = energy.trainSportDayMovementKcal(rest.get());
        DayTargets both = bothMove == null ? null : dayTargets(project(seg, base, bothMove));
        int weekKcal = 0;
        for (int m : energy.weekdayMovementKcal(rest.get())) {
            weekKcal += m == 0 ? restDay.kcal() : project(seg, base, m).kcal();
        }
        return Optional.of(new DraftTargets(dayTargets(train), dayTargets(restDay), both, weekKcal,
            seg.kcal(), flags(calc.prescription().guardStatus())));
    }

    private DailyTargets project(GoalPrescriptionJson.Segment seg, EnergyBase base, int movementKcal) {
        return DayTargetProjector.project(seg, base, () -> new DayMovement(true, movementKcal, 0, 0), nutritionTargets);
    }

    private static DayTargets dayTargets(DailyTargets t) {
        return new DayTargets(t.kcal(), t.p(), t.c());
    }

    @Override
    public Feasibility feasibility(GoalFields f) {
        FeasibilityPreviewResponse r = feasibilityService.preview(FeasibilityPreviewRequest.builder()
            .trajectory(f.trajectory()).startWeightKg(f.startWeightKg()).targetWeightKg(f.targetWeightKg())
            .startDate(f.startDate()).targetDate(f.targetDate()).build());
        String verdict = switch (r.getVerdict().getValue()) {
            case "feasible" -> "feasible";
            case "aggressive" -> "aggressive";
            default -> "warnings";
        };
        return new Feasibility(verdict, r.getDerivedRatePctPerWeek());
    }

    @Override
    public List<UUID> linkedMesocycles(UUID owner, UUID goalId) {
        return linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goalId, owner).stream()
            .filter(l -> PLAN_MESOCYCLE.equals(l.getPlanType()))
            .map(GoalPlanLinkEntity::getPlanId)
            .toList();
    }

    @Override
    public void link(UUID owner, UUID goalId, UUID mesocycleId, LocalDate mesocycleStart) {
        if (linkedMesocycles(owner, goalId).contains(mesocycleId)) {
            return;
        }
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, owner).orElseThrow();
        int goalWeeks = (int) Math.max(1, ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate()));
        long fromStart = ChronoUnit.DAYS.between(goal.getStartDate(), mesocycleStart);
        int startWeek = (int) Math.min(goalWeeks, Math.max(1, fromStart / 7 + 1));
        linkService.attachPlan(owner, goalId, GoalPlanAttachRequest.builder()
            .planType(PLAN_MESOCYCLE).planId(mesocycleId).startWeek(startWeek).build());
    }

    /**
     * The segment covering {@code week}; before the first segment the first one; past the last one (the target is
     * reached — a pace can make the goal shorter than the season) the last one HELD: the goal balance set to 0, so
     * the day targets are the maintenance ones.
     */
    static GoalPrescriptionJson.Segment segmentFor(GoalPrescriptionJson prescription, long week) {
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(prescription, week);
        if (seg != null || prescription.segments() == null || prescription.segments().isEmpty()) {
            return seg;
        }
        List<GoalPrescriptionJson.Segment> all = prescription.segments();
        GoalPrescriptionJson.Segment first = all.get(0);
        if (first.fromWeek() != null && week < first.fromWeek()) {
            return first;
        }
        GoalPrescriptionJson.Segment last = all.get(all.size() - 1);
        return new GoalPrescriptionJson.Segment(last.fromWeek(), last.toWeek(), last.label(), last.kcal(),
            last.proteinG(), last.carbsG(), last.fatG(), last.sleepTargetH(), last.restDays(), BigDecimal.ZERO, 0,
            last.trainingDayKcal(), last.restDayKcal(), last.rationale());
    }

    /** A never-saved goal carrying the draft; the stored goal lends its id (links), overrides and adjustment. */
    private GoalEntity detached(UUID owner, GoalEntity existing, GoalFields f) {
        GoalEntity g = new GoalEntity();
        g.setId(existing == null ? null : existing.getId());
        g.setCreatedBy(owner);
        g.setTitle(f.title());
        g.setStatus(existing == null ? "planned" : existing.getStatus());
        g.setTrajectory(f.trajectory());
        g.setGuards(f.guards() == null ? List.of() : new ArrayList<>(f.guards()));
        g.setStartDate(f.startDate());
        g.setTargetDate(f.targetDate());
        g.setStartWeightKg(f.startWeightKg());
        g.setTargetWeightKg(f.targetWeightKg());
        g.setRateTargetPctPerWeek(feasibilityService.deriveRatePctPerWeek(
            f.trajectory(), f.startWeightKg(), f.targetWeightKg(), f.startDate(), f.targetDate()));
        if (existing != null) {
            if (f.startDate().equals(existing.getStartDate())) {
                g.setSegmentOverrides(existing.getSegmentOverrides());
            }
            g.setBalanceAdjustmentKcal(existing.getBalanceAdjustmentKcal());
        }
        return g;
    }

    private static GuardFlags flags(GoalPrescriptionJson.GuardStatus s) {
        if (s == null) {
            return new GuardFlags(false, List.of(), null);
        }
        boolean strength = s.strength() != null && Boolean.TRUE.equals(s.strength().breached());
        List<String> below = s.muscle() == null || s.muscle().belowMaintenanceMuscles() == null
            ? List.of() : List.copyOf(s.muscle().belowMaintenanceMuscles());
        Boolean rate = s.muscle() == null ? null : s.muscle().rateWithinCap();
        return new GuardFlags(strength, below, rate);
    }

    private static GoalUpsertRequest upsert(GoalFields f, GoalEntity existing) {
        return GoalUpsertRequest.builder()
            .title(f.title()).trajectory(f.trajectory())
            .guards(f.guards() == null ? new ArrayList<>() : new ArrayList<>(f.guards()))
            .startDate(f.startDate()).targetDate(f.targetDate())
            .startWeightKg(f.startWeightKg()).targetWeightKg(f.targetWeightKg())
            .identityFrame(existing == null ? null : existing.getIdentityFrame())
            .mealsPerDay(existing == null ? null : existing.getMealsPerDay())
            .wakeTime(existing == null ? null : existing.getWakeTime())
            .bedTime(existing == null ? null : existing.getBedTime())
            .build();
    }

    private static GoalView view(GoalEntity g) {
        return new GoalView(g.getId(), g.getStatus(), new GoalFields(g.getTitle(), g.getTrajectory(), g.getStartDate(),
            g.getTargetDate(), g.getStartWeightKg(), g.getTargetWeightKg(),
            g.getGuards() == null ? List.of() : List.copyOf(g.getGuards())),
            g.getBalanceAdjustmentKcal(), g.getSegmentOverrides() == null ? null : g.getSegmentOverrides().toString());
    }
}
