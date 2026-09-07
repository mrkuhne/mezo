package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.api.dto.CreateConversationRequest;
import io.mrkuhne.mezo.api.dto.PatternReplyResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.mapper.PatternTestPlanMapper;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.feature.companion.service.PatternEventAppender;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reflexió S4 (mezo-eq85.4, spec 2026-09-06 §5): the chip answer under an észrevétel —
 * „figyeld tovább” / „nem stimmel” / „beszéljünk róla”.
 *
 * <p><b>Code decides, the model never does.</b> The reply lands as an append-only
 * {@code user_reply} event; the two status moves it can cause are USER rules executed here
 * ({@code watch} starts monitoring a still-{@code proposed} row; the SECOND {@code reject}
 * refutes it — a single one is a doubt, not a verdict), and {@code belief} is recomputed by the
 * pure {@link HypothesisLifecycle}. No LLM answer can reach either column.
 *
 * <p><b>Propagation is the default {@code REQUIRED}, deliberately.</b> The only caller is the
 * controller, so the method runs OUTSIDE any ambient transaction and opens its own — and it must:
 * the reply event, the status move and the seeded conversation are one atomic act, and a failure
 * has to roll all three back rather than leave a refuted row with no reply behind it. This is the
 * opposite situation from {@code ReflectionReplyRecorder}, which is called from INSIDE the chat
 * turn's transaction and therefore needs {@code REQUIRES_NEW} so its own failure cannot mark the
 * caller's transaction rollback-only (the S3 review finding). Should this service ever gain a
 * transactional caller that swallows its failure, it needs that same treatment.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionReplyService {

    /** Where the reply came from — chat prose is {@code ReflectionReplyRecorder.CHANNEL_CHAT}. */
    public static final String CHANNEL_CHIP = "chip";

    public static final String CHOICE_WATCH = "watch";
    public static final String CHOICE_REJECT = "reject";
    public static final String CHOICE_TALK = "talk";

    private static final Set<String> CHOICES = Set.of(CHOICE_WATCH, CHOICE_REJECT, CHOICE_TALK);

    /** The contract caps the free text at 500; the event payload is not a place for an essay. */
    private static final int MAX_TEXT_CHARS = 500;

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    /** S4: one shared way to append a pattern event — see PatternEventAppender. */
    private final PatternEventAppender patternEventAppender;
    private final ConversationService conversationService;
    private final CompanionMapper mapper;
    private final PatternTestPlanMapper testPlanMapper;
    private final ReflectionProperties properties;

    @Transactional
    public PatternReplyResponse reply(UUID userId, UUID patternId, String choice, String text) {
        // 404 for missing, foreign OR statistical — the house idiom, plus the S4 review finding:
        // a `statistical` catalog row belongs to the nightly Pearson job and the Minták screen, so
        // a chip answer must never be able to move its status or rewrite its belief.
        PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .filter(PatternEntity::isReflectionOwned)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (choice == null || !CHOICES.contains(choice)) {
            // unreachable while the contract pattern holds — honest 400 if it ever drifts
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "choice").build());
        }

        patternEventAppender.append(userId, row.getId(), PatternEventEntity.KIND_USER_REPLY,
                PatternEventPayloadEnvelope.userReply(CHANNEL_CHIP, choice, truncate(text)));

        if (CHOICE_WATCH.equals(choice) && PatternEntity.STATUS_PROPOSED.equals(row.getStatus())) {
            row.setStatus(PatternEntity.STATUS_MONITORING);
            patternEventAppender.append(userId, row.getId(), PatternEventEntity.KIND_MONITORING,
                    PatternEventPayloadEnvelope.empty());
        }

        // ONE pass over the row's event stream feeds both buckets — it used to be loaded twice
        List<String> choices = replyChoices(userId, row.getId());
        int positive = tally(choices, HypothesisLifecycle.POSITIVE_CHOICES);
        int negative = tally(choices, HypothesisLifecycle.NEGATIVE_CHOICES);
        if (CHOICE_REJECT.equals(choice)
                && negative >= HypothesisLifecycle.NEGATIVE_REPLIES_TO_REFUTE
                && !PatternEntity.isUserFrozen(row.getStatus())) {
            // the user's second "nem stimmel" is a verdict — the same rule the nightly pass reads
            row.setStatus(PatternEntity.STATUS_REFUTED);
            patternEventAppender.append(userId, row.getId(), PatternEventEntity.KIND_REFUTED,
                    PatternEventPayloadEnvelope.empty());
        }
        row.setBelief(belief(userId, row, positive, negative));

        PatternEntity saved = patternRepository.saveAndFlush(row);
        UUID conversationId = CHOICE_TALK.equals(choice) ? openThread(userId, saved) : null;
        return PatternReplyResponse.builder()
                .pattern(mapper.toPatternResponse(saved, null, testPlanMapper.toWire(saved.getTestPlan())))
                .conversationId(conversationId)
                .build();
    }

    /** „Beszéljünk róla” — a thread SEEDED with the row, so everything typed there is evidence
     *  about it ({@code ReflectionReplyRecorder} picks the first turn up). */
    private UUID openThread(UUID userId, PatternEntity row) {
        return conversationService
                .create(userId, CreateConversationRequest.builder().seedPatternId(row.getId()).build())
                .getId();
    }

    /** The gate half of belief comes from the row's LAST evidence night — the freshest statistic
     *  the engine actually measured; a row that was never evaluated has none, and 0 is honest. */
    private BigDecimal belief(UUID userId, PatternEntity row, int positive, int negative) {
        PatternEventPayloadEnvelope evidence = patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, row.getId(), PatternEventEntity.KIND_EVIDENCE)
                .map(PatternEventEntity::getPayload)
                .orElse(null);
        double value = HypothesisLifecycle.belief(
                evidence == null ? null : evidence.r(),
                evidence == null ? null : evidence.p(),
                positive, negative, row.getEvidenceHits(), row.getEvidenceMisses(),
                properties.lifecycle());
        return BigDecimal.valueOf(value).setScale(3, RoundingMode.HALF_UP);
    }

    /** Every chip/chat choice the row has ever carried — the same stream the nightly
     *  {@code HypothesisEvaluationService} reads, loaded ONCE and bucketed by {@link #tally}. */
    private List<String> replyChoices(UUID userId, UUID patternId) {
        return patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(userId, patternId)
                .stream()
                .filter(e -> PatternEventEntity.KIND_USER_REPLY.equals(e.getKind()))
                .map(e -> e.getPayload().choice())
                .filter(Objects::nonNull)
                .toList();
    }

    private static int tally(List<String> choices, Set<String> bucket) {
        return (int) choices.stream().filter(bucket::contains).count();
    }

    private static String truncate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return text.length() <= MAX_TEXT_CHARS ? text : text.substring(0, MAX_TEXT_CHARS);
    }
}
