package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * The strength story curve ("Az erőd íve", Titanium T13): an exercise's e1RM over time, one
 * point per session it was logged in. No Spring, no DB — hand it the sets already grouped by
 * session and it hands back the curve.
 *
 * <p>Contract, binding for the wire:
 * <ul>
 *   <li><b>Ordering</b> — oldest first.</li>
 *   <li><b>Value</b> — each point is that session's <i>best eligible</i> e1RM, scale 1 HALF_UP.</li>
 *   <li><b>Eligibility</b> — {@link OneRepMax#eligible} decides: working kind, not skipped,
 *       positive load, reps in {@code 1..}{@link OneRepMax#REP_CAP}. Epley itself is never
 *       re-implemented here; {@link OneRepMax#estimate} owns the formula.</li>
 *   <li><b>Gaps</b> — a session with no eligible set (bodyweight-only, all-warmup, all skipped,
 *       every set above the rep cap) is <b>omitted entirely</b>, never emitted as a zero, so the
 *       reader can tell "no data" from "zero".</li>
 *   <li><b>Cap</b> — at most {@link #MAX_POINTS} points; a longer history keeps the NEWEST.</li>
 * </ul>
 *
 * <p>A point is dated by the latest instant among the sets that produced it ({@code doneAt},
 * falling back to {@code createdAt}) in the system zone. A set with neither is undatable and
 * cannot sit on a dated curve, so it contributes nothing.
 */
public final class E1rmSeries {

    private E1rmSeries() {}

    /** One year of weekly points — the curve's window (product decision, Titanium T13). */
    public static final int MAX_POINTS = 52;

    /** One session's best eligible e1RM, on the day that session happened. */
    public record Point(LocalDate date, BigDecimal e1rm) {}

    /**
     * Builds the curve from sets already grouped by session (one collection per session; the
     * groups may arrive in any order).
     */
    public static List<Point> from(Collection<? extends Collection<ExerciseSetEntity>> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return List.of();
        }
        List<Point> points = new ArrayList<>();
        for (Collection<ExerciseSetEntity> session : sessions) {
            Point point = pointFor(session);
            if (point != null) {
                points.add(point);
            }
        }
        points.sort(Comparator.comparing(Point::date));
        return points.size() > MAX_POINTS
            ? List.copyOf(points.subList(points.size() - MAX_POINTS, points.size()))
            : List.copyOf(points);
    }

    /** The session's point, or {@code null} when nothing in it is eligible (a gap). */
    private static Point pointFor(Collection<ExerciseSetEntity> session) {
        if (session == null || session.isEmpty()) {
            return null;
        }
        BigDecimal best = null;
        Instant at = null;
        for (ExerciseSetEntity set : session) {
            if (set == null || !OneRepMax.eligible(set)) {
                continue;
            }
            Instant instant = instantOf(set);
            if (instant == null) {
                continue; // undatable row: it cannot be placed on the curve
            }
            BigDecimal estimate = OneRepMax.estimate(set.getWeightKg(), set.getReps());
            if (estimate == null) {
                continue; // defensive: eligible() and estimate() agree on the rules
            }
            if (best == null || estimate.compareTo(best) > 0) {
                best = estimate;
            }
            if (at == null || instant.isAfter(at)) {
                at = instant;
            }
        }
        return best == null ? null
            : new Point(at.atZone(ZoneId.systemDefault()).toLocalDate(),
                best.setScale(1, RoundingMode.HALF_UP));
    }

    private static Instant instantOf(ExerciseSetEntity set) {
        return set.getDoneAt() != null ? set.getDoneAt() : set.getCreatedAt();
    }
}
