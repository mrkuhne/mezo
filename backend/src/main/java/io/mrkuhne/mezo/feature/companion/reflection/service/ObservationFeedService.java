package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.api.dto.ObservationResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Shared current inbox and day-bound historical events. Replies are event-relative, while
 * standing watching rows retain their latest personal reply. Statistical watching rows are
 * read-only on this surface and keep their separate lifecycle. Pending grounded publication
 * is serialized with all other observation writers inside the caller's transaction. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ObservationFeedService {

    public static final String CARD_FRESH = "fresh";
    public static final String CARD_RETURN = "return";
    public static final String CARD_WATCHING = "watching";
    public static final String CARD_CONFIRMED = "confirmed";

    /** How many of a row's newest replies are read back — far more than any card ever needs. */
    private static final int REPLY_LOOKBACK = 10;

    private final ObservationOwnerLock ownerLock;
    private final ObservationBudget observationBudget;
    private final ObservationContextService observationContextService;
    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;

    /**
     * @param day the calendar day whose observations (and confirmations) are shown; {@code null}
     *            means today. The {@code confirmed} group is that day's OWN
     *            {@code [00:00, 24:00)} window — not a rolling 24 hours ending at wall-clock now —
     *            so asking for a past day gives back what that day actually looked like instead of
     *            a moving target.
     */
    @Transactional
    public List<ObservationResponse> forDay(UUID userId, LocalDate day) {
        LocalDate target = day == null ? LocalDate.now() : day;
        ZoneId zone = ZoneId.systemDefault();
        Instant from = target.atStartOfDay(zone).toInstant();
        Instant to = target.plusDays(1).atStartOfDay(zone).toInstant();

        boolean inbox = target.equals(LocalDate.now());
        Instant historyFrom = inbox ? Instant.EPOCH : from;
        if (inbox) releasePending(userId, historyFrom, to);
        List<PatternEventEntity> dayEvents = patternEventRepository
                .findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
                        userId, List.of(PatternEventEntity.KIND_OBSERVATION,
                                PatternEventEntity.KIND_CONFIRMED), historyFrom, to);

        Map<UUID, PatternEntity> rows = new HashMap<>();
        List<ObservationResponse> fresh = new ArrayList<>();
        List<ObservationResponse> returning = new ArrayList<>();
        Map<UUID, List<PatternEventEntity>> repliesByRow = new HashMap<>();

        var emitted = new java.util.HashSet<UUID>();
        for (PatternEventEntity event : newestFirst(dayEvents)) {
            if (!PatternEventEntity.KIND_OBSERVATION.equals(event.getKind())
                    || !Boolean.TRUE.equals(event.getPayload().surfaced())) {
                continue; // an over-budget notice was stored, but the user never saw it
            }
            PatternEntity row = row(userId, rows, event.getPatternId());
            if (row == null || !row.isReflectionOwned() || !validEvidence(userId, row)
                    || !validEventEvidence(userId, event)
                    || (inbox && (PatternEntity.isUserFrozen(row.getStatus())
                    || PatternEntity.STATUS_DORMANT.equals(row.getStatus())
                    || PatternEntity.STATUS_REFUTED.equals(row.getStatus())))) {
                continue;
            }
            if (!emitted.add(row.getId())) continue;
            List<PatternEventEntity> replies = replies(userId, repliesByRow, row.getId());
            if (event.getOccurredAt().isBefore(from) && choiceAfter(replies, event.getOccurredAt()) != null) {
                continue; // old answered cards are history, never fresh questions again
            }
            boolean answeredBefore = replies.stream()
                    .anyMatch(reply -> reply.getOccurredAt().isBefore(event.getOccurredAt()));
            (answeredBefore ? returning : fresh).add(eventCard(userId, row, event,
                    answeredBefore ? CARD_RETURN : CARD_FRESH, replies));
        }

        List<ObservationResponse> watching = inbox ? patternRepository
                .findByCreatedByAndKindInAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, List.of(PatternEntity.KIND_REFLECTION, PatternEntity.KIND_AI_HYPOTHESIS,
                                PatternEntity.KIND_STATISTICAL), PatternEntity.STATUS_MONITORING)
                .stream()
                .filter(row -> row.getTestPlan() != null)
                .filter(row -> validEvidence(userId, row))
                .filter(row -> java.util.stream.Stream.concat(fresh.stream(), returning.stream())
                        .noneMatch(card -> card.getPatternId().equals(row.getId())))
                .map(row -> rowCard(userId, row, CARD_WATCHING, row.getLastDetectedAt(),
                        replies(userId, repliesByRow, row.getId())))
                .toList() : List.of();

        List<ObservationResponse> confirmed = new ArrayList<>();
        for (PatternEventEntity event : newestFirst(dayEvents)) {
            if (!PatternEventEntity.KIND_CONFIRMED.equals(event.getKind())
                    || event.getOccurredAt().isBefore(from)) {
                continue;
            }
            PatternEntity row = row(userId, rows, event.getPatternId());
            if (row == null || !row.isReflectionOwned() || !validEvidence(userId, row)) {
                continue; // a statistical row the user confirmed belongs to Minták, not here
            }
            // one card per row even if the day carries several confirmations — the newest wins
            if (confirmed.stream().noneMatch(c -> c.getId().equals(row.getId()))) {
                confirmed.add(rowCard(userId, row, CARD_CONFIRMED, event.getOccurredAt(),
                        replies(userId, repliesByRow, row.getId())));
            }
        }

        List<ObservationResponse> cards = new ArrayList<>(fresh);
        cards.addAll(returning);
        cards.addAll(watching);
        cards.addAll(confirmed);
        return List.copyOf(cards);
    }

    private static List<PatternEventEntity> newestFirst(List<PatternEventEntity> events) {
        return events.stream()
                .sorted(Comparator.comparing(PatternEventEntity::getOccurredAt).reversed())
                .toList();
    }

    private PatternEntity row(UUID userId, Map<UUID, PatternEntity> cache, UUID patternId) {
        return cache.computeIfAbsent(patternId, id -> patternRepository
                .findByIdAndCreatedByAndDeletedFalse(id, userId).orElse(null));
    }

    /** A queued card spends its shared daily slot only when it becomes visible. */
    private void releasePending(UUID userId, Instant from, Instant to) {
        ownerLock.lock(userId);
        int remaining = observationBudget.remainingToday(userId, Instant.now());
        if (remaining == 0) return;
        var pending = patternEventRepository
                .findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
                        userId, List.of(PatternEventEntity.KIND_OBSERVATION), from, to).stream()
                .filter(e -> "grounded".equals(e.getPayload().channel()))
                .filter(e -> !Boolean.TRUE.equals(e.getPayload().surfaced()))
                .sorted(Comparator.comparing(PatternEventEntity::getOccurredAt)).toList();
        for (var event : pending) {
            if (remaining == 0) break;
            var row = patternRepository.findByIdAndCreatedByAndDeletedFalse(event.getPatternId(), userId).orElse(null);
            if (row == null || !row.isReflectionOwned() || !validEvidence(userId, row)
                    || !validEventEvidence(userId, event)
                    || PatternEntity.isUserFrozen(row.getStatus())
                    || PatternEntity.STATUS_DORMANT.equals(row.getStatus())
                    || PatternEntity.STATUS_REFUTED.equals(row.getStatus())) continue;
            var latest = patternEventRepository
                    .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                            userId, row.getId(), PatternEventEntity.KIND_OBSERVATION);
            if (latest.isEmpty() || !latest.get().getId().equals(event.getId())) continue;
            var reply = patternEventRepository
                    .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                            userId, row.getId(), PatternEventEntity.KIND_USER_REPLY);
            if (reply.isPresent() && !reply.get().getOccurredAt().isBefore(event.getOccurredAt())) continue;
            var p = event.getPayload();
            event.setPayload(new PatternEventPayloadEnvelope(p.r(), p.n(), p.p(), p.reinforcementCount(),
                    p.factId(), p.hit(), p.verdict(), p.channel(), p.choice(), p.text(), p.evidenceRefs(), true));
            // Publication happens now; original source dates remain in the evidence, and the
            // row's created_at still records when the candidate was generated.
            event.setOccurredAt(Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
            patternEventRepository.saveAndFlush(event);
            remaining--;
        }
    }

    private boolean validEvidence(UUID userId, PatternEntity row) {
        if (row.getEvidence() == null || row.getEvidence().items() == null) return true;
        if (row.getEvidence().items().stream().noneMatch(ref -> ref != null
                && ref.startsWith("observation-topic:"))) return true;
        // Grounded rows use the original-record catalogue. Legacy quick notices use a different
        // reference vocabulary (e.g. gratitude/chat_day); preserve their existing read semantics.
        return row.getEvidence().items().stream()
                .filter(ref -> ref != null && ref.matches("[a-z_]+:[0-9a-fA-F-]{36}"))
                .allMatch(ref -> observationContextService.exists(userId, ref));
    }

    /** Historical snapshots carry their own provenance: the thread may now reference newer sources. */
    private boolean validEventEvidence(UUID userId, PatternEventEntity event) {
        if (!"grounded".equals(event.getPayload().channel())) return true;
        var refs = event.getPayload().evidenceRefs();
        return refs == null || refs.stream().filter(ObservationFeedService::canonicalReference)
                .allMatch(ref -> observationContextService.exists(userId, ref));
    }

    private static boolean canonicalReference(String ref) {
        return ref != null && ref.matches("[a-z_]+:[0-9a-fA-F-]{36}");
    }

    private static ObservationEvidenceItem tag(String text) {
        return ObservationEvidenceItem.builder().type("tag").text(text).build();
    }

    private ObservationEvidenceItem record(String ref, ObservationContextService.SourceRecord rec) {
        return ObservationEvidenceItem.builder().type("record").source(rec.source())
                .date(LocalDate.parse(rec.date())).time(rec.time())
                .fields(rec.fields()).quote(rec.quote()).ref(ref).build();
    }

    /** Grounded lists: canonical refs re-read losslessly; the stored label that may follow a ref
     *  (event snapshots interleave pairs) is consumed as fallback-only. Topic markers are dropped. */
    private List<ObservationEvidenceItem> evidenceItems(UUID userId, List<String> refs) {
        if (refs == null) return List.of();
        var out = new ArrayList<ObservationEvidenceItem>();
        for (int i = 0; i < refs.size(); i++) {
            String ref = refs.get(i);
            if (ref == null || ref.startsWith("observation-topic")) continue;
            if (!canonicalReference(ref)) { out.add(tag(ref)); continue; }
            String next = i + 1 < refs.size() ? refs.get(i + 1) : null;
            String label = next != null && !canonicalReference(next) && !next.startsWith("observation-topic")
                    ? next : null;
            if (label != null) i++;
            var fetched = observationContextService.fetch(userId, ref).filter(r -> r.date() != null);
            if (fetched.isPresent()) out.add(record(ref, fetched.get()));
            else if (label != null) out.add(tag(label));
        }
        return out;
    }

    /** Legacy quick-notice vocabulary (gratitude/chat_day refs, free-text labels) passes through
     *  verbatim as tags — mirrors the old unfiltered read semantics. */
    private static List<ObservationEvidenceItem> legacyItems(List<String> refs) {
        return refs == null ? List.of() : refs.stream().filter(Objects::nonNull)
                .map(ObservationFeedService::tag)
                .toList();
    }

    /** The row's newest replies, freshest first — owned, so a foreign row yields nothing. */
    private List<PatternEventEntity> replies(UUID userId, Map<UUID, List<PatternEventEntity>> cache,
                                             UUID patternId) {
        return cache.computeIfAbsent(patternId, id -> patternEventRepository
                .findTop10ByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, id, PatternEventEntity.KIND_USER_REPLY)
                .stream()
                .limit(REPLY_LOOKBACK)
                .toList());
    }

    /** A {@code fresh}/{@code return} card renders ONE observation event; its id is the event's. */
    private ObservationResponse eventCard(UUID userId, PatternEntity row, PatternEventEntity event, String card,
                                          List<PatternEventEntity> replies) {
        PatternEventPayloadEnvelope payload = event.getPayload();
        String[] split = splitTextAndQuestion(payload.text());
        return base(row, card)
                .id(event.getId())
                .occurredAt(toOffset(event.getOccurredAt()))
                .text(ObservationLead.strip(split[0]))
                .question(split[1])
                .evidence("grounded".equals(payload.channel()) ? evidenceItems(userId, payload.evidenceRefs())
                        : legacyItems(payload.evidenceRefs()))
                .repliedChoice(choiceAfter(replies, event.getOccurredAt()))
                .build();
    }

    /** A {@code watching}/{@code confirmed} card renders the ROW's state; its id is the row's. */
    private ObservationResponse rowCard(UUID userId, PatternEntity row, String card, Instant occurredAt,
                                        List<PatternEventEntity> replies) {
        return base(row, card)
                .id(row.getId())
                .occurredAt(toOffset(occurredAt))
                // no prose of its own: on these cards the tallies ARE the message
                .text("")
                .question(null)
                .evidence(evidenceItems(userId, row.getEvidence() == null ? null : row.getEvidence().items()))
                // the ROW's newest answer, NOT one anchored on `occurredAt`: `lastDetectedAt` is
                // bumped by the nightly evaluation, which would re-arm the chips every night
                .repliedChoice(newestChoice(replies))
                .build();
    }

    private ObservationResponse.ObservationResponseBuilder base(PatternEntity row, String card) {
        return ObservationResponse.builder()
                .patternId(row.getId())
                .kind(row.getKind())
                .hypothesisKey(PatternEntity.KIND_STATISTICAL.equals(row.getKind())
                        ? row.getPairKey() : row.getHypothesisKey())
                .card(card)
                .title(row.getTitle())
                .status(row.getStatus())
                .evidenceHits(row.getEvidenceHits())
                .evidenceMisses(row.getEvidenceMisses())
                .minN(row.getTestPlan() == null ? null : row.getTestPlan().minN())
                .belief(row.getBelief() == null ? null : row.getBelief().doubleValue())
                .sourceIcon(ObservationSourceIcon.of(row.getTestPlan()));
    }

    /** The newest chip choice made AFTER this card's moment — what the FE greys the chips with.
     *  Only EVENT cards use it: an observation's chips answer that observation. */
    private static String choiceAfter(List<PatternEventEntity> replies, Instant moment) {
        return newestChoice(replies.stream()
                .filter(reply -> !reply.getOccurredAt().isBefore(moment))
                .toList());
    }

    /** The row's newest chip choice, whenever it was made — what a standing ROW card shows. */
    private static String newestChoice(List<PatternEventEntity> replies) {
        return replies.stream()
                .map(reply -> reply.getPayload().choice())
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    /**
     * The quick notice stores the prose and its question in ONE payload field joined by a newline
     * (so the pair can never drift apart), and the feed is the only place that splits them again —
     * on the LAST newline, so a multi-paragraph observation keeps its shape.
     */
    private static String[] splitTextAndQuestion(String stored) {
        if (stored == null) {
            return new String[]{"", null};
        }
        int cut = stored.lastIndexOf('\n');
        return cut < 0
                ? new String[]{stored, null}
                : new String[]{stored.substring(0, cut), stored.substring(cut + 1)};
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
