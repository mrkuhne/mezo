package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternCritiqueEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService.GroundedCandidate;
import io.mrkuhne.mezo.feature.companion.service.PatternEventAppender;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Atomic candidate storage and inbox publication; deliberately never sends push notifications. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class GroundedHypothesisPublisher {
    private final PatternRepository patterns;
    private final PatternEventRepository events;
    private final PatternEventAppender appender;
    private final TestPlanValidator validator;
    private final ObservationBudget budget;
    private final ObservationOwnerLock ownerLock;
    private final ObservationContextService sources;

    private static PatternEventPayloadEnvelope groundedObservation(String text, List<String> evidenceRefs, boolean surfaced) {
        return new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, "grounded", null, text, evidenceRefs, surfaced);
    }

    @Transactional
    public boolean publish(UUID owner, GroundedCandidate candidate) {
        ownerLock.lock(owner);
        if (!owner.equals(candidate.userId()) || candidate.evidence().isEmpty()
                || !candidate.evidence().keySet().stream().allMatch(ref -> sources.exists(owner, ref))) return false;
        var h = candidate.hypothesis();
        var c = candidate.critique();
        PatternEntity revised = null;
        var plan = validator.validate(owner, h.testPlan());
        if (h.revisesHypothesisKey() != null && !h.revisesHypothesisKey().isBlank()) {
            revised = patterns.findByCreatedByAndHypothesisKeyAndDeletedFalse(owner, h.revisesHypothesisKey().trim())
                    .filter(PatternEntity::isReflectionOwned)
                    .filter(p -> Set.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING).contains(p.getStatus()))
                    .orElse(null);
            plan = validator.validate(owner, h.revisedTestPlan());
            if (revised == null || plan.isEmpty() || TestPlanEnvelope.key(plan.get()).equals(revised.getHypothesisKey())) return false;
        }
        final UUID revisedId = revised == null ? null : revised.getId();
        String normalizedTopic = Arrays.stream(h.topicKey().trim().toLowerCase(Locale.ROOT)
                        .split("[^\\p{L}\\p{N}]+"))
                .filter(token -> !token.isBlank()).distinct().sorted().collect(Collectors.joining("-"));
        String topic = "observation-topic:" + HypothesisPipelineService.hypothesisKey(normalizedTopic);
        String topicLabel = "observation-topic-key:" + normalizedTopic;
        String key = plan.map(TestPlanEnvelope::key).orElseGet(() -> HypothesisPipelineService.hypothesisKey(normalizedTopic));
        var existing = patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).stream()
                .filter(PatternEntity::isReflectionOwned)
                .filter(p -> !p.getId().equals(revisedId))
                .filter(p -> key.equals(p.getPairKey()) || key.equals(p.getHypothesisKey())
                        || p.getEvidence() != null && p.getEvidence().items().contains(topic))
                .findFirst();
        if (existing.isPresent() && !Set.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING)
                .contains(existing.get().getStatus())) {
            log.info("Grounded hypothesis kept closed for owner {} topic {}", owner, topic);
            return false;
        }
        PatternEntity row = existing.orElseGet(PatternEntity::new);
        List<String> previous = row.getEvidence() == null ? List.of() : row.getEvidence().items();
        boolean newEvidence = !previous.containsAll(candidate.evidence().keySet());
        if (existing.isPresent() && !newEvidence) return false;
        String title = h.title().length() > 200 ? h.title().substring(0, 200) : h.title();
        if (existing.isEmpty()) {
            row.setCreatedBy(owner);
            row.setKind(plan.isPresent() ? PatternEntity.KIND_REFLECTION : PatternEntity.KIND_AI_HYPOTHESIS);
            row.setPairKey(key);
            row.setHypothesisKey(key);
            plan.ifPresent(row::setTestPlan);
            row.setOrigin(PatternEntity.ORIGIN_NIGHTLY_REFLECTION);
            row.setCategory(h.category());
            row.setCategoryLabel(switch (h.category()) {
                case "physiology" -> "Fiziológia";
                case "trigger" -> "Trigger";
                default -> "Response";
            });
            row.setStatus(PatternEntity.STATUS_PROPOSED);
        }
        row.setTitle(title);
        row.setMechanism(h.mechanism());
        // Keep the thread's still-live provenance. A deleted old source must not hide the newly
        // grounded card, and source dates remain in the event's human-readable evidence labels.
        var provenance = new ArrayList<>(previous.stream()
                .filter(ref -> !ref.matches("[a-z_]+:[0-9a-fA-F-]{36}") || sources.exists(owner, ref))
                .toList());
        if (!provenance.contains(topic)) provenance.add(topic);
        if (!provenance.contains(topicLabel)) provenance.add(topicLabel);
        candidate.evidence().keySet().forEach(ref -> { if (!provenance.contains(ref)) provenance.add(ref); });
        row.setEvidence(new PatternEvidenceEnvelope(List.copyOf(provenance)));
        row.setConfidence(BigDecimal.valueOf(candidate.score()).setScale(3, RoundingMode.HALF_UP));
        row.setCritique(new PatternCritiqueEnvelope(c.statistical(), c.confounders(), c.l3align(), c.actionability(), c.reasoning()));
        row.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        patterns.saveAndFlush(row);
        if (revisedId != null && existing.isEmpty()) {
            appender.append(owner, revisedId, PatternEventEntity.KIND_REVISED,
                    PatternEventPayloadEnvelope.revised(title));
        }
        var newest = events.findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                owner, row.getId(), PatternEventEntity.KIND_OBSERVATION);
        var reply = events.findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                owner, row.getId(), PatternEventEntity.KIND_USER_REPLY);
        String text = h.observation().trim() + "\n\n" + h.question().trim();
        // Each event owns its provenance snapshot: the row may later replace/prune sources,
        // but historical cards must still be checked against the sources they actually quoted.
        List<String> evidence = h.evidenceRefs().stream().distinct()
                .flatMap(ref -> java.util.stream.Stream.of(ref, candidate.evidence().get(ref))).toList();
        if (newest.isPresent() && (reply.isEmpty() || reply.get().getOccurredAt().isBefore(newest.get().getOccurredAt()))) {
            // Same unanswered card: enrich it without creating another event or spending another slot.
            var event = newest.get();
            event.setPayload(groundedObservation(text, evidence, Boolean.TRUE.equals(event.getPayload().surfaced())));
            events.saveAndFlush(event);
            log.info("Grounded hypothesis merged for owner {} topic {}", owner, topic);
            return false;
        }
        boolean surfaced = budget.remainingToday(owner, Instant.now()) > 0;
        appender.append(owner, row.getId(), PatternEventEntity.KIND_OBSERVATION,
                groundedObservation(text, evidence, surfaced));
        log.info("Grounded hypothesis {} for owner {} topic {}", surfaced ? "published" : "pending", owner, topic);
        return true;
    }
}
