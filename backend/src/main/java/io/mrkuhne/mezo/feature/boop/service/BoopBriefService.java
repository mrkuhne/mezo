package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.feature.boop.config.BoopProperties;
import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import io.mrkuhne.mezo.feature.boop.mapper.BoopBriefMapper;
import io.mrkuhne.mezo.feature.boop.repository.BoopBriefRepository;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdicts;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
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
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * The Boop morning brief of one owner-local day (Boop S3, mezo-r36n9.7), cached per day in
 * {@code boop_brief}.
 *
 * <p>{@link #get}: assemble the day → input hash → the stored row has the same hash: its payload
 * comes back as is (no scoring, no LLM call); otherwise scores + energy curve + verdicts are
 * computed and the row is upserted. The hash covers what should change the words: last night (id
 * and its content, so an edited night counts), the calendar (count and every event), the meals
 * (count and logged count), the weight, the session (title and time) and the recovery state. Steps,
 * HR and the clock are deliberately NOT in it — they move all day and would re-call the LLM on
 * every open.
 *
 * <p>{@link #regenerate}: a user-asked rebuild, always generated, at most
 * {@code mezo.boop.regen-per-day} times per day's row, then 409 {@code BOOP_REGENERATE_LIMIT_REACHED}
 * (refused before the LLM call).
 *
 * <p>"Now" is the server clock in the owner zone ({@code mezo.wearable.zone}); a past date is judged
 * as of 23:59 of that day, a future one as of 00:00. No {@code @Transactional} here: generation
 * (the LLM call) runs outside any transaction, only {@link BoopBriefStore#upsert} is one.
 * Everything is keyed by the owner id.
 */
@Service
public class BoopBriefService {

    private static final LocalTime END_OF_DAY = LocalTime.of(23, 59);
    private static final LocalTime LUNCH_FROM = LocalTime.of(11, 0);
    private static final LocalTime LUNCH_TO = LocalTime.of(15, 0);

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
        BoopDay day = assembler.assemble(owner, date);
        String hash = inputHash(day);
        Optional<BoopBriefEntity> existing = briefs.findByCreatedByAndDate(owner, date);
        if (existing.isPresent() && hash.equals(existing.get().getInputHash())) {
            return objectMapper.readValue(existing.get().getPayload(), BoopBrief.class);
        }
        return generateAndStore(owner, day, hash, now, false);
    }

    public BoopBrief regenerate(UUID owner, LocalDate date) {
        return regenerate(owner, date, Instant.now());
    }

    /** Clock-explicit variant — the tested one. */
    public BoopBrief regenerate(UUID owner, LocalDate date, Instant now) {
        Optional<BoopBriefEntity> existing = briefs.findByCreatedByAndDate(owner, date);
        if (existing.isPresent() && existing.get().getRegenCount() >= props.regenPerDay()) {
            throw BoopBriefStore.limitReached();
        }
        BoopDay day = assembler.assemble(owner, date);
        return generateAndStore(owner, day, inputHash(day), now, true);
    }

    private BoopBrief generateAndStore(UUID owner, BoopDay day, String hash, Instant now, boolean manual) {
        LocalTime localNow = localNow(day.date(), now);
        Scores s = scores.compute(day, localNow);
        LocalTime sessionTime = day.session() == null ? null : day.session().time();
        double[] hourly = EnergyCurveModel.hourly(s.forma(), sessionTime, lunch(day));
        Verdicts v = verdictWriter.write(day, s, localNow);
        Instant generatedAt = now.truncatedTo(ChronoUnit.MICROS);
        BoopBrief brief = mapper.toBrief(day, s, v, hourly, props.stepsGoal(), props.nightsNeeded(), generatedAt);
        store.upsert(owner, day.date(), hash, objectMapper.writeValueAsString(brief), generatedAt, manual,
            props.regenPerDay());
        return brief;
    }

    private LocalTime localNow(LocalDate date, Instant now) {
        ZonedDateTime local = now.atZone(zone);
        if (date.isBefore(local.toLocalDate())) {
            return END_OF_DAY;
        }
        if (date.isAfter(local.toLocalDate())) {
            return LocalTime.MIDNIGHT;
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

    static String inputHash(BoopDay d) {
        StringBuilder b = new StringBuilder("v1|").append(d.date());
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
