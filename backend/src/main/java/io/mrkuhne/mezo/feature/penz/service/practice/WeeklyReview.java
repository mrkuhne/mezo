package io.mrkuhne.mezo.feature.penz.service.practice;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * The practice week (Boop Pénz L7, mezo-r36n9.105, build notes §3.1 PenzPracticeWeek + call 3) — pure figures, no
 * copy (that is {@link PracticeCopy}). The week starts on Monday (the owner's money timezone, Europe/Budapest by
 * default, decides the date). A win is R &gt; 0. Distribution: big win R ≥ +2, small loss −1,2 ≤ R &lt; 0, worse than
 * the limit R &lt; −1,5; healthy = nothing below the limit. The most common mistake = the most frequent tag among the
 * week's mistake-flagged trades (ties → the costlier, then the tag order); its cost = −Σ P/L (HUF) of those trades
 * when negative, else 0.
 */
public final class WeeklyReview {

    static final BigDecimal BIG_WIN = new BigDecimal("2");
    static final BigDecimal SMALL_LOSS_FLOOR = new BigDecimal("-1.2");
    public static final BigDecimal LIMIT = new BigDecimal("-1.5");

    private WeeklyReview() {
    }

    /** One closed paper trade as the review sees it. */
    public record ReviewTrade(List<PracticeTag> tags, boolean mistake, long pnlHufMinor, BigDecimal rMultiple,
                              LocalDate exitDate, Boolean stopRespected) {

        boolean win() {
            return rMultiple != null ? rMultiple.signum() > 0 : pnlHufMinor > 0;
        }
    }

    public record Setup(PracticeTag tag, int count, int wins, BigDecimal avgR) {
    }

    public record Distribution(int bigWins, int smallLosses, int worseThanLimit, boolean healthy) {
    }

    public record Mistake(PracticeTag tag, int count, long costHufMinor) {
    }

    public record CurvePoint(LocalDate date, long cumulativeHufMinor) {
    }

    /**
     * The week's figures. {@code cleanCount}/{@code cleanAvgR} are the trades not flagged as a mistake,
     * {@code mistakeCount}/{@code mistakeAvgR} the flagged ones; {@code stopBrokenCount} = exits beyond the stop;
     * {@code earlyCloseWins} = winning trades tagged {@code korai_zaras}.
     */
    public record Week(LocalDate weekStart, LocalDate weekEnd, int closedCount, Integer winRatePct, BigDecimal avgR,
                       List<Setup> bySetup, Distribution distribution, Mistake commonMistake,
                       List<CurvePoint> curve, long netPnlHufMinor, int cleanCount, BigDecimal cleanAvgR,
                       int mistakeCount, BigDecimal mistakeAvgR, int stopBrokenCount, int earlyCloseWins) {
    }

    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /** The review of the week holding {@code asOf}, from all closed trades (only those exited in it count). */
    public static Week review(Collection<ReviewTrade> closed, LocalDate asOf) {
        LocalDate start = weekStart(asOf);
        LocalDate end = start.plusDays(6);
        List<ReviewTrade> week = closed.stream()
            .filter(t -> !t.exitDate().isBefore(start) && !t.exitDate().isAfter(end)).toList();

        int wins = (int) week.stream().filter(ReviewTrade::win).count();
        Integer winRate = week.isEmpty() ? null
            : BigDecimal.valueOf(wins * 100L).divide(BigDecimal.valueOf(week.size()), 0, RoundingMode.HALF_UP)
                .intValueExact();

        List<Setup> bySetup = new ArrayList<>();
        for (PracticeTag tag : PracticeTag.values()) {
            List<ReviewTrade> tagged = week.stream().filter(t -> t.tags().contains(tag)).toList();
            if (!tagged.isEmpty()) {
                bySetup.add(new Setup(tag, tagged.size(), (int) tagged.stream().filter(ReviewTrade::win).count(),
                    avgR(tagged)));
            }
        }

        int big = 0;
        int small = 0;
        int worse = 0;
        for (ReviewTrade t : week) {
            if (t.rMultiple() == null) {
                continue;
            }
            if (t.rMultiple().compareTo(BIG_WIN) >= 0) {
                big++;
            } else if (t.rMultiple().signum() < 0 && t.rMultiple().compareTo(SMALL_LOSS_FLOOR) >= 0) {
                small++;
            } else if (t.rMultiple().compareTo(LIMIT) < 0) {
                worse++;
            }
        }

        List<ReviewTrade> mistakes = week.stream().filter(ReviewTrade::mistake).toList();
        List<ReviewTrade> clean = week.stream().filter(t -> !t.mistake()).toList();

        List<CurvePoint> curve = new ArrayList<>();
        LocalDate last = asOf.isAfter(end) ? end : asOf;
        for (LocalDate d = start; !d.isAfter(last); d = d.plusDays(1)) {
            LocalDate day = d;
            curve.add(new CurvePoint(d, week.stream().filter(t -> !t.exitDate().isAfter(day))
                .mapToLong(ReviewTrade::pnlHufMinor).sum()));
        }

        return new Week(start, end, week.size(), winRate, avgR(week), bySetup,
            new Distribution(big, small, worse, worse == 0), commonMistake(mistakes), curve,
            week.stream().mapToLong(ReviewTrade::pnlHufMinor).sum(),
            clean.size(), avgR(clean), mistakes.size(), avgR(mistakes),
            (int) week.stream().filter(t -> Boolean.FALSE.equals(t.stopRespected())).count(),
            (int) week.stream().filter(t -> t.win() && t.tags().contains(PracticeTag.KORAI_ZARAS)).count());
    }

    /** The mean R of the trades that have one, 2 decimals HALF_UP; null when none. */
    public static BigDecimal avgR(Collection<ReviewTrade> trades) {
        List<BigDecimal> rs = trades.stream().map(ReviewTrade::rMultiple).filter(r -> r != null).toList();
        if (rs.isEmpty()) {
            return null;
        }
        return rs.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(rs.size()), PaperTradeMath.R_SCALE, RoundingMode.HALF_UP);
    }

    private static Mistake commonMistake(List<ReviewTrade> mistakes) {
        Map<PracticeTag, Mistake> byTag = new EnumMap<>(PracticeTag.class);
        for (PracticeTag tag : PracticeTag.values()) {
            List<ReviewTrade> tagged = mistakes.stream().filter(t -> t.tags().contains(tag)).toList();
            if (!tagged.isEmpty()) {
                long pnl = tagged.stream().mapToLong(ReviewTrade::pnlHufMinor).sum();
                byTag.put(tag, new Mistake(tag, tagged.size(), Math.max(0, -pnl)));
            }
        }
        // most frequent, then the costlier, then the tag order
        return byTag.values().stream()
            .min(Comparator.comparingInt(Mistake::count).reversed()
                .thenComparing(Comparator.comparingLong(Mistake::costHufMinor).reversed())
                .thenComparing(m -> m.tag().ordinal()))
            .orElse(null);
    }
}
