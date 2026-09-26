package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.EffectLinkRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionContextSignal;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.MentionSignal;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Emlékezet S4 (bd mezo-d6ivw.4): the named-effect engine — "on the days <subject> happened, how
 * did your mental state / energy / stress compare to the other days?" for every person the user
 * mentions and for a small, code-enumerated event taxonomy. Code picks the findings
 * ({@link EffectLinkCalculator}: Cliff's delta, strength band and confidence tier decided
 * independently); the model only ever phrases them.
 *
 * <p><b>The table is a cache of the current window, never history.</b> Every nightly
 * {@link #recompute} re-derives each (subject, metric) pair over {@code [today-60, today-1]}: a
 * pair that still clears the gate is upserted in place (same row id), one that no longer does is
 * soft-deleted. That full recompute IS the drift handling — nothing ages rows out separately.
 *
 * <p><b>One transaction per SUBJECT, never one per run</b> (the {@code KnowledgeRecheckService}
 * idiom, slice lesson 11): a subject's three metric rows commit together in their own
 * {@code REQUIRES_NEW} {@link TransactionTemplate}, so one subject's DB failure cannot mark a
 * shared transaction rollback-only and silently discard every other subject's good work. The
 * service itself is NOT class-level {@code @Transactional}.
 *
 * <p><b>Stress stays value-space.</b> A positive delta on {@code stress} means MORE stress on the
 * subject's days; the "that is bad" reading is presentation (the FE flips the copy), never a
 * storage-side polarity flip.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class EffectLinkService {

    public static final int WINDOW_DAYS = 60;
    static final int PROMPT_CAP = 6;
    static final String OBSERVATION_TOPIC_KEY_PREFIX = "observation-topic-key:";

    static final String PROMPT_HEADER = "NEVESÍTETT EGYÜTTJÁRÁSOK (kód számolta, nem ok-okozat — ha "
            + "javaslatot építesz rá, a megadott téma-kulcsot használd topicKey-ként):";

    /** The fixed event taxonomy — insertion order is the recompute order. */
    static final String EVENT_EDZES = "edzes";
    static final String EVENT_MUNKA = "munka";
    static final String EVENT_CSALAD = "csalad";
    static final String EVENT_KOZOS_PROGRAM = "kozos_program";
    static final String EVENT_KONFLIKTUS = "konfliktus";
    static final String EVENT_PIHENES = "pihenes";

    private static final Map<String, String> EVENT_LABELS_HU = eventLabels();

    /** metric → its series source. Order = the per-subject write order. */
    private static final Map<String, MetricKey> METRICS = metrics();

    private static final Map<String, String> METRIC_LABELS_HU = Map.of(
            EffectLinkEntity.METRIC_MENTAL, "mentális állapot",
            EffectLinkEntity.METRIC_ENERGY, "energiaszint",
            EffectLinkEntity.METRIC_STRESS, "stresszszint");

    private static final Set<String> PROMPT_STRENGTHS = Set.of("kozepes", "eros");
    private static final Set<String> PROMPT_CONFIDENCES = Set.of("kozepes", "eros");
    private static final List<String> TIER_LADDER = List.of("gyenge", "kozepes", "eros");

    private static final int NAME_MAX_CHARS = 120;

    private final EffectLinkRepository effectLinkRepository;
    private final MetricSeriesService metricSeriesService;
    private final TextSignalSeriesService textSignalSeriesService;
    private final MentionRepository mentionRepository;
    private final PersonRepository personRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final PatternRepository patternRepository;
    private final PlatformTransactionManager transactionManager;

    /** One (kind, key) subject and the days it happened on inside the window. */
    record Subject(String kind, String key, Set<LocalDate> days) {}

    /**
     * The nightly full recompute of ONE user's effect rows over {@code [today-60, today-1]}.
     * Deliberately NOT {@code @Transactional} — see the class javadoc.
     * @return how many rows exist after the pass (kept or freshly upserted).
     */
    public int recompute(UUID userId, LocalDate today) {
        LocalDate from = today.minusDays(WINDOW_DAYS);
        LocalDate to = today.minusDays(1);
        Map<String, Map<LocalDate, Double>> series = new LinkedHashMap<>();
        METRICS.forEach((metric, key) ->
                series.put(metric, metricSeriesService.series(userId, key, from, to)));

        List<Subject> subjects = subjects(userId, from, to);
        int kept = 0;
        for (Subject subject : subjects) {
            try {
                kept += recomputeOne(userId, subject, series);
            } catch (Exception e) {
                log.warn("Effect recompute failed for {} {} of user {} — the pass continues",
                        subject.kind(), subject.key(), userId, e);
            }
        }
        return kept;
    }

    /**
     * The double-gated prompt block: rows whose strength AND confidence are both at least
     * {@code kozepes}, strongest first, at most {@value #PROMPT_CAP}. "" when nothing qualifies.
     * A person row whose person is unknown, deleted or not active is skipped — never a made-up name.
     */
    @Transactional(readOnly = true)
    public String promptBlock(UUID userId) {
        List<EffectLinkEntity> gated = effectLinkRepository.findByCreatedByAndDeletedFalse(userId).stream()
                .filter(r -> PROMPT_STRENGTHS.contains(r.getStrengthBand()))
                .filter(r -> PROMPT_CONFIDENCES.contains(r.getConfidenceTier()))
                .sorted(byStrength())
                .toList();
        if (gated.isEmpty()) {
            return "";
        }
        Map<String, String> names = activePersonNames(userId);
        List<String> lines = gated.stream()
                .map(r -> line(r, names))
                .flatMap(Optional::stream)
                .limit(PROMPT_CAP)
                .toList();
        return lines.isEmpty() ? "" : PROMPT_HEADER + "\n" + String.join("\n", lines);
    }

    /**
     * One person's live effect rows, strongest first, with the serve-time confidence bump: a row
     * whose topic key a CONFIRMED observation carries as {@code observation-topic-key:<key>} is
     * lifted one tier (cap {@code eros}). The bump lives on a detached copy only — never stored.
     */
    @Transactional(readOnly = true)
    public List<EffectLinkEntity> effectsForPerson(UUID userId, UUID personId) {
        List<EffectLinkEntity> rows = effectLinkRepository
                .findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
                        userId, EffectLinkEntity.SUBJECT_PERSON, personId.toString());
        if (rows.isEmpty()) {
            return List.of();
        }
        Set<String> confirmedKeys = confirmedTopicKeys(userId);
        return rows.stream()
                .sorted(byStrength())
                .map(r -> confirmedKeys.contains(topicKey(r.getSubjectKind(), r.getSubjectKey(), r.getMetric()))
                        ? bumped(r) : r)
                .toList();
    }

    /** {@code effect-person-<first 8 hex of the uuid>-<metric>} / {@code effect-event-<key>-<metric>}. */
    public static String topicKey(String subjectKind, String subjectKey, String metric) {
        if (EffectLinkEntity.SUBJECT_PERSON.equals(subjectKind)) {
            String hex = subjectKey.replace("-", "").toLowerCase(Locale.ROOT);
            return "effect-person-" + hex.substring(0, Math.min(8, hex.length())) + "-" + metric;
        }
        return "effect-event-" + subjectKey + "-" + metric;
    }

    // ---------------------------------------------------------------- recompute internals

    /** Mentioned persons, the event taxonomy, and every subject that still has a live row (so a
     *  subject that fell silent in the window still gets its stale rows deleted). */
    private List<Subject> subjects(UUID userId, LocalDate from, LocalDate to) {
        Map<UUID, Set<LocalDate>> personDays = new LinkedHashMap<>();
        for (MentionSignal signal : mentionRepository.findSignals(userId)) {
            LocalDate day = day(signal.ts());
            if (inWindow(day, from, to)) {
                personDays.computeIfAbsent(signal.personId(), k -> new HashSet<>()).add(day);
            }
        }
        Map<String, Set<LocalDate>> contextDays = new HashMap<>();
        for (MentionContextSignal signal : mentionRepository.findContextSignals(userId)) {
            LocalDate day = day(signal.ts());
            if (signal.contextLabel() != null && inWindow(day, from, to)) {
                contextDays.computeIfAbsent(signal.contextLabel(), k -> new HashSet<>()).add(day);
            }
        }
        Map<String, Set<LocalDate>> topicDays = new HashMap<>();
        for (TextSignalEntity signal : textSignalSeriesService.newestPerSource(userId, from, to)) {
            for (String topic : signal.getTopics()) {
                topicDays.computeIfAbsent(topic, k -> new HashSet<>()).add(signal.getOccurredOn());
            }
        }
        Set<LocalDate> workoutDays = workoutSessionRepository.findDoneInstancesBetween(userId, from, to)
                .stream().map(WorkoutSessionEntity::getDate).collect(Collectors.toSet());

        Map<String, Subject> out = new LinkedHashMap<>();
        personDays.forEach((personId, days) -> put(out, EffectLinkEntity.SUBJECT_PERSON, personId.toString(), days));
        put(out, EffectLinkEntity.SUBJECT_EVENT, EVENT_EDZES,
                union(workoutDays, contextDays.get("edzes")));
        put(out, EffectLinkEntity.SUBJECT_EVENT, EVENT_MUNKA,
                union(contextDays.get("munka"), topicDays.get("munka")));
        put(out, EffectLinkEntity.SUBJECT_EVENT, EVENT_CSALAD,
                union(contextDays.get("csalad"), topicDays.get("család")));
        put(out, EffectLinkEntity.SUBJECT_EVENT, EVENT_KOZOS_PROGRAM,
                union(contextDays.get("kozos_program"), contextDays.get("baratok")));
        put(out, EffectLinkEntity.SUBJECT_EVENT, EVENT_KONFLIKTUS,
                union(contextDays.get("konfliktus"), null));
        put(out, EffectLinkEntity.SUBJECT_EVENT, EVENT_PIHENES,
                union(topicDays.get("pihenés"), null));
        for (EffectLinkEntity existing : effectLinkRepository.findByCreatedByAndDeletedFalse(userId)) {
            out.putIfAbsent(existing.getSubjectKind() + ':' + existing.getSubjectKey(),
                    new Subject(existing.getSubjectKind(), existing.getSubjectKey(), Set.of()));
        }
        return List.copyOf(out.values());
    }

    private static void put(Map<String, Subject> out, String kind, String key, Set<LocalDate> days) {
        out.put(kind + ':' + key, new Subject(kind, key, days));
    }

    private static Set<LocalDate> union(Set<LocalDate> a, Set<LocalDate> b) {
        Set<LocalDate> out = new HashSet<>();
        if (a != null) out.addAll(a);
        if (b != null) out.addAll(b);
        return out;
    }

    private static LocalDate day(Instant ts) {
        return ts.atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static boolean inWindow(LocalDate day, LocalDate from, LocalDate to) {
        return !day.isBefore(from) && !day.isAfter(to);
    }

    /** Opens this subject's own {@code REQUIRES_NEW} transaction — see the class javadoc. */
    private int recomputeOne(UUID userId, Subject subject, Map<String, Map<LocalDate, Double>> series) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        Integer kept = own.execute(status -> writeSubject(userId, subject, series));
        return kept == null ? 0 : kept;
    }

    /** The subject's body — always inside {@link #recomputeOne}'s transaction. Re-reads the
     *  subject's rows so the upsert matches by (user, kind, key, metric) on fresh state. */
    private int writeSubject(UUID userId, Subject subject, Map<String, Map<LocalDate, Double>> series) {
        Map<String, EffectLinkEntity> existing = effectLinkRepository
                .findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(userId, subject.kind(), subject.key())
                .stream()
                .collect(Collectors.toMap(EffectLinkEntity::getMetric, Function.identity(), (a, b) -> a));
        Instant now = Instant.now();
        int kept = 0;
        for (String metric : METRICS.keySet()) {
            Optional<EffectLinkCalculator.Effect> effect =
                    EffectLinkCalculator.compute(subject.days(), series.get(metric));
            EffectLinkEntity row = existing.get(metric);
            if (effect.isPresent()) {
                effectLinkRepository.save(fill(row == null ? fresh(userId, subject, metric) : row,
                        effect.get(), now));
                kept++;
            } else if (row != null) {
                effectLinkRepository.delete(row);
            }
        }
        return kept;
    }

    private static EffectLinkEntity fresh(UUID userId, Subject subject, String metric) {
        EffectLinkEntity row = new EffectLinkEntity();
        row.setCreatedBy(userId);
        row.setSubjectKind(subject.kind());
        row.setSubjectKey(subject.key());
        row.setMetric(metric);
        return row;
    }

    private static EffectLinkEntity fill(EffectLinkEntity row, EffectLinkCalculator.Effect effect, Instant now) {
        row.setCliffsDelta(BigDecimal.valueOf(effect.cliffsDelta()).setScale(3, RoundingMode.HALF_UP));
        row.setMeanDiff(BigDecimal.valueOf(effect.meanDiff()).setScale(2, RoundingMode.HALF_UP));
        row.setSubjectDays(effect.subjectDays());
        row.setComplementDays(effect.complementDays());
        row.setStrengthBand(effect.strengthBand());
        row.setConfidenceTier(effect.confidenceTier());
        row.setWindowDays(WINDOW_DAYS);
        row.setComputedAt(now);
        return row;
    }

    // ---------------------------------------------------------------- read internals

    private static Comparator<EffectLinkEntity> byStrength() {
        return Comparator.comparing((EffectLinkEntity r) -> r.getCliffsDelta().abs()).reversed();
    }

    /** Active, non-deleted persons only — the same population {@code PeopleService.chatContext}
     *  (and so {@code PeopleSnapshotBlock}) puts in front of the model. */
    private Map<String, String> activePersonNames(UUID userId) {
        return personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
                .filter(p -> "active".equals(p.getStatus()))
                .collect(Collectors.toMap(p -> p.getId().toString(), PersonEntity::getName, (a, b) -> a));
    }

    private static Optional<String> line(EffectLinkEntity row, Map<String, String> personNames) {
        String subjectLabel = EffectLinkEntity.SUBJECT_PERSON.equals(row.getSubjectKind())
                ? personNames.get(row.getSubjectKey())
                : EVENT_LABELS_HU.get(row.getSubjectKey());
        if (subjectLabel == null) {
            return Optional.empty();
        }
        String direction = row.getCliffsDelta().signum() >= 0 ? "magasabb" : "alacsonyabb";
        return Optional.of("- " + oneLine(subjectLabel) + " és "
                + METRIC_LABELS_HU.getOrDefault(row.getMetric(), row.getMetric())
                + ": azokon a napokon " + direction
                + " (delta " + String.format(Locale.ROOT, "%.2f", row.getCliffsDelta()) + ", "
                + row.getSubjectDays() + " nap) · téma-kulcs: "
                + topicKey(row.getSubjectKind(), row.getSubjectKey(), row.getMetric()));
    }

    /** A user-typed name is data: never let an embedded newline forge a second line. */
    private static String oneLine(String value) {
        String collapsed = value.replaceAll("[\\p{Cntrl}]+", " ").replaceAll(" {2,}", " ").strip();
        return collapsed.length() > NAME_MAX_CHARS ? collapsed.substring(0, NAME_MAX_CHARS) + "…" : collapsed;
    }

    private Set<String> confirmedTopicKeys(UUID userId) {
        return patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, PatternEntity.STATUS_CONFIRMED)
                .stream()
                .filter(p -> p.getEvidence() != null && p.getEvidence().items() != null)
                .flatMap(p -> p.getEvidence().items().stream())
                .filter(Objects::nonNull)
                .filter(item -> item.startsWith(OBSERVATION_TOPIC_KEY_PREFIX))
                .map(item -> item.substring(OBSERVATION_TOPIC_KEY_PREFIX.length()))
                .collect(Collectors.toSet());
    }

    /** A detached copy one tier up — the managed row is never touched, so nothing can flush it. */
    private static EffectLinkEntity bumped(EffectLinkEntity row) {
        EffectLinkEntity copy = new EffectLinkEntity();
        copy.setId(row.getId());
        copy.setCreatedBy(row.getCreatedBy());
        copy.setCreatedAt(row.getCreatedAt());
        copy.setSubjectKind(row.getSubjectKind());
        copy.setSubjectKey(row.getSubjectKey());
        copy.setMetric(row.getMetric());
        copy.setCliffsDelta(row.getCliffsDelta());
        copy.setMeanDiff(row.getMeanDiff());
        copy.setSubjectDays(row.getSubjectDays());
        copy.setComplementDays(row.getComplementDays());
        copy.setStrengthBand(row.getStrengthBand());
        int tier = TIER_LADDER.indexOf(row.getConfidenceTier());
        copy.setConfidenceTier(TIER_LADDER.get(Math.min(TIER_LADDER.size() - 1, Math.max(0, tier) + 1)));
        copy.setWindowDays(row.getWindowDays());
        copy.setComputedAt(row.getComputedAt());
        return copy;
    }

    private static Map<String, String> eventLabels() {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put(EVENT_EDZES, "Edzésnapok");
        labels.put(EVENT_MUNKA, "Munkás napok");
        labels.put(EVENT_CSALAD, "Családi napok");
        labels.put(EVENT_KOZOS_PROGRAM, "Közös programok");
        labels.put(EVENT_KONFLIKTUS, "Konfliktusos napok");
        labels.put(EVENT_PIHENES, "Pihenős napok");
        return Map.copyOf(labels);
    }

    private static Map<String, MetricKey> metrics() {
        Map<String, MetricKey> m = new LinkedHashMap<>();
        m.put(EffectLinkEntity.METRIC_MENTAL, MetricKey.CHECKIN_MENTAL);
        m.put(EffectLinkEntity.METRIC_ENERGY, MetricKey.CHECKIN_ENERGY);
        m.put(EffectLinkEntity.METRIC_STRESS, MetricKey.CHECKIN_STRESS);
        return Collections.unmodifiableMap(m);
    }
}
