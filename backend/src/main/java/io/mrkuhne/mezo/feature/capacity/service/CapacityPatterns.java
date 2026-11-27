package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/**
 * The learned patterns of his weeks (Boop B7 K4, mezo-r36n9.17, spec §5.8): pure and deterministic over eight weeks of
 * lived days and the outcomes of the moves he accepted. The model never creates a pattern — every count, title and
 * body here is a rule's.
 *
 * <p>A pattern carries its {@code evidence} (how many times the situation occurred) and {@code consistent} (how many of
 * those went the pattern's way). It is <b>shown</b> only with {@code evidence >= 3}, {@code consistent >= 2} and at
 * least half of the evidence consistent ({@link #visible(int, int)}); a day pattern must also stand out against the
 * other days ({@code contrast}: its rate at least {@link #CONTRAST} above the rate of the days without the situation)
 * — otherwise "Thursday is your weak spot" would be said of a man whose every day is tight, or "a long meeting day
 * skips the session" of one who simply rarely logs his sessions.
 *
 * <ul>
 *   <li>{@code weekday-overload:<DOW>} — that weekday read szoros / túl sok;</li>
 *   <li>{@code meetings-over:4-skips-session} — a day with at least four hours of meetings and a planned session: the
 *       session was not done;</li>
 *   <li>{@code late-call-sleep-loss} — an event ending at 21:00 or later: the night after fell short of the need by more
 *       than half an hour;</li>
 *   <li>{@code back-to-back-evening-energy} — a block of back-to-back meetings: the evening energy was low (≤ 4 of 10);
 *   </li>
 *   <li>{@code move-kind-works:<KIND>} — an accepted proposal of that kind: its outcome was good (no contrast).</li>
 * </ul>
 */
public final class CapacityPatterns {

    static final int MIN_EVIDENCE = 3;
    static final int MIN_CONSISTENT = 2;
    static final double CONTRAST = 0.25;
    static final int MEETING_HOURS = 4;
    static final int SLEEP_SLACK_MIN = 30;
    static final int LOW_EVENING_ENERGY = 4;

    public static final String WEEKDAY_OVERLOAD = "weekday-overload:";
    public static final String MEETINGS_SKIP = "meetings-over:" + MEETING_HOURS + "-skips-session";
    public static final String LATE_SLEEP = "late-call-sleep-loss";
    public static final String BACK_TO_BACK = "back-to-back-evening-energy";
    public static final String MOVE_WORKS = "move-kind-works:";

    private CapacityPatterns() {
    }

    /**
     * One lived day as the patterns read it. {@code verdict} null = unknown; {@code sleepAfterMin} is the night after
     * the day (wake date = the next day); {@code eveningEnergy} 1–10 from his evening close.
     */
    public record DayFact(LocalDate date, String verdict, int meetingMin, boolean backToBack, boolean lateEvent,
                          boolean sessionPlanned, boolean sessionDone, Integer sleepAfterMin, Integer needMin,
                          Integer eveningEnergy) {
    }

    /** An accepted proposal whose outcome is known. */
    public record MoveFact(String kind, boolean good) {
    }

    /**
     * A pattern with its counts; {@code contrast} false = it does not stand out against the other days (never shown).
     * {@code payload} carries {@code title}, {@code body}, {@code line} (= title) and {@code weekday} / {@code kind}
     * when it is about one.
     */
    public record Found(String key, int evidence, int consistent, boolean contrast, Map<String, Object> payload) {
        public boolean shown() {
            return contrast && visible(evidence, consistent);
        }

        public String title() {
            return String.valueOf(payload.get("title"));
        }

        public String body() {
            return String.valueOf(payload.get("body"));
        }
    }

    /** The show rule: at least three occurrences, two of them consistent, and at least half of them consistent. */
    public static boolean visible(int evidence, int consistent) {
        return evidence >= MIN_EVIDENCE && consistent >= MIN_CONSISTENT && 2 * consistent >= evidence;
    }

