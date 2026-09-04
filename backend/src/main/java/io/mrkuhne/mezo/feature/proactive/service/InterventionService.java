package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W5.2 delivery (bd mezo-b3pp.19, spec §9.2) — flag raise → the best-weighted library entry as a
 * {@code companion_message} feed card. PURE CODE: the text is config ({@code textHu}), never an
 * LLM call, so there is nothing to tag with LlmCallContextHolder.
 *
 * <p><b>Selection:</b> entries for the flag → drop keys used within their own cooldown-hours
 * (recent intervention cards' envelope keys) → pick the highest W4.2 effectiveness
 * ({@code feedback_rollup} scope {@code intervention:<key>}, up/total); a key with no votes yet
 * gets {@link #OPTIMISTIC_PRIOR} — the spec's "unseen entries get optimistic default", i.e. a new
 * entry is always tried before a proven-mediocre one. Ties keep config order (Stream.max keeps
 * the FIRST max under a strict comparator).
 *
 * <p><b>One card per day</b> is no longer enforced here: since S4 (mezo-d58h.4) the day gate and
 * the spec §4 severity order live in {@link AdviceCardService}, so a higher-severity raise later
 * in the day supersedes the card this method produced.
 *
 * <p>The push half is NOT here: {@code AnchorResolver} anchors on the card row and applies
 * quiet-hours deferral + the channel gate (feed = no push).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.INTERVENTION_SWITCH},
        havingValue = "true")
public class InterventionService {

    /** Unseen keys rank above ANY voted ratio (max real effectiveness is 1.0). Spec-mandated
     *  optimism, not a tunable: exploration must beat exploitation until a first vote lands. */
    static final double OPTIMISTIC_PRIOR = 1.5;

    public static final String EYEBROW = "Mezo · észrevétel";

    private final CompanionProperties companionProperties;
    private final FeedbackLearningProperties feedbackLearningProperties;
    private final FeedbackRollupRepository feedbackRollupRepository;
    private final CompanionMessageRepository companionMessageRepository;
    private final CompanionFlagLogRepository companionFlagLogRepository;
    private final AdviceCardService adviceCardService;

    /**
     * The eligible library entry with the best effectiveness becomes today's advice CANDIDATE;
     * {@link AdviceCardService} owns the day gate and the severity comparison from there (S4,
     * mezo-d58h.4). This method keeps exactly what is intervention-specific: the library filter,
     * the per-entry cooldown, and the effectiveness weighting. The same-day short-circuit this
     * method used to carry is GONE on purpose — a higher-severity flag raised later in the day
     * must be able to supersede the card, which it cannot do if delivery returns early here.
     */
    @Transactional
    public Optional<CompanionMessageEntity> deliverForFlag(UUID userId, String flagKey) {
        List<CompanionProperties.Intervention> candidates = companionProperties.interventions().stream()
            .filter(entry -> entry.flag().equals(flagKey))
            .filter(entry -> !inCooldown(userId, entry))
            .toList();
        if (candidates.isEmpty()) {
            log.info("Intervention for {} skipped for user {}: no eligible library entry", flagKey, userId);
            return Optional.empty();
        }
        // One DB read per distinct candidate key, up front — the comparator below then only reads
        // from this map, never the DB, so Stream.max never re-queries per comparison.
        Map<String, Double> effectivenessByKey = candidates.stream()
            .map(CompanionProperties.Intervention::key)
            .distinct()
            .collect(Collectors.toMap(key -> key, key -> effectiveness(userId, key),
                (a, b) -> a, LinkedHashMap::new));
        CompanionProperties.Intervention picked = candidates.stream()
            .max(Comparator.comparingDouble(entry -> effectivenessByKey.get(entry.key())))
            .orElseThrow();
        // The raise's OWN frozen payload — never a re-derivation of the rule (spec §5: facts are
        // rule-provided). A raise with no payload yields no facts, and the card still ships.
        FlagPayloadEnvelope payload = companionFlagLogRepository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(userId, flagKey)
            .map(CompanionFlagLogEntity::getPayload)
            .orElse(null);
        return adviceCardService.deliver(userId, AdviceCandidate.fromFlag(
            flagKey, picked.key(), EYEBROW,
            AdviceFactRenderer.render(flagKey, payload),
            List.of(picked.textHu()), picked.textHu()));
    }

    /** The same library ENTRY must not repeat inside its own cooldown window — envelope
     *  {@code interventionKey}s of recent cards, filtered in memory (single-user volumes, spec
     *  §12). Reads BOTH kinds: {@code advice} is what S4 writes, {@code intervention} is what rows
     *  written before S4 carry, and a cooldown that stopped seeing the older rows would let a
     *  just-delivered entry repeat the day after the deploy. */
    private boolean inCooldown(UUID userId, CompanionProperties.Intervention entry) {
        Instant since = Instant.now().minus(entry.cooldownHours(), ChronoUnit.HOURS);
        return Stream.of(CompanionMessageEntity.KIND_ADVICE, CompanionMessageEntity.KIND_INTERVENTION)
            .flatMap(kind -> companionMessageRepository
                .findByCreatedByAndKindAndGeneratedAtAfter(userId, kind, since).stream())
            .anyMatch(row -> entry.key().equals(row.getContent().interventionKey()));
    }

    private double effectiveness(UUID userId, String key) {
        return feedbackRollupRepository.findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(
                userId, FeedbackRollupEntity.SCOPE_INTERVENTION_PREFIX + key,
                feedbackLearningProperties.windowDays())
            .map(rollup -> {
                Integer total = rollup.getStats().total();
                Integer up = rollup.getStats().up();
                return (total == null || total == 0 || up == null)
                    ? OPTIMISTIC_PRIOR : up / (double) total;
            })
            .orElse(OPTIMISTIC_PRIOR);
    }
}
