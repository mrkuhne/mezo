package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.feature.boop.config.BoopProperties;
import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import io.mrkuhne.mezo.feature.boop.mapper.BoopBriefMapper;
import io.mrkuhne.mezo.feature.boop.repository.BoopBriefRepository;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdicts;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * The Boop morning brief of one owner-local day (Boop S3, mezo-r36n9.7), cached per day in
 * {@code boop_brief}.
 *
 * <p>{@link #get}: assemble the day → input hash → the stored row has the same hash: its payload
 * comes back as is (no scoring, no LLM call); otherwise scores + energy curve + verdicts are
 * computed and the row is upserted. The hash covers what should change the words or what the
 * brief shows: last night (id and its content, so an edited night counts), the calendar (count and
 * every event), the meals (count and logged count), the weight, the session (title and time), the
 * recovery state, the pending observations (sorted ids — a decided one leaves the list), the
 * check-ins (slot and done flag — one done on the web counts), the intention (creed and foci) and a
 * coarse time-of-day bucket of the owner zone (reggel &lt; 12:00, délután 12–18, este ≥ 18; a past
 * day is always este), so time-dependent sentences ("a nap nagy része még előtted") refresh at most
 * three times a day. Steps, HR and the exact clock are deliberately NOT in it — they move all day
 * and would re-call the LLM on every open.
 *
 * <p>{@link #regenerate}: a user-asked rebuild, always generated, at most
 * {@code mezo.boop.regen-per-day} times per day's row, then 409 {@code BOOP_REGENERATE_LIMIT_REACHED}
 * (refused before the LLM call).
 *
 * <p>"Now" is the server clock in the owner zone ({@code mezo.wearable.zone}); a past date is judged
 * as of 23:59 of that day; a date after today in that zone is a 400 (the phone asks for today or the
 * past only). No {@code @Transactional} here: generation (the LLM call) runs outside any
 * transaction, only {@link BoopBriefStore#upsert} is one. Two racing first requests of one day both
 * generate; the INSERT that loses on the unique index re-reads the row and answers with the
 * winner's brief (never a 500). Everything is keyed by the owner id.
 */
@Service
public class BoopBriefService {

    private static final LocalTime END_OF_DAY = LocalTime.of(23, 59);
    private static final LocalTime LUNCH_FROM = LocalTime.of(11, 0);
    private static final LocalTime LUNCH_TO = LocalTime.of(15, 0);
    private static final LocalTime NOON = LocalTime.NOON;
    private static final LocalTime EVENING = LocalTime.of(18, 0);

    private final BoopDayAssembler assembler;
    private final BoopVerdictWriter verdictWriter;
    private final BoopBriefMapper mapper;
    private final BoopBriefRepository briefs;
    private final BoopBriefStore store;
    private final ObjectMapper objectMapper;
    private final BoopProperties props;
    private final BoopScores scores;
    private final ZoneId zone;

    public BoopBriefService(BoopDayAssembler assembler, BoopVerdictWriter verdictWriter, BoopBriefMapper mapper,
                            BoopBriefRepository briefs, BoopBriefStore store, ObjectMapper objectMapper,
                            BoopProperties props, WearableProperties wearableProperties) {
        this.assembler = assembler;
        this.verdictWriter = verdictWriter;
        this.mapper = mapper;
        this.briefs = briefs;
        this.store = store;
        this.objectMapper = objectMapper;
        this.props = props;
        this.scores = new BoopScores(props);
        this.zone = ZoneId.of(wearableProperties.zone());
    }

    public BoopBrief get(UUID owner, LocalDate date) {
        return get(owner, date, Instant.now());
    }

    /** Clock-explicit variant — the tested one. */
    public BoopBrief get(UUID owner, LocalDate date, Instant now) {
        requireNotFuture(date, now);
        BoopDay day = assembler.assemble(owner, date);
        String hash = inputHash(day, localNow(date, now));
        Optional<BoopBriefEntity> existing = briefs.findByCreatedByAndDate(owner, date);
        if (existing.isPresent() && hash.equals(existing.get().getInputHash())) {
            return read(existing.get());
        }
        return generateAndStore(owner, day, hash, now, false);
    }

    public BoopBrief regenerate(UUID owner, LocalDate date) {
        return regenerate(owner, date, Instant.now());
    }

    /** Clock-explicit variant — the tested one. */
    public BoopBrief regenerate(UUID owner, LocalDate date, Instant now) {
        requireNotFuture(date, now);
        Optional<BoopBriefEntity> existing = briefs.findByCreatedByAndDate(owner, date);
        if (existing.isPresent() && existing.get().getRegenCount() >= props.regenPerDay()) {
            throw BoopBriefStore.limitReached();
        }
        BoopDay day = assembler.assemble(owner, date);
        return generateAndStore(owner, day, inputHash(day, localNow(date, now)), now, true);
    }

    private BoopBrief generateAndStore(UUID owner, BoopDay day, String hash, Instant now, boolean manual) {
        LocalTime localNow = localNow(day.date(), now);
        Scores s = scores.compute(day, localNow);
        LocalTime sessionTime = day.session() == null ? null : day.session().time();
        double[] hourly = EnergyCurveModel.hourly(s.forma(), sessionTime, lunch(day));
        Verdicts v = verdictWriter.write(day, s, localNow);
        Instant generatedAt = now.truncatedTo(ChronoUnit.MICROS);
        BoopBrief brief = mapper.toBrief(day, s, v, hourly, props.stepsGoal(), props.nightsNeeded(), generatedAt);
        String payload = objectMapper.writeValueAsString(brief);
        try {
            store.upsert(owner, day.date(), hash, payload, generatedAt, manual, props.regenPerDay());
        } catch (DataIntegrityViolationException raced) {
            // Only "a parallel first request won" (uq_boop_brief_user_date) if the row now really
            // exists; any other integrity failure is rethrown, never swallowed.
            Optional<BoopBriefEntity> winner = briefs.findByCreatedByAndDate(owner, day.date());
            if (winner.isEmpty()) {
                throw raced;
            }
            if (!manual) {
                return read(winner.get());
            }
            // A manual regeneration still has to be counted (and capped) on the winner's row.
            store.upsert(owner, day.date(), hash, payload, generatedAt, true, props.regenPerDay());
        }
        return brief;
    }

    /** A pattern-valid but impossible date, or one after today: the same 400 field error the
     *  generated validation gives a malformed one. */
    public static SystemRuntimeErrorException invalidDate() {
        return new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "date").build(),
            HttpStatus.BAD_REQUEST);
    }

    void requireNotFuture(LocalDate date, Instant now) {
        if (date.isAfter(now.atZone(zone).toLocalDate())) {
            throw invalidDate();
        }
    }

    private BoopBrief read(BoopBriefEntity row) {
        return objectMapper.readValue(row.getPayload(), BoopBrief.class);
    }

    private LocalTime localNow(LocalDate date, Instant now) {
        ZonedDateTime local = now.atZone(zone);
        if (date.isBefore(local.toLocalDate())) {
            return END_OF_DAY;
        }
        return local.toLocalTime().truncatedTo(ChronoUnit.MINUTES);
    }

    /** The first logged meal between 11:00 and 15:00, else null. */
    static LocalTime lunch(BoopDay day) {
        return day.meals().stream()
            .filter(BoopDay.Meal::logged)
            .map(BoopDay.Meal::time)
            .filter(t -> t != null && !t.isBefore(LUNCH_FROM) && !t.isAfter(LUNCH_TO))
            .sorted()
            .findFirst()
            .orElse(null);
    }

    /** reggel / délután / este — the coarse part of the clock the brief's sentences depend on. */
    static String timeBucket(LocalTime localNow) {
        if (localNow.isBefore(NOON)) {
            return "reggel";
        }
        return localNow.isBefore(EVENING) ? "delutan" : "este";
    }

    static String inputHash(BoopDay d, LocalTime localNow) {
        StringBuilder b = new StringBuilder("v2|").append(d.date()).append("|t:").append(timeBucket(localNow));
        BoopDay.Sleep s = d.sleep();
        b.append("|night:");
        if (s != null) {
            b.append(s.id()).append(',').append(s.bedtime()).append(',').append(s.wakeup()).append(',')
                .append(s.totalMin()).append(',').append(s.deepMin()).append(',').append(s.remMin()).append(',')
                .append(s.lightMin()).append(',').append(s.awakeMin()).append(',').append(s.quality()).append(',')
                .append(s.hypnogram() == null ? 0 : s.hypnogram().size());
        }
        b.append("|cal:").append(d.calendar().count());
        for (BoopDay.CalendarItem e : d.calendar().events()) {
            b.append(';').append(e.title()).append(',').append(e.start()).append(',').append(e.end())
                .append(',').append(e.allDay());
        }
        b.append("|meals:").append(d.meals().size()).append(',')
            .append(d.meals().stream().filter(BoopDay.Meal::logged).count());
        b.append("|weight:");
        if (d.weight() != null) {
            b.append(d.weight().kg()).append(',').append(d.weight().trendKg());
        }
        b.append("|session:");
        if (d.session() != null) {
            b.append(d.session().title()).append(',').append(d.session().time());
        }
        b.append("|recovery:");
        if (d.recovery() != null) {
            b.append(d.recovery().reason()).append(',').append(d.recovery().day());
        }
        b.append("|obs:");
        d.observations().stream().map(BoopDay.Observation::id).sorted()
            .forEach(id -> b.append(id).append(';'));
        b.append("|checkins:");
        for (BoopDay.Checkin c : d.checkins()) {
            b.append(c.slot()).append(',').append(c.done()).append(';');
        }
        b.append("|intention:");
        if (d.intention() != null) {
            b.append(d.intention().creed()).append(',').append(d.intention().foci());
        }
        return sha256(b.toString());
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory on every JVM (java.security.MessageDigest spec).
            throw new AssertionError(e);
        }
    }
}
