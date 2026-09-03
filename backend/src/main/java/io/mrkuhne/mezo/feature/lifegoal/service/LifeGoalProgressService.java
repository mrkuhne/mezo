package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.GoalDayEntry;
import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalProgressResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalTodayResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalTodaySummary;
import io.mrkuhne.mezo.api.dto.PillarDayEntry;
import io.mrkuhne.mezo.api.dto.PillarDayStatus;
import io.mrkuhne.mezo.api.dto.PillarProgress;
import io.mrkuhne.mezo.api.dto.TrendArrow;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry;
import io.mrkuhne.mezo.feature.lifegoal.engine.LifeGoalScorer;
import io.mrkuhne.mezo.feature.lifegoal.engine.LifeGoalScorer.WeightedStatus;
import io.mrkuhne.mezo.feature.lifegoal.engine.PillarDayScore;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalWindow;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarDayEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Progress/evaluate/today assembly (Task 5, mezo-iizd.5, spec §5): stored {@code
 * life_goal_pillar_day} rows win, missing days are computed on read (never written by a plain
 * read). {@code evaluate} is the only writer here — it upserts the last 3 CLOSED days.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalProgressService {

    private static final int PROGRESS_WINDOW_DAYS = 28;
    private static final int RECENT_WINDOW_DAYS = 7;
    private static final double DOT_HIT = 0.66;
    private static final double DOT_PARTIAL = 0.33;
    private static final int SCALE = 3;

    private final LifeGoalService lifeGoalService;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;
    private final LifeGoalPillarDayRepository pillarDayRepository;
    private final List<SignalSource> sources;
    private final SignalCatalog signalCatalog;

    /** Tárolt sorok győznek; hiányzó nap olvasáskor számolódik (NEM íródik). from > to → 400. */
    @Transactional(readOnly = true)
    public LifeGoalProgressResponse progress(UUID userId, UUID goalId, LocalDate from, LocalDate to) {
        LifeGoalEntity goal = lifeGoalService.requireOwned(userId, goalId);
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "to").build(), HttpStatus.BAD_REQUEST);
        }
        List<LifeGoalPillarEntity> activePillars = activePillars(goalId);
        return buildProgress(userId, goal, activePillars, from, to);
    }

    /** Az utolsó 3 LEZÁRT nap (tegnap, −2, −3) upsertje minden aktív pillérre, majd 28 napos progress. */
    @Transactional
    public LifeGoalProgressResponse evaluate(UUID userId, UUID goalId) {
        LifeGoalEntity goal = lifeGoalService.requireOwned(userId, goalId);
        LocalDate today = LocalDate.now();
        List<LifeGoalPillarEntity> activePillars = activePillars(goalId);
        List<LocalDate> closedDays = List.of(today.minusDays(1), today.minusDays(2), today.minusDays(3));
        LocalDate latestClosed = today.minusDays(1);
        LocalDate wideFrom = latestClosed.minusDays(PROGRESS_WINDOW_DAYS);
        for (LifeGoalPillarEntity pillar : activePillars) {
            SignalWindow window = windowFor(userId, pillar, wideFrom, latestClosed);
            for (LocalDate day : closedDays) {
                PillarDayScore score = LifeGoalScorer.scoreDay(pillar.getKind(), pillar.getRule(), day, window);
                upsertPillarDay(pillar, day, score);
            }
        }
        return buildProgress(userId, goal, activePillars, today.minusDays(PROGRESS_WINDOW_DAYS - 1), today);
    }

    /** Aktív célonként: nyíl + 7 napi cél-pont-pötty + mai pillér-számláló. */
    @Transactional(readOnly = true)
    public LifeGoalTodayResponse today(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(PROGRESS_WINDOW_DAYS - 1);
        List<LifeGoalEntity> activeGoals = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> "active".equals(g.getStatus())).toList();
        List<LifeGoalTodaySummary> summaries = activeGoals.stream()
            .map(goal -> buildTodaySummary(userId, goal, from, today)).toList();
        return LifeGoalTodayResponse.builder().goals(summaries).build();
    }

    // ==== progress assembly ====

    private LifeGoalProgressResponse buildProgress(
        UUID userId, LifeGoalEntity goal, List<LifeGoalPillarEntity> activePillars, LocalDate from, LocalDate to
    ) {
        GoalComputation computation = compute(userId, activePillars, from, to);
        String goalArrow = LifeGoalScorer.arrow(computation.goalPoints(), to);
        List<GoalDayEntry> days = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Double point = computation.goalPoints().get(day);
            days.add(GoalDayEntry.builder().day(day).point(point == null ? null : BigDecimal.valueOf(point)).build());
        }
        List<PillarProgress> pillars = activePillars.stream()
            .map(p -> buildPillarProgress(p, computation.byPillar().get(p.getId()), from, to))
            .toList();
        List<String> conflicts = findConflicts(userId, goal, activePillars);
        return LifeGoalProgressResponse.builder()
            .goalId(goal.getId()).from(from).to(to)
            .arrow(TrendArrow.fromValue(goalArrow))
            .weeklyPct(weeklyPct(computation.goalPoints(), to))
            .days(days).pillars(pillars).conflicts(conflicts)
            .build();
    }

    private LifeGoalTodaySummary buildTodaySummary(UUID userId, LifeGoalEntity goal, LocalDate from, LocalDate today) {
        List<LifeGoalPillarEntity> activePillars = activePillars(goal.getId());
        GoalComputation computation = compute(userId, activePillars, from, today);
        String arrow = LifeGoalScorer.arrow(computation.goalPoints(), today);
        List<PillarDayStatus> days7 = new ArrayList<>();
        for (LocalDate day = today.minusDays(RECENT_WINDOW_DAYS - 1); !day.isAfter(today); day = day.plusDays(1)) {
            days7.add(dotStatus(computation.goalPoints().get(day)));
        }
        int pillarsHitToday = (int) activePillars.stream()
            .filter(p -> {
                PillarDayScore score = computation.byPillar().get(p.getId()).get(today);
                return score != null && "hit".equals(score.status());
            }).count();
        return LifeGoalTodaySummary.builder()
            .goalId(goal.getId()).title(goal.getTitle())
            .dimension(LifeGoalDimension.fromValue(goal.getDimension()))
            .arrow(TrendArrow.fromValue(arrow))
            .days7(days7)
            .pillarsTotal(activePillars.size())
            .pillarsHitToday(pillarsHitToday)
            .build();
    }

    private record GoalComputation(Map<UUID, SortedMap<LocalDate, PillarDayScore>> byPillar, Map<LocalDate, Double> goalPoints) {}

    /** Scores every active pillar over {@code [from-28, to]}, stored rows in {@code [from, to]} winning. */
    private GoalComputation compute(UUID userId, List<LifeGoalPillarEntity> activePillars, LocalDate from, LocalDate to) {
        LocalDate wideFrom = from.minusDays(PROGRESS_WINDOW_DAYS);
        Map<UUID, SortedMap<LocalDate, PillarDayScore>> byPillar = new LinkedHashMap<>();
        for (LifeGoalPillarEntity pillar : activePillars) {
            SignalWindow window = windowFor(userId, pillar, wideFrom, to);
            SortedMap<LocalDate, PillarDayScore> perDay = new TreeMap<>();
            for (LocalDate day = wideFrom; !day.isAfter(to); day = day.plusDays(1)) {
                perDay.put(day, LifeGoalScorer.scoreDay(pillar.getKind(), pillar.getRule(), day, window));
            }
            byPillar.put(pillar.getId(), perDay);
        }
        List<UUID> pillarIds = activePillars.stream().map(LifeGoalPillarEntity::getId).toList();
        if (!pillarIds.isEmpty()) {
            for (LifeGoalPillarDayEntity stored
                : pillarDayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(pillarIds, from, to)) {
                SortedMap<LocalDate, PillarDayScore> perDay = byPillar.get(stored.getPillarId());
                if (perDay != null) {
                    perDay.put(stored.getDay(),
                        new PillarDayScore(stored.getStatus(), stored.getValue(), stored.getTarget(), stored.getBaseline()));
                }
            }
        }
        Map<LocalDate, Double> goalPoints = new TreeMap<>();
        for (LocalDate day = wideFrom; !day.isAfter(to); day = day.plusDays(1)) {
            List<WeightedStatus> statuses = new ArrayList<>();
            for (LifeGoalPillarEntity pillar : activePillars) {
                PillarDayScore score = byPillar.get(pillar.getId()).get(day);
                if (score != null) {
                    statuses.add(new WeightedStatus(pillar.getWeight(), score.status()));
                }
            }
            Double point = LifeGoalScorer.dailyPoint(statuses);
            if (point != null) {
                goalPoints.put(day, point);
            }
        }
        return new GoalComputation(byPillar, goalPoints);
    }

    private PillarProgress buildPillarProgress(
        LifeGoalPillarEntity pillar, SortedMap<LocalDate, PillarDayScore> perDay, LocalDate from, LocalDate to
    ) {
        List<PillarDayEntry> days = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            PillarDayScore score = perDay.get(day);
            days.add(PillarDayEntry.builder().day(day)
                .status(PillarDayStatus.fromValue(score.status()))
                .value(score.value()).target(score.target()).baseline(score.baseline())
                .build());
        }
        Map<LocalDate, Double> series = new TreeMap<>();
        perDay.forEach((day, score) -> {
            Double point = pointOf(score.status());
            if (point != null) {
                series.put(day, point);
            }
        });
        String arrow = LifeGoalScorer.arrow(series, to);
        return PillarProgress.builder()
            .pillarId(pillar.getId()).arrow(TrendArrow.fromValue(arrow))
            .currentValue(averageValue(perDay, to))
            .referenceValue(referenceValue(pillar, perDay, to))
            .missingHitDays(missingHitDays(pillar, perDay, to, arrow))
            .days(days)
            .build();
    }

    private static Double pointOf(String status) {
        return LifeGoalScorer.dailyPoint(List.of(new WeightedStatus(1, status)));
    }

    private static BigDecimal averageValue(SortedMap<LocalDate, PillarDayScore> perDay, LocalDate to) {
        List<BigDecimal> values = new ArrayList<>();
        for (int i = 0; i < RECENT_WINDOW_DAYS; i++) {
            PillarDayScore score = perDay.get(to.minusDays(i));
            if (score != null && score.value() != null) {
                values.add(score.value());
            }
        }
        if (values.isEmpty()) {
            return null;
        }
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), SCALE, RoundingMode.HALF_UP);
    }

    private static BigDecimal referenceValue(
        LifeGoalPillarEntity pillar, SortedMap<LocalDate, PillarDayScore> perDay, LocalDate to
    ) {
        PillarDayScore todayScore = perDay.get(to);
        return switch (pillar.getKind()) {
            case "habit", "average" -> pillar.getRule().threshold();
            case "target" -> todayScore == null ? null : todayScore.target();
            case "baseline" -> todayScore == null ? null : todayScore.baseline();
            default -> null;
        };
    }

    private static Integer missingHitDays(
        LifeGoalPillarEntity pillar, SortedMap<LocalDate, PillarDayScore> perDay, LocalDate to, String arrow
    ) {
        if (!"habit".equals(pillar.getKind()) || !"down".equals(arrow)) {
            return null;
        }
        Integer daysPerWeek = pillar.getRule().daysPerWeek();
        if (daysPerWeek == null) {
            return null;
        }
        int hits = 0;
        for (int i = 0; i < RECENT_WINDOW_DAYS; i++) {
            PillarDayScore score = perDay.get(to.minusDays(i));
            if (score != null && "hit".equals(score.status())) {
                hits++;
            }
        }
        return Math.max(0, daysPerWeek - hits);
    }

    private static Integer weeklyPct(Map<LocalDate, Double> points, LocalDate to) {
        List<Double> last7 = new ArrayList<>();
        for (int i = 0; i < RECENT_WINDOW_DAYS; i++) {
            Double v = points.get(to.minusDays(i));
            if (v != null) {
                last7.add(v);
            }
        }
        if (last7.isEmpty()) {
            return null;
        }
        double mean = last7.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        return (int) Math.round(mean * 100);
    }

    private static PillarDayStatus dotStatus(Double point) {
        if (point == null) {
            return PillarDayStatus.NO_DATA;
        }
        if (point >= DOT_HIT) {
            return PillarDayStatus.HIT;
        }
        if (point >= DOT_PARTIAL) {
            return PillarDayStatus.PARTIAL;
        }
        return PillarDayStatus.MISS;
    }

    // ==== conflicts (spec §5 step 7) ====

    private List<String> findConflicts(UUID userId, LifeGoalEntity goal, List<LifeGoalPillarEntity> activePillars) {
        if (activePillars.isEmpty()) {
            return List.of();
        }
        List<LifeGoalEntity> otherActiveGoals = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> "active".equals(g.getStatus()) && !g.getId().equals(goal.getId())).toList();
        if (otherActiveGoals.isEmpty()) {
            return List.of();
        }
        Set<String> messages = new LinkedHashSet<>();
        for (LifeGoalPillarEntity mine : activePillars) {
            if ("linked".equals(mine.getKind())) {
                continue;
            }
            Optional<SignalCatalogEntry> mineEntry = signalCatalog.find(mine.getSource());
            if (mineEntry.isEmpty()) {
                continue;
            }
            for (LifeGoalEntity other : otherActiveGoals) {
                for (LifeGoalPillarEntity theirs : activePillars(other.getId())) {
                    if ("linked".equals(theirs.getKind())) {
                        continue;
                    }
                    Optional<SignalCatalogEntry> theirEntry = signalCatalog.find(theirs.getSource());
                    if (theirEntry.isEmpty() || !theirEntry.get().id().equals(mineEntry.get().id())) {
                        continue;
                    }
                    if (isOppositeDirection(mine, theirs)) {
                        messages.add(mineEntry.get().label() + " · két cél ellentétes irányba húzza (" + other.getTitle() + ")");
                    }
                }
            }
        }
        return List.copyOf(messages);
    }

    private static boolean isOppositeDirection(LifeGoalPillarEntity a, LifeGoalPillarEntity b) {
        boolean comparatorGroupA = isComparatorKind(a.getKind());
        boolean comparatorGroupB = isComparatorKind(b.getKind());
        if (comparatorGroupA && comparatorGroupB) {
            String ca = a.getRule().comparator();
            String cb = b.getRule().comparator();
            return ca != null && cb != null && !ca.equals(cb);
        }
        boolean directionGroupA = isDirectionKind(a.getKind());
        boolean directionGroupB = isDirectionKind(b.getKind());
        if (directionGroupA && directionGroupB) {
            String da = a.getRule().direction();
            String db = b.getRule().direction();
            return da != null && db != null && !da.equals(db);
        }
        return false;
    }

    private static boolean isComparatorKind(String kind) {
        return "habit".equals(kind) || "average".equals(kind);
    }

    private static boolean isDirectionKind(String kind) {
        return "target".equals(kind) || "baseline".equals(kind);
    }

    // ==== shared plumbing ====

    private List<LifeGoalPillarEntity> activePillars(UUID goalId) {
        return pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goalId)
            .stream().filter(LifeGoalPillarEntity::isActive).toList();
    }

    private SignalWindow windowFor(UUID userId, LifeGoalPillarEntity pillar, LocalDate from, LocalDate to) {
        return sources.stream().filter(s -> s.supports(pillar.getSource())).findFirst()
            .map(s -> s.window(userId, pillar.getSource(), from, to))
            .orElseGet(() -> SignalWindow.of(Map.of()));
    }

    private void upsertPillarDay(LifeGoalPillarEntity pillar, LocalDate day, PillarDayScore score) {
        LifeGoalPillarDayEntity entity = pillarDayRepository.findByPillarIdAndDayAndDeletedFalse(pillar.getId(), day)
            .orElseGet(() -> {
                LifeGoalPillarDayEntity e = new LifeGoalPillarDayEntity();
                e.setCreatedBy(pillar.getCreatedBy());
                e.setPillarId(pillar.getId());
                e.setDay(day);
                return e;
            });
        entity.setValue(score.value());
        entity.setTarget(score.target());
        entity.setBaseline(score.baseline());
        entity.setStatus(score.status());
        entity.setComputedAt(Instant.now());
        pillarDayRepository.save(entity);
    }
}
