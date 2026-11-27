package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentKind;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityPatternEntity;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.entity.ProposalStatus;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCheckinPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCheckinPort.DayFeel;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySleepPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort.Session;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort.SlotCounts;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityPatternRepository;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.service.CapacityDayService.DayRead;
import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.DayFact;
import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.Found;
import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.MoveFact;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.DemandItem;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The move log's evening-after and the learned patterns (Boop B7 K4, mezo-r36n9.17, spec §5.8).
 *
 * <ul>
 *   <li>{@link #fillOutcomes} — every proposal about a lived day of the last {@link #OUTCOME_WINDOW_DAYS} with no
 *       outcome yet gets one: what became of the session (done / short / skipped), the day's verdict as the load model
 *       now reads it, his evening rating and energy, the night after against the need, whether it went
 *       {@code good}, and the Hungarian word + line *Korábban áttettük* shows. A still-open proposal about a past day
 *       becomes {@code ignored}. The night after is not over at 03:30 when the day was yesterday: the outcome is then
 *       written with {@code sleepPending} and completed by the next night's pass.</li>
 *   <li>{@link #refreshPatterns} — {@link CapacityPatterns} over the last {@link #PATTERN_WINDOW_DAYS} lived days and
 *       every accepted move with a known outcome, upserted into {@code capacity_pattern}. A pattern no longer found is
 *       zeroed, never soft-deleted: the unique (created_by, key) index counts deleted rows too.</li>
 * </ul>
 *
 * Read only from ports and the capacity tables; history reads use stored or rule event scores, never the model.
 */
@Service
@RequiredArgsConstructor
public class CapacityLearningService {

    static final int OUTCOME_WINDOW_DAYS = 14;
    static final int PATTERN_WINDOW_DAYS = 56;
    static final int HISTORY_WEEKS = 8;
    static final int HISTORY_MAX = 12;
    static final LocalTime LATE_END = LocalTime.of(21, 0);
    /** Day-close rating 1–5: this or more is not a bad day. */
    static final int GOOD_DAY_RATING = 3;

    private static final Set<String> SESSION_KINDS = Set.of(AdjustmentKind.MOVE_SESSION_DAY.name(),
        AdjustmentKind.SHIFT_SESSION_TIME.name(), AdjustmentKind.SHORTEN_SESSION.name(),
        AdjustmentKind.LIGHTEN_SESSION.name(), AdjustmentKind.SWAP_SESSION_KIND.name(),
        AdjustmentKind.SKIP_SESSION.name());
    private static final Set<String> HISTORY_STATES = Set.of(ProposalStatus.ACCEPTED.wire(),
        ProposalStatus.DECLINED.wire(), ProposalStatus.UNDONE.wire());

    /** A decided proposal of an earlier week, as *Korábban áttettük* shows it. */
    public record HistoryItem(UUID proposalId, String kind, LocalDate day, String status, String title, String word,
                              String sub, Boolean good) {
    }

    private final CapacityProposalRepository proposals;
    private final CapacityPatternRepository patterns;
    private final CapacityDayService days;
    private final CapacityTrainPort train;
    private final CapacitySleepPort sleep;
    private final CapacityCheckinPort checkins;
    private final CapacityProperties props;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;

    // ── the nightly pass ──────────────────────────────────────────────────────

    /** His today in the owner zone. */
    public LocalDate today() {
        return LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(zone()));
    }

    /** Owners the nightly pass visits: anyone with a proposal or a scored event lately. */
    public List<UUID> owners(List<UUID> scoredOwners, LocalDate today) {
        Set<UUID> out = new java.util.LinkedHashSet<>(proposals.ownersSince(today.minusDays(PATTERN_WINDOW_DAYS)));
        out.addAll(scoredOwners);
        return List.copyOf(out);
    }

    /**
     * Fills the outcome of every proposal about a lived day of the window ({@code day < today}); open ones about a
     * past day become {@code ignored}. Idempotent: a filled outcome is only rewritten while its night is pending.
     *
     * @return the number of proposals written
     */
    @Transactional
    public int fillOutcomes(UUID owner, LocalDate today) {
        LocalDate from = today.minusDays(OUTCOME_WINDOW_DAYS);
        LocalDate yesterday = today.minusDays(1);
        List<CapacityProposalEntity> due = proposals.findByCreatedByAndDayBetweenAndDeletedFalse(owner, from, yesterday)
            .stream().filter(p -> p.getOutcome() == null || Boolean.TRUE.equals(p.getOutcome().get("sleepPending")))
            .toList();
        if (due.isEmpty()) {
            return 0;
        }
        LocalDate first = due.stream().map(CapacityProposalEntity::getDay).min(Comparator.naturalOrder()).orElse(from);
        Map<LocalDate, DayRead> read = new HashMap<>();
        days.history(owner, first, yesterday).forEach(r -> read.put(r.day().date(), r));
        Map<LocalDate, List<Session>> sessions = train.sessions(owner, first, yesterday);
        Map<LocalDate, DayFeel> feel = checkins.feel(owner, first, yesterday);
        Map<LocalDate, Integer> sleepMin = sleep.sleepMinutes(owner, first.plusDays(1), today);
        int need = need(owner);
        Instant now = clock.getIfAvailable(Clock::systemUTC).instant();

        int written = 0;
        for (CapacityProposalEntity p : due) {
            List<LocalDate> touched = ProposalService.touchedDays(p);
            LocalDate last = touched.stream().max(Comparator.naturalOrder()).filter(d -> d.isAfter(p.getDay()))
                .orElse(p.getDay());
            boolean changed = false;
            if (ProposalStatus.OPEN.wire().equals(p.getStatus())) {
                p.setStatus(ProposalStatus.IGNORED.wire());
                changed = true;
            }
            if (!last.isAfter(yesterday) && !ProposalStatus.EXPIRED.wire().equals(p.getStatus())) {
                p.setOutcome(outcome(p, touched, read.get(p.getDay()), sessions, feel.get(p.getDay()),
                    sleepMin.get(p.getDay().plusDays(1)), need, today));
                changed = true;
            }
            if (changed) {
                p.setUpdatedAt(now);
                proposals.save(p);
                written++;
            }
        }
        return written;
    }

    /** One proposal's outcome map (see the class comment). */
    static Map<String, Object> outcome(CapacityProposalEntity p, List<LocalDate> touched, DayRead day,
                                       Map<LocalDate, List<Session>> sessions, DayFeel feel, Integer sleepAfter,
                                       int need, LocalDate today) {
        String session = session(p, touched, sessions);
        String verdict = day == null ? null : day.day().verdict();
        Integer rating = feel == null ? null : feel.dayRating();
        Integer evening = feel == null ? null : feel.eveningEnergy();
        boolean good = !"túl sok".equals(verdict)
            && (rating == null || rating >= GOOD_DAY_RATING)
            && (sleepAfter == null || sleepAfter >= need - CapacityPatterns.SLEEP_SLACK_MIN)
            && (!"skipped".equals(session) || AdjustmentKind.SKIP_SESSION.name().equals(p.getKind()));
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("session", session);
        o.put("verdict", verdict);
        o.put("dayRating", rating);
        o.put("eveningEnergy", evening);
        o.put("sleepMin", sleepAfter);
        o.put("sleepNeedMin", need);
        o.put("sleepPending", sleepAfter == null && !p.getDay().plusDays(1).isBefore(today));
        o.put("good", good);
        o.put("word", word(p.getStatus(), good));
        o.put("sub", sub(session, verdict, rating, sleepAfter));
        return o;
    }

    /**
     * done / short / skipped for a proposal about a session, null otherwise: a done session on any touched day is
     * done (short when he accepted a shorter one); an accepted skip, or a planned session left undone, is skipped.
     */
    static String session(CapacityProposalEntity p, List<LocalDate> touched, Map<LocalDate, List<Session>> sessions) {
        if (!SESSION_KINDS.contains(p.getKind())) {
            return null;
        }
        boolean accepted = ProposalStatus.ACCEPTED.wire().equals(p.getStatus());
        List<LocalDate> on = new ArrayList<>(touched);
        if (!on.contains(p.getDay())) {
            on.add(p.getDay());
        }
        List<Session> list = on.stream().flatMap(d -> sessions.getOrDefault(d, List.of()).stream()).toList();
        if (list.stream().anyMatch(Session::done)) {
            return accepted && AdjustmentKind.SHORTEN_SESSION.name().equals(p.getKind()) ? "short" : "done";
        }
        if (accepted && AdjustmentKind.SKIP_SESSION.name().equals(p.getKind())) {
            return "skipped";
        }
        return list.isEmpty() ? null : "skipped";
    }

    static String word(String status, boolean good) {
        return switch (ProposalStatus.valueOf(status.toUpperCase())) {
            case ACCEPTED -> good ? "bevált" : "nem segített";
            case DECLINED -> "maradt így";
            case UNDONE -> "visszavontad";
            case IGNORED -> "nem döntöttél";
            case EXPIRED -> "lejárt";
            case OPEN -> "";
        };
    }

    /** „Az edzés megvolt · a nap rendben lett · 7 óra 10 perc alvás" — only the parts that are known. */
    static String sub(String session, String verdict, Integer rating, Integer sleepAfter) {
        List<String> parts = new ArrayList<>();
        if (session != null) {
            parts.add(switch (session) {
                case "done" -> "az edzés megvolt";
                case "short" -> "rövidebben edzettél";
                default -> "az edzés elmaradt";
            });
        }
        if (verdict != null) {
            parts.add("a nap " + verdict + " lett");
        }
        if (rating != null) {
            parts.add("este " + rating + "/5-re értékelted");
        }
        if (sleepAfter != null) {
            parts.add(HuDays.duration(sleepAfter) + " alvás");
        }
        return parts.isEmpty() ? null : HuDays.cap(String.join(" · ", parts));
    }

    /**
     * Recomputes every pattern from the last eight weeks of lived days and the accepted moves' outcomes; upserts
     * them, zeroing the ones no longer found.
     */
    @Transactional
    public List<Found> refreshPatterns(UUID owner, LocalDate today) {
        LocalDate from = today.minusDays(PATTERN_WINDOW_DAYS);
        LocalDate to = today.minusDays(1);
        List<DayFact> facts = dayFacts(owner, from, to, today);
        List<MoveFact> moves = proposals.findByCreatedByAndStatusAndDeletedFalse(owner, ProposalStatus.ACCEPTED.wire())
            .stream().filter(p -> p.getOutcome() != null && p.getOutcome().get("good") instanceof Boolean)
            .map(p -> new MoveFact(p.getKind(), (Boolean) p.getOutcome().get("good")))
            .toList();
        List<Found> found = CapacityPatterns.find(facts, moves);

        Map<String, CapacityPatternEntity> existing = new HashMap<>();
        patterns.findByCreatedByAndDeletedFalse(owner).forEach(e -> existing.put(e.getKey(), e));
        Instant now = clock.getIfAvailable(Clock::systemUTC).instant();
        Set<String> seen = new java.util.HashSet<>();
        for (Found f : found) {
            seen.add(f.key());
            CapacityPatternEntity e = existing.get(f.key());
            if (e == null) {
                if (f.evidence() == 0) {
                    continue; // nothing to remember yet
                }
                e = new CapacityPatternEntity();
                e.setCreatedBy(owner);
                e.setKey(f.key());
            }
            e.setEvidence(f.evidence());
            e.setConsistent(f.consistent());
            e.setPayload(new LinkedHashMap<>(f.payload()));
            if (f.evidence() > 0) {
                e.setLastSeen(to);
            }
            e.setUpdatedAt(now);
            patterns.save(e);
        }
        for (CapacityPatternEntity e : existing.values()) {
            if (!seen.contains(e.getKey()) && (e.getEvidence() != 0 || e.getConsistent() != 0)) {
                e.setEvidence(0);
                e.setConsistent(0);
                e.setUpdatedAt(now);
                patterns.save(e);
            }
        }
        return found;
    }

    /** The lived days of {@code from..to} as the patterns read them. */
    List<DayFact> dayFacts(UUID owner, LocalDate from, LocalDate to, LocalDate today) {
        if (to.isBefore(from)) {
            return List.of();
        }
        List<DayRead> read = days.history(owner, from, to);
        Map<LocalDate, List<Session>> sessions = train.sessions(owner, from, to);
        Map<LocalDate, DayFeel> feel = checkins.feel(owner, from, to);
        Map<LocalDate, Integer> sleepMin = sleep.sleepMinutes(owner, from.plusDays(1), today);
        int need = need(owner);
        ZoneId zone = zone();
        List<DayFact> out = new ArrayList<>();
        for (DayRead r : read) {
            LocalDate d = r.day().date();
            List<DemandItem> items = r.day().demand().items();
            List<Session> s = sessions.getOrDefault(d, List.of());
            DayFeel f = feel.get(d);
            out.add(new DayFact(d, r.day().verdict(), meetingMinutes(items), backToBack(items), lateEvent(items, d, zone),
                !s.isEmpty(), s.stream().anyMatch(Session::done), sleepMin.get(d.plusDays(1)), need,
                f == null ? null : f.eveningEnergy()));
        }
        return out;
    }

    static int meetingMinutes(List<DemandItem> items) {
        return (int) items.stream().filter(CapacityLearningService::meeting)
            .mapToLong(i -> Duration.between(i.start(), i.end()).toMinutes()).sum();
    }

    /** A run of meetings with gaps under the gap credit that lasts the sequence block or longer. */
    boolean backToBack(List<DemandItem> items) {
        List<DemandItem> m = items.stream().filter(CapacityLearningService::meeting)
            .sorted(Comparator.comparing(DemandItem::start)).toList();
        Instant runStart = null;
        Instant runEnd = null;
        for (DemandItem i : m) {
            if (runEnd != null && Duration.between(runEnd, i.start()).toMinutes() < props.gapCreditMin()) {
                runEnd = i.end().isAfter(runEnd) ? i.end() : runEnd;
            } else {
                runStart = i.start();
                runEnd = i.end();
            }
            if (Duration.between(runStart, runEnd).toMinutes() >= props.sequenceBlockMin()) {
                return true;
            }
        }
        return false;
    }

    /** A timed, non-training item (shorter than half a day) ending at 21:00 or later, or past midnight. */
    static boolean lateEvent(List<DemandItem> items, LocalDate day, ZoneId zone) {
        for (DemandItem i : items) {
            if ("training".equals(i.kind()) || i.start() == null || i.end() == null
                || Duration.between(i.start(), i.end()).toHours() >= 12) {
                continue;
            }
            ZonedDateTime end = i.end().atZone(zone);
            if (end.toLocalDate().isAfter(day) || !end.toLocalTime().isBefore(LATE_END)) {
                return true;
            }
        }
        return false;
    }

    private static boolean meeting(DemandItem i) {
        return ("meeting".equals(i.kind()) || "call".equals(i.kind())) && i.start() != null && i.end() != null;
    }

    private int need(UUID owner) {
        SlotCounts slots = train.weeklySlots(owner);
        return sleep.needMinutes(owner, slots.gym(), slots.sport());
    }

    private ZoneId zone() {
        return ZoneId.of(wearable.zone());
    }

    // ── reads ─────────────────────────────────────────────────────────────────

    /** The shown patterns, strongest first, as {@link CapacityPatterns.Found}s rebuilt from the stored rows. */
    public List<Found> shownPatterns(UUID owner) {
        return CapacityPatterns.shown(patterns.findByCreatedByAndDeletedFalse(owner).stream()
            .map(e -> {
                Map<String, Object> payload = e.getPayload() == null ? Map.of() : e.getPayload();
                return new Found(e.getKey(), e.getEvidence(), e.getConsistent(),
                    !Boolean.FALSE.equals(payload.get("contrast")), payload);
            })
            .toList());
    }

    /** The shown patterns as the generator's ranking input. */
    public List<ProposalGenerator.Pattern> generatorPatterns(UUID owner) {
        return shownPatterns(owner).stream()
            .map(f -> new ProposalGenerator.Pattern(f.key(), f.evidence(), f.consistent(), f.payload()))
            .toList();
    }

    /**
     * *Korábban áttettük* beyond this week: the accepted, declined and taken-back proposals of the
     * {@link #HISTORY_WEEKS} weeks before {@code monday}, newest first, at most {@link #HISTORY_MAX}.
     */
    public List<HistoryItem> history(UUID owner, LocalDate monday) {
        return proposals.findByCreatedByAndWeekStartBetweenAndDeletedFalse(owner, monday.minusWeeks(HISTORY_WEEKS),
                monday.minusWeeks(1)).stream()
            .filter(p -> HISTORY_STATES.contains(p.getStatus()) && p.getDay() != null)
            .sorted(Comparator.comparing(CapacityProposalEntity::getDay).reversed())
            .limit(HISTORY_MAX)
            .map(CapacityLearningService::historyItem)
            .toList();
    }

    static HistoryItem historyItem(CapacityProposalEntity p) {
        Map<String, Object> o = p.getOutcome();
        String word = o != null && o.get("word") instanceof String w && !w.isBlank() ? w : pendingWord(p.getStatus());
        String sub = o != null && o.get("sub") instanceof String s ? s : null;
        Boolean good = o != null && ProposalStatus.ACCEPTED.wire().equals(p.getStatus())
            && o.get("good") instanceof Boolean g ? g : null;
        return new HistoryItem(p.getId(), p.getKind(), p.getDay(), p.getStatus(), p.getTitle(), word, sub, good);
    }

    /** The word before the outcome is known. */
    private static String pendingWord(String status) {
        return switch (ProposalStatus.valueOf(status.toUpperCase())) {
            case ACCEPTED -> "még nem tudom";
            case DECLINED -> "maradt így";
            case UNDONE -> "visszavontad";
            default -> "";
        };
    }
}
