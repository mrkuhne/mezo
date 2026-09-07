package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S4 (mezo-eq85.4, spec 2026-09-06 §6): the morning one-liner. What the night actually
 * DECIDED about the user's own hypotheses, as one deterministic Hungarian sentence built in code —
 * this class has no LLM dependency at all, so the digest can never claim something the numbers did
 * not say. The morning message's generator receives it as a FACT block to allude to, never as text
 * to repeat.
 *
 * <p><b>The window is {@code [date−1 05:00, date 05:00)}</b> in the server zone — "last night",
 * bounded so that the 03:40 {@code ReflectionJob} run of the requested morning falls INSIDE it and
 * the 05:45 morning message therefore reports the night that just ran (see
 * {@link #NIGHT_BOUNDARY}). It is derived from the {@code date} ARGUMENT and
 * never from {@code LocalDate.now()}, so asking for a past day gives back what that morning
 * actually said instead of a moving target (and so a test cannot desync from the code across
 * midnight).
 *
 * <p><b>What it looks for, in order:</b> the newest verdict ({@code confirmed} / {@code refuted} /
 * {@code dormant}) on a reflection-owned row; failing that, the newest {@code evidence} of a
 * {@code monitoring} row the user has actually ANSWERED — a row nobody asked about is not "amit
 * kértél". {@code dormant} is a verdict like the other two and reports its own sentence (mezo-cuml):
 * the hypothesis is not disproven, it simply went quiet for lack of fresh data, and saying so is
 * this morning's real news. It used to carry no copy, so {@code verdictSentence} returned empty for
 * it and the digest fell THROUGH to an older {@code confirmed}/{@code refuted} — reporting stale
 * news in place of what the night actually decided. Ordering is by time alone, never by kind.
 *
 * <p><b>Only reflection-owned rows</b> ({@link PatternEntity#REFLECTION_OWNED_KINDS}): a
 * {@code statistical} catalog row's lifecycle belongs to the nightly Pearson job and the Minták
 * screen, not to the Észrevételek voice.
 *
 * <p><b>Fail-soft by construction, and the rule is: a digest failure may NEVER cost the user their
 * morning message.</b> The digest is a garnish; the briefing is the product. Two things enforce it,
 * belt and braces:
 *
 * <ul>
 *   <li><b>{@code REQUIRES_NEW}.</b> The morning generator calls this from INSIDE its own
 *       transaction. A REQUIRED method would join that transaction, and Hibernate's
 *       {@code ExceptionConverter} marks the current transaction rollback-only at the moment a
 *       {@code PersistenceException} is THROWN — before any {@code catch} of ours runs. The
 *       generator's later {@code saveAndFlush} would then die with
 *       {@code UnexpectedRollbackException} no matter who caught what (the S3 finding). A separate
 *       physical transaction is the only thing that contains that damage, and one extra connection
 *       per morning message is cheap next to "no morning briefing at all".
 *   <li><b>A {@value #DIGEST_TIMEOUT_SECONDS}-second query timeout.</b> This bounds a TEST
 *       pathology, not a production one: under Postgres MVCC a plain {@code SELECT} never blocks
 *       on row locks a concurrent transaction holds, so in production the digest's two indexed
 *       reads have nothing to wait on except an {@code ACCESS EXCLUSIVE} holder — DDL, a Liquibase
 *       migration, or {@code VACUUM FULL}, i.e. a deploy window, not ordinary traffic. The concrete
 *       driver was found in this codebase's own integration tests: a class-level
 *       {@code @Transactional} IT never commits its {@code ResetDatabase} fixture's
 *       {@code TRUNCATE} for the duration of the test method, and {@code TRUNCATE} does take an
 *       {@code ACCESS EXCLUSIVE} lock — so a {@code REQUIRES_NEW} digest read from inside such a
 *       test genuinely waited forever. The timeout exists so that pathology (or any real deploy-
 *       window collision) fails soft instead of hanging: two seconds is ~40x the real cost of
 *       these two indexed reads, and on expiry the read fails, the catch below turns it into no
 *       digest, and the briefing still goes out on time.
 *   <li><b>The in-body {@code catch}.</b> It keeps the ordinary failure quiet as well: the proxy
 *       never sees an exception, so the new transaction commits cleanly and the caller simply gets
 *       {@link Optional#empty()}.
 * </ul>
 *
 * <p>{@code ReflectionDigestMorningIT} pins the rule with a digest failure that marks its
 * transaction rollback-only exactly the way Hibernate does, and asserts the morning message is
 * still generated and saved.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionDigestService {

    /** Ceiling on the digest's own transaction — see the class javadoc's REQUIRES_NEW note. */
    static final int DIGEST_TIMEOUT_SECONDS = 2;

    /**
     * The hour the nightly pass has finished by — both ends of the "last night" window.
     *
     * <p><b>05:00, and the value is load-bearing.</b> It has to sit AFTER the nightly
     * {@code ReflectionJob} (03:40, {@code mezo.companion.reflection.cron}) and BEFORE the morning
     * message job (05:45, {@code mezo.proactive.feed.morning-cron}). At the original 03:00 the
     * window ENDED 40 minutes before the run it was supposed to report, so the 05:45 message
     * described the night BEFORE while saying „Ma éjjel…" (whole-branch review finding).
     */
    private static final LocalTime NIGHT_BOUNDARY = LocalTime.of(5, 0);

    private static final List<String> VERDICT_KINDS = List.of(
            PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_REFUTED,
            PatternEventEntity.KIND_DORMANT);

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;

    /** The digest's sentence plus the row it is about — the title is the morning message's
     *  {@code Ref("Pattern", …)} label. */
    public record Digest(String title, String sentence) {}

    /** The morning one-liner, or empty when the night decided nothing worth saying. */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW,
            timeout = DIGEST_TIMEOUT_SECONDS)
    public Optional<String> digestFor(UUID userId, LocalDate date) {
        return digestEntryFor(userId, date).map(Digest::sentence);
    }

    /** As {@link #digestFor}, plus the pattern title the caller cites the digest by. */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW,
            timeout = DIGEST_TIMEOUT_SECONDS)
    public Optional<Digest> digestEntryFor(UUID userId, LocalDate date) {
        try {
            return verdictDigest(userId, date).or(() -> evidenceDigest(userId, date));
        } catch (Exception e) {
            // Fail-soft ON PURPOSE, and inside the method as well as behind REQUIRES_NEW: see the
            // class javadoc. A missing digest is a quieter morning; a thrown one is no morning.
            log.warn("Reflection digest failed for user {} on {} — no digest today", userId, date, e);
            return Optional.empty();
        }
    }

    /** The newest verdict of the night — {@code confirmed}, {@code refuted} or {@code dormant},
     *  whichever occurred LAST (see class javadoc). */
    private Optional<Digest> verdictDigest(UUID userId, LocalDate date) {
        return newestFirst(events(userId, date, VERDICT_KINDS)).stream()
                .flatMap(event -> row(userId, event.getPatternId())
                        .map(row -> verdictSentence(event.getKind(), row))
                        .orElse(Optional.empty())
                        .stream())
                .findFirst();
    }

    private Optional<Digest> verdictSentence(String kind, PatternEntity row) {
        return switch (kind) {
            case PatternEventEntity.KIND_CONFIRMED -> Optional.of(new Digest(row.getTitle(),
                    "Ma éjjel megerősítettem: „" + row.getTitle() + "”. Beépítettem a tudásba."));
            case PatternEventEntity.KIND_REFUTED -> Optional.of(new Digest(row.getTitle(),
                    "Elengedtem: „" + row.getTitle() + "” — a számok nem támasztották alá."));
            case PatternEventEntity.KIND_DORMANT -> Optional.of(new Digest(row.getTitle(),
                    "Félretettem: „" + row.getTitle()
                            + "” — rég nem jött hozzá új adat. Ha visszatér, újra ránézek."));
            default -> Optional.empty();
        };
    }

    /**
     * The night's newest test re-run on a row the user asked to be watched. An event whose
     * {@code hit} is null is skipped: the gate was not live, so "bejött / nem jött be" would be a
     * claim the numbers never made.
     */
    private Optional<Digest> evidenceDigest(UUID userId, LocalDate date) {
        for (PatternEventEntity event
                : newestFirst(events(userId, date, List.of(PatternEventEntity.KIND_EVIDENCE)))) {
            Boolean hit = event.getPayload().hit();
            if (hit == null) {
                continue;
            }
            PatternEntity row = row(userId, event.getPatternId()).orElse(null);
            if (row == null || !PatternEntity.STATUS_MONITORING.equals(row.getStatus())
                    || !hasUserReply(userId, row.getId())) {
                continue;
            }
            int hits = row.getEvidenceHits() == null ? 0 : row.getEvidenceHits();
            int misses = row.getEvidenceMisses() == null ? 0 : row.getEvidenceMisses();
            return Optional.of(new Digest(row.getTitle(),
                    "Tegnap kérted, hogy figyeljem: „" + row.getTitle() + "” — az éjjeli számítás "
                            + "szerint " + (hit ? "bejött" : "nem jött be")
                            + " (" + hits + " / " + (hits + misses) + ")."));
        }
        return Optional.empty();
    }

    private List<PatternEventEntity> events(UUID userId, LocalDate date, List<String> kinds) {
        ZoneId zone = ZoneId.systemDefault();
        Instant from = date.minusDays(1).atTime(NIGHT_BOUNDARY).atZone(zone).toInstant();
        Instant to = date.atTime(NIGHT_BOUNDARY).atZone(zone).toInstant();
        return patternEventRepository
                .findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
                        userId, kinds, from, to);
    }

    private static List<PatternEventEntity> newestFirst(List<PatternEventEntity> events) {
        return events.stream()
                .sorted(Comparator.comparing(PatternEventEntity::getOccurredAt).reversed())
                .toList();
    }

    /** Owned lookup, reflection-owned rows only — the digest never speaks for the Pearson job. */
    private Optional<PatternEntity> row(UUID userId, UUID patternId) {
        return patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .filter(PatternEntity::isReflectionOwned);
    }

    private boolean hasUserReply(UUID userId, UUID patternId) {
        return patternEventRepository.countByCreatedByAndPatternIdAndKindAndDeletedFalse(
                userId, patternId, PatternEventEntity.KIND_USER_REPLY) > 0;
    }
}
