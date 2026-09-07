package io.mrkuhne.mezo.feature.companion.reflection.service;

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

/**
 * Reflexió S4 (mezo-eq85.4, spec 2026-09-06 §5): the Észrevételek tab's read model. Four card
 * kinds in ONE fixed order — {@code fresh} (today's surfaced observations), {@code return}
 * (today's observations that answer an earlier reply of yours), {@code watching} (what the engine
 * is testing right now) and {@code confirmed} (what it settled today) — newest first inside each
 * group. The order is the message: what Mezo noticed today comes before what it is still chewing.
 *
 * <p>Read-only by construction: it appends nothing and moves nothing. Everything it shows was
 * written by the nightly pass, the quick notice or {@link ReflectionReplyService}.
 */
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

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;

    /**
     * @param day the calendar day whose observations (and confirmations) are shown; {@code null}
     *            means today. The {@code confirmed} group's "last 24 hours" is anchored on this
     *            day's own window rather than on wall-clock now, so asking for a past day gives
     *            back what that day actually looked like instead of a moving target.
     */
    @Transactional(readOnly = true)
    public List<ObservationResponse> forDay(UUID userId, LocalDate day) {
        LocalDate target = day == null ? LocalDate.now() : day;
        ZoneId zone = ZoneId.systemDefault();
        Instant from = target.atStartOfDay(zone).toInstant();
        Instant to = target.plusDays(1).atStartOfDay(zone).toInstant();

        List<PatternEventEntity> dayEvents = patternEventRepository
                .findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
                        userId, List.of(PatternEventEntity.KIND_OBSERVATION,
                                PatternEventEntity.KIND_CONFIRMED), from, to);

        Map<UUID, PatternEntity> rows = new HashMap<>();
        List<ObservationResponse> fresh = new ArrayList<>();
        List<ObservationResponse> returning = new ArrayList<>();
        Map<UUID, List<PatternEventEntity>> repliesByRow = new HashMap<>();

        for (PatternEventEntity event : newestFirst(dayEvents)) {
            if (!PatternEventEntity.KIND_OBSERVATION.equals(event.getKind())
                    || !Boolean.TRUE.equals(event.getPayload().surfaced())) {
                continue; // an over-budget notice was stored, but the user never saw it
            }
            PatternEntity row = row(userId, rows, event.getPatternId());
            if (row == null) {
                continue; // the row was deleted out from under its own history
            }
            List<PatternEventEntity> replies = replies(userId, repliesByRow, row.getId());
            boolean answeredBefore = replies.stream()
                    .anyMatch(reply -> reply.getOccurredAt().isBefore(event.getOccurredAt()));
            (answeredBefore ? returning : fresh).add(eventCard(row, event,
                    answeredBefore ? CARD_RETURN : CARD_FRESH, replies));
        }

        List<ObservationResponse> watching = patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, PatternEntity.STATUS_MONITORING)
                .stream()
                .filter(row -> row.getTestPlan() != null)
                .map(row -> rowCard(row, CARD_WATCHING, row.getLastDetectedAt(),
                        replies(userId, repliesByRow, row.getId())))
                .toList();

        List<ObservationResponse> confirmed = new ArrayList<>();
        for (PatternEventEntity event : newestFirst(dayEvents)) {
            if (!PatternEventEntity.KIND_CONFIRMED.equals(event.getKind())) {
                continue;
            }
            PatternEntity row = row(userId, rows, event.getPatternId());
            // one card per row even if the day carries several confirmations — the newest wins
            if (row != null && confirmed.stream().noneMatch(c -> c.getId().equals(row.getId()))) {
                confirmed.add(rowCard(row, CARD_CONFIRMED, event.getOccurredAt(),
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
    private ObservationResponse eventCard(PatternEntity row, PatternEventEntity event, String card,
                                          List<PatternEventEntity> replies) {
        PatternEventPayloadEnvelope payload = event.getPayload();
        String[] split = splitTextAndQuestion(payload.text());
        return base(row, card)
                .id(event.getId())
                .occurredAt(toOffset(event.getOccurredAt()))
                .text(split[0])
                .question(split[1])
                .evidence(payload.evidenceRefs() == null ? List.of() : payload.evidenceRefs())
                .repliedChoice(choiceAfter(replies, event.getOccurredAt()))
                .build();
    }

    /** A {@code watching}/{@code confirmed} card renders the ROW's state; its id is the row's. */
    private ObservationResponse rowCard(PatternEntity row, String card, Instant occurredAt,
                                        List<PatternEventEntity> replies) {
        return base(row, card)
                .id(row.getId())
                .occurredAt(toOffset(occurredAt))
                // no prose of its own: on these cards the tallies ARE the message
                .text("")
                .question(null)
                .evidence(row.getEvidence() == null ? List.of() : row.getEvidence().items())
                .repliedChoice(choiceAfter(replies, occurredAt))
                .build();
    }

    private ObservationResponse.ObservationResponseBuilder base(PatternEntity row, String card) {
        return ObservationResponse.builder()
                .patternId(row.getId())
                .hypothesisKey(row.getHypothesisKey())
                .card(card)
                .title(row.getTitle())
                .status(row.getStatus())
                .evidenceHits(row.getEvidenceHits())
                .evidenceMisses(row.getEvidenceMisses())
                .minN(row.getTestPlan() == null ? null : row.getTestPlan().minN())
                .belief(row.getBelief() == null ? null : row.getBelief().doubleValue())
                .sourceIcon(ObservationSourceIcon.of(row.getTestPlan()));
    }

    /** The newest chip choice made AFTER this card's moment — what the FE greys the chips with. */
    private static String choiceAfter(List<PatternEventEntity> replies, Instant moment) {
        return replies.stream()
                .filter(reply -> !reply.getOccurredAt().isBefore(moment))
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