    /** Every pattern the facts support, shown or not (the job stores all, so a fading one is zeroed, not deleted). */
    public static List<Found> find(List<DayFact> days, List<MoveFact> moves) {
        List<Found> out = new ArrayList<>();
        for (DayOfWeek dow : DayOfWeek.values()) {
            LocalDate sample = LocalDate.of(2026, 11, 23).with(TemporalAdjusters.nextOrSame(dow));
            Found f = dayPattern(WEEKDAY_OVERLOAD + dow.name(), days, d -> d.verdict() != null,
                d -> d.date().getDayOfWeek() == dow, CapacityPatterns::tight);
            Map<String, Object> p = payload("A " + HuDays.name(sample) + " a gyenge pontod.",
                "Az elmúlt hetekben " + HuDays.on(sample) + " " + f.evidence() + " napból " + f.consistent()
                    + " lett szoros vagy túl sok.");
            p.put("weekday", dow.name());
            out.add(with(f, p));
        }
        Found meetings = dayPattern(MEETINGS_SKIP, days, DayFact::sessionPlanned,
            d -> d.meetingMin() >= MEETING_HOURS * 60, d -> !d.sessionDone());
        out.add(with(meetings, payload("Ha " + MEETING_HOURS + " óránál több a megbeszélés, elmarad az edzés.",
            meetings.evidence() + " ilyen napból " + meetings.consistent() + " alkalommal maradt ki az edzés.")));

        Found late = dayPattern(LATE_SLEEP, days, d -> d.sleepAfterMin() != null && d.needMin() != null,
            DayFact::lateEvent, d -> d.sleepAfterMin() < d.needMin() - SLEEP_SLACK_MIN);
        out.add(with(late, payload("Késő esti program után kevesebbet alszol.",
            late.evidence() + " késő estig tartó napból " + late.consistent()
                + " után lett kevesebb az alvás, mint amennyi kell.")));

        Found b2b = dayPattern(BACK_TO_BACK, days, d -> d.eveningEnergy() != null,
            DayFact::backToBack, d -> d.eveningEnergy() <= LOW_EVENING_ENERGY);
        out.add(with(b2b, payload("Egymást érő megbeszélések után estére elfogysz.",
            b2b.evidence() + " ilyen napból " + b2b.consistent() + " estéjén volt alacsony az energiád.")));

        for (AdjustmentKind kind : AdjustmentKind.values()) {
            List<MoveFact> of = moves.stream().filter(m -> kind.name().equals(m.kind())).toList();
            if (of.isEmpty()) {
                continue;
            }
            int good = (int) of.stream().filter(MoveFact::good).count();
            Map<String, Object> p = payload(moveTitle(kind),
                of.size() + " elfogadott ilyen javaslatból " + good + " után lett jó napod.");
            p.put("kind", kind.name());
            out.add(new Found(MOVE_WORKS + kind.name(), of.size(), good, true, p));
        }
        return List.copyOf(out);
    }

    /** Only the shown ones, strongest first (consistency, then evidence). */
    public static List<Found> shown(List<Found> all) {
        return all.stream().filter(Found::shown)
            .sorted(Comparator.comparingDouble((Found f) -> (double) f.consistent() / f.evidence()).reversed()
                .thenComparing(Comparator.comparingInt(Found::evidence).reversed()))
            .toList();
    }

    /**
     * Among the days {@code eligible} accepts: evidence = those in the situation, consistent = those of them that went
     * the pattern's way; contrast = their rate exceeds the rate of the eligible days NOT in the situation by
     * {@link #CONTRAST} (no such day = no contrast to beat, the rate itself counts).
     */
    private static Found dayPattern(String key, List<DayFact> days, Predicate<DayFact> eligible,
                                    Predicate<DayFact> situation, Predicate<DayFact> outcome) {
        int evidence = 0;
        int consistent = 0;
        int others = 0;
        int othersHit = 0;
        for (DayFact d : days) {
            if (!eligible.test(d)) {
                continue;
            }
            if (situation.test(d)) {
                evidence++;
                if (outcome.test(d)) {
                    consistent++;
                }
            } else {
                others++;
                if (outcome.test(d)) {
                    othersHit++;
                }
            }
        }
        boolean contrast = evidence > 0
            && (others == 0 || (double) consistent / evidence - (double) othersHit / others >= CONTRAST);
        return new Found(key, evidence, consistent, contrast, Map.of());
    }

    private static Found with(Found f, Map<String, Object> payload) {
        payload.put("contrast", f.contrast());
        return new Found(f.key(), f.evidence(), f.consistent(), f.contrast(), payload);
    }

    private static Map<String, Object> payload(String title, String body) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("title", title);
        p.put("line", title);
        p.put("body", body);
        return p;
    }

    private static boolean tight(DayFact d) {
        return "szoros".equals(d.verdict()) || "túl sok".equals(d.verdict());
    }

    private static String moveTitle(AdjustmentKind kind) {
        return switch (kind) {
            case MOVE_SESSION_DAY -> "Az edzés áttétele másik napra beválik nálad.";
            case SHIFT_SESSION_TIME -> "Az edzés későbbre tétele beválik nálad.";
            case SHORTEN_SESSION -> "A rövidebb edzés a sűrű napokon beválik nálad.";
            case LIGHTEN_SESSION -> "A könnyebb edzés a sűrű napokon beválik nálad.";
            case SWAP_SESSION_KIND -> "Az edzés cseréje a sűrű napokon beválik nálad.";
            case SKIP_SESSION -> "A pihenőnap a túl sűrű napokon beválik nálad.";
            case SHIFT_BEDTIME -> "A később fekvés a késő esti napokon beválik nálad.";
            case MOVE_MEAL_ENERGY -> "A nagyobb ebéd a sűrű napokon beválik nálad.";
            case CALENDAR_TODO -> "Egy esemény átrakása a sűrű napokon beválik nálad.";
        };
    }
}
