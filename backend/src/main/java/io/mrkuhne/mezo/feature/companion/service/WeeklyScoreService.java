package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.MeWeekTrendPoint;
import io.mrkuhne.mezo.api.dto.MeWeekTrendResponse;
import io.mrkuhne.mezo.feature.companion.entity.WeeklyScoreEntity;
import io.mrkuhne.mezo.feature.companion.repository.WeeklyScoreRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persisted weekly score + the N-week trend (Én/Heti, bd mezo-d20.7.5, handoff 2026-08-28 §6.3).
 *
 * <p><b>Where it is stored and why.</b> Its own {@code weekly_score} table, not columns on
 * {@code weekly_review}: the score is a deterministic function of the week's logs, the review
 * narrative is not, and an empty week or a failed LLM call leaves no review row while still
 * having a perfectly good score.
 *
 * <p><b>The write rule (write-through, refresh-on-read).</b> The row is a CACHE, not a truth — a
 * retroactive log changes the week's score. So:
 * <ol>
 *   <li>every full computation of a week upserts it ({@link #record}) — which means all three
 *       paths that already compute a week keep the cache warm: {@code GET /api/me/week/{start}},
 *       {@code WeeklyReviewGenerator.gather} and {@code WeekContextRenderer} on each chat turn,
 *       all of them through {@code MeWeekService.week};</li>
 *   <li>every READ of a cached value ({@link #scoreFor}, {@link #trend}) first probes whether the
 *       week saw a score-relevant write after {@code computed_at}
 *       ({@link WeeklyScoreRepository#latestScoreInputWrittenAt}) and recomputes when it did —
 *       so a retroactive log is picked up on the next read, not at some later job;</li>
 *   <li>a week that has NOT finished yet is always recomputed — it is still moving by definition;</li>
 *   <li>every point carries its {@code computedAt} into the contract, because a cache that cannot
 *       say when it was computed is not honest.</li>
 * </ol>
 * There is deliberately no scheduled writer: the Monday job's own {@code gather} already goes
 * through {@code MeWeekService.week}, so it warms the cache as a side effect of work it does
 * anyway, and a job that wrote scores nobody reads would add a moving part for nothing.
 *
 * <p><b>Honest absence.</b> A week whose score is null (fewer than 2 scored days — the "tanulom"
 * gate) gets NO row and NO trend point; a score that disappears deletes its row. The trend is
 * therefore shorter than the requested window when history is shorter — never padded with zeros.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class WeeklyScoreService {

    private final WeeklyScoreRepository weeklyScoreRepository;
    private final DayScoreService dayScoreService;

    /** One week's rolled-up score + the four subscore averages; {@code score == null} = no score. */
    public record WeekAverages(
            Integer score, BigDecimal sleepAvg, BigDecimal fuelAvg,
            BigDecimal checkinAvg, BigDecimal activityAvg) {

        static final WeekAverages EMPTY = new WeekAverages(null, null, null, null, null);
    }

    /**
     * Write-through: rolls the week's already-computed day scores up and persists the result
     * (upsert on {@code created_by + week_start}), returning the same roll-up so the caller can
     * use it instead of computing its own — {@code MeWeekService} does exactly that, which is why
     * there is only ONE implementation of "the week's score" in the codebase.
     *
     * <p>A null score deletes any existing row: a score that stopped existing must stop being
     * served, and an absent score is absent, never a stored 0.
     */
    @Transactional
    public WeekAverages record(UUID userId, LocalDate weekStart, List<DayScoreService.DayScore> dayScores) {
        WeekAverages averages = aggregate(dayScores);
        WeeklyScoreEntity existing = weeklyScoreRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (averages.score() == null) {
            if (existing != null) {
                weeklyScoreRepository.delete(existing);
            }
            return averages;
        }
        WeeklyScoreEntity row = existing != null ? existing : new WeeklyScoreEntity();
        row.setCreatedBy(userId);
        row.setWeekStart(weekStart);
        row.setScore(averages.score());
        row.setSleepAvg(averages.sleepAvg());
        row.setFuelAvg(averages.fuelAvg());
        row.setCheckinAvg(averages.checkinAvg());
        row.setActivityAvg(averages.activityAvg());
        row.setComputedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        weeklyScoreRepository.saveAndFlush(row);
        return averages;
    }

    /**
     * One week's score, from the cache when it is still valid and recomputed (and re-cached) when
     * it is not — the {@code prevWeekScore} path, which used to pay a SECOND complete score run
     * (nine metric-series queries + seven fuel roll-ups) on every single week read.
     */
    @Transactional
    public Integer scoreFor(UUID userId, LocalDate weekStart) {
        WeeklyScoreEntity row = resolve(userId, weekStart,
                weeklyScoreRepository.findByCreatedByAndWeekStart(userId, weekStart).orElse(null));
        return row == null ? null : row.getScore();
    }

    /**
     * The hero's trend: the {@code weeks} ISO weeks ENDING at {@code endWeekStart} (inclusive),
     * oldest first, one point per week that actually has a score. Weeks without one are simply
     * absent — the series is short, never padded.
     */
    @Transactional
    public MeWeekTrendResponse trend(UUID userId, LocalDate endWeekStart, int weeks) {
        LocalDate from = endWeekStart.minusWeeks(weeks - 1L);
        Map<LocalDate, WeeklyScoreEntity> cached = weeklyScoreRepository
                .findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(userId, from, endWeekStart).stream()
                .collect(HashMap::new, (m, r) -> m.put(r.getWeekStart(), r), HashMap::putAll);

        List<MeWeekTrendPoint> points = new ArrayList<>();
        for (LocalDate week = from; !week.isAfter(endWeekStart); week = week.plusWeeks(1)) {
            WeeklyScoreEntity row = resolve(userId, week, cached.get(week));
            if (row != null) {
                points.add(toPoint(row));
            }
        }
        return MeWeekTrendResponse.builder().start(endWeekStart).weeks(weeks).points(points).build();
    }

    /**
     * The cache decision for ONE week: serve {@code cached} when it is still valid, otherwise
     * recompute and re-cache. Returns null when the week genuinely has no score.
     *
     * <p>The cheap path first: when the week's window holds no score-relevant log at all, this
     * path returns null without computing anything. Under the 6-dimension engine (mezo-jcpt.4)
     * that shortcut is a deliberate APPROXIMATION, not an identity. With no log in the window,
     * nutrition and quality have no meal and sleep has no {@code sleep_log}, so those degrade;
     * {@code logging} is DONE with an honest 0 (it measures effort, and no effort is a real
     * measurement); {@code rhythm} may well be DONE, because it reads the days BEFORE this week,
     * outside the probe's window. {@code rhythm} is excluded from the engine's gate (it does not
     * measure the day itself), so on a week with no training PLAN {@code logging} alone is ONE
     * intrinsic dimension, one short of the 2-dimension gate: every day's base is null and the
     * week's score is null. There the shortcut is exact.
     *
     * <p><b>Where it is NOT exact (accepted limitation, mezo-jcpt.11).</b> The {@code training}
     * dimension is driven by the PLAN, not by a logged session: {@code DayScoreService} reads
     * {@code WorkoutWindowQueryService.windowsFor}, and the probe deliberately does not cover the
     * training schedule tables. So a week that has planned workouts and closes with zero logs has
     * {@code training} DONE and {@code logging} DONE — two intrinsic DONE dimensions, the gate
     * opens, and each day carries a real base (~15-40, typically 25-35) in the engine's terms
     * while this path returns null and deletes the cached row. That is the same trade-off spelled
     * out on {@link WeeklyScoreRepository#latestScoreInputWrittenAt}, which lists exactly which
     * tables the probe covers — notably NOT the training schedule tables, so a schedule edit
     * alone does not invalidate a cached week.
     */
    private WeeklyScoreEntity resolve(UUID userId, LocalDate weekStart, WeeklyScoreEntity cached) {
        LocalDate weekEnd = weekStart.plusDays(6);
        Instant lastWrite = probeLastWrite(userId, weekStart, weekEnd);
        if (lastWrite == null) {
            // No score-relevant log in the window at all -> no score. Any stale row must go.
            if (cached != null) {
                weeklyScoreRepository.delete(cached);
            }
            return null;
        }
        boolean weekFinished = weekEnd.isBefore(LocalDate.now());
        boolean probeFailed = lastWrite == PROBE_FAILED; // identity: the sentinel, not a real stamp
        if (cached != null && weekFinished && !probeFailed
                && !lastWrite.isAfter(cached.getComputedAt())) {
            return cached;
        }
        record(userId, weekStart, dayScoreService.scores(userId, weekStart, weekEnd));
        return weeklyScoreRepository.findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
    }

    /** Sentinel: the probe blew up, so nothing may be trusted as fresh — recompute instead. */
    private static final Instant PROBE_FAILED = Instant.EPOCH;

    private Instant probeLastWrite(UUID userId, LocalDate weekStart, LocalDate weekEnd) {
        try {
            return weeklyScoreRepository.latestScoreInputWrittenAt(userId, weekStart, weekEnd);
        } catch (RuntimeException e) {
            log.warn("Weekly-score freshness probe failed for {} week {}: {} — recomputing",
                    userId, weekStart, e.getMessage());
            return PROBE_FAILED;
        }
    }

    private static MeWeekTrendPoint toPoint(WeeklyScoreEntity row) {
        return MeWeekTrendPoint.builder()
                .weekStart(row.getWeekStart())
                .score(row.getScore())
                .sleepAvg(row.getSleepAvg())
                .fuelAvg(row.getFuelAvg())
                .checkinAvg(row.getCheckinAvg())
                .activityAvg(row.getActivityAvg())
                .computedAt(row.getComputedAt().atOffset(java.time.ZoneOffset.UTC))
                .build();
    }

    /** The single definition of "the week's score": the {@code <2}-present honesty gate applied a
     *  second time, at week level — the same rule {@code DayEvaluationEngine} applies to a day's
     *  dimensions, here over the days' base scores — and a plain mean for each of the four legacy
     *  per-domain averages (null when the week has none). A négy cache-oszlop a hat dimenzióból
     *  négyet vesz — {@code sleepAvg←sleep, fuelAvg←nutrition, checkinAvg←logging,
     *  activityAvg←training}; a {@code quality} és a {@code rhythm} szándékosan nem kap oszlopot
     *  (mezo-jcpt.5, spec D3: a FE egyiket sem fogyasztja, így nincs migráció).
     *
     *  <p><b>{@code checkinAvg} jelentése megváltozott (mezo-el0t).</b> {@code
     *  subscoreAverage} csak a nem-null {@code logging} értékeket átlagolja — ez a képlet nem
     *  változott. Ami változott: mit jelent egy nem-null {@code logging}. Egy teljesen érintetlen
     *  nap {@code logging}-ja most null (nem mérhető), nem kitalált 0, tehát ezek a napok
     *  mostantól KIESNEK az átlagból, ahelyett hogy 0-val lefelé húznák. A {@code checkin_avg}
     *  oszlop ugyanazt a képletet futtatja, de más napkört átlagol — a már cache-elt heti sorok a
     *  régi szabály szerint számoltak, ezért egyszeri purge kell rájuk (lásd
     *  202609051200_mezo-el0t_weekly_score_cache_invalidation.sql). */
    static WeekAverages aggregate(List<DayScoreService.DayScore> dayScores) {
        if (dayScores == null || dayScores.isEmpty()) {
            return WeekAverages.EMPTY;
        }
        List<Integer> present = dayScores.stream()
                .map(DayScoreService.DayScore::score).filter(Objects::nonNull).toList();
        if (present.size() < 2) {
            return WeekAverages.EMPTY;
        }
        return new WeekAverages(
                (int) Math.round(present.stream().mapToInt(Integer::intValue).average().orElseThrow()),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::sleep),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::nutrition),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::logging),
                subscoreAverage(dayScores, DayScoreService.DaySubscores::training));
    }

    private static BigDecimal subscoreAverage(
            List<DayScoreService.DayScore> dayScores, Function<DayScoreService.DaySubscores, Integer> of) {
        List<Integer> values = dayScores.stream()
                .map(DayScoreService.DayScore::subscores).filter(Objects::nonNull)
                .map(of).filter(Objects::nonNull).toList();
        if (values.isEmpty()) {
            return null;
        }
        return BigDecimal.valueOf(values.stream().mapToInt(Integer::intValue).average().orElseThrow())
                .setScale(2, RoundingMode.HALF_UP);
    }
}
