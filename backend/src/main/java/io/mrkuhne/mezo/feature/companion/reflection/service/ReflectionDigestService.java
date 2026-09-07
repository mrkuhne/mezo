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
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S4 (mezo-eq85.4, spec 2026-09-06 §6): the morning one-liner. What the night actually
 * DECIDED about the user's own hypotheses, as one deterministic Hungarian sentence built in code —
 * this class has no LLM dependency at all, so the digest can never claim something the numbers did
 * not say. The morning message's generator receives it as a FACT block to allude to, never as text
 * to repeat.
 *
 * <p><b>The window is {@code [date−1 03:00, date 03:00)}</b> in the server zone — "last night", the
 * hours the nightly {@code ReflectionJob} runs in. It is derived from the {@code date} ARGUMENT and
 * never from {@code LocalDate.now()}, so asking for a past day gives back what that morning
 * actually said instead of a moving target (and so a test cannot desync from the code across
 * midnight).
 *
 * <p><b>What it looks for, in order:</b> the newest verdict ({@code confirmed} / {@code refuted})
 * on a reflection-owned row; failing that, the newest {@code evidence} of a {@code monitoring} row
 * the user has actually ANSWERED — a row nobody asked about is not "amit kértél". A {@code dormant}
 * verdict is deliberately silent: it is the engine giving up for lack of data, and the product has
 * written no sentence for it — inventing one here would be inventing user-visible copy.
 *
 * <p><b>Only reflection-owned rows</b> ({@link PatternEntity#REFLECTION_OWNED_KINDS}): a
 * {@code statistical} catalog row's lifecycle belongs to the nightly Pearson job and the Minták
 * screen, not to the Észrevételek voice.
 *
 * <p><b>Fail-soft by construction.</b> {@code @Transactional(readOnly = true)} joins the morning
 * generator's own transaction, and a REQUIRED method that throws inside a caller's transaction
 * marks it rollback-only — which would defeat the caller's {@code catch} and kill the whole morning
 * message (the S3 {@code UnexpectedRollbackException} finding). So the failure is caught HERE,
 * inside the method body, and turned into {@link Optional#empty()}: the proxy never sees an
 * exception, nothing is marked rollback-only, and the morning message ships without the digest.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionDigestService {

    /** The hour the nightly pass has finished by — both ends of the "last night" window. */
    private static final LocalTime NIGHT_BOUNDARY = LocalTime.of(3, 0);

    private static final List<String> VERDICT_KINDS = List.of(
            PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_REFUTED,
            PatternEventEntity.KIND_DORMANT);

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;

    /** The digest's sentence plus the row it is about — the title is the morning message's
     *  {@code Ref("Pattern", …)} label. */
    public record Digest(String title, String sentence) {}

    /** The morning one-liner, or empty when the night decided nothing worth saying. */
    @Transactional(readOnly = true)
    public Optional<String> digestFor(UUID userId, LocalDate date) {
        return digestEntryFor(userId, date).map(Digest::sentence);
    }

    /** As {@link #digestFor}, plus the pattern title the caller cites the digest by. */
    @Transactional(readOnly = true)
    public Optional<Digest> digestEntryFor(UUID userId, LocalDate date) {
        try {
            return verdictDigest(userId, date).or(() -> evidenceDigest(userId, date));
        } catch (Exception e) {
            // Fail-soft ON PURPOSE, and inside the method rather than at the caller: see the class
            // javadoc. A missing digest is a quieter morning; a thrown one is no morning at all.
            log.warn("Reflection digest failed for user {} on {} — no digest today", userId, date, e);
            return Optional.empty();
        }
    }

    /** The newest verdict of the night. {@code dormant} carries no sentence (see class javadoc). */
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
