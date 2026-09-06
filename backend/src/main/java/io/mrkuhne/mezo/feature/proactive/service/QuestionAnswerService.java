package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The whole consequence of answering a once-ever question (round 2 S5, bd mezo-d58h.7.5, spec §c):
 * ONE {@code knowledge_fact} row. No mutation, no feature hidden, no rule input changed — the spec
 * decided that deliberately, and this class is where the restraint is kept.
 *
 * <p><b>A flip rewrites the fact in place.</b> The user has one opinion about a question, not a
 * history of them; a second row would let the top-N prompt injection carry both answers at once. The
 * existing row is found by TEXT — {@code knowledge_fact} has no question-key column, and the two
 * texts a given question can produce are a closed set
 * ({@link OneTimeQuestionService#allAnswerFacts}) — so no schema change is needed for what is, at
 * most, two rows per user for the app's entire life.
 *
 * <p><b>Not every verdict is an answer.</b> A card whose {@code setupKey} is not a question key is an
 * ordinary „Segített?" rating and is ignored here (and excluded from the effectiveness rollups on the
 * other side — {@code FeedMessageKindService.answerArtifactIds}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class QuestionAnswerService {

    private final CompanionMessageRepository companionMessageRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final OneTimeQuestionService oneTimeQuestionService;

    /** The fact this answer left behind, or empty when the verdict was not an answer at all. */
    @Transactional
    public Optional<KnowledgeFactEntity> record(UUID userId, UUID artifactId, String verdict) {
        Optional<CompanionMessageEntity> card =
            companionMessageRepository.findByIdAndCreatedBy(artifactId, userId);
        if (card.isEmpty()) {
            return Optional.empty();
        }
        String questionKey = card.get().getContent().setupKey();
        Optional<String> factText = questionKey == null
            ? Optional.empty()
            : oneTimeQuestionService.answerFact(questionKey, verdict);
        if (factText.isEmpty()) {
            return Optional.empty();
        }
        List<String> possible = oneTimeQuestionService.allAnswerFacts(questionKey);
        KnowledgeFactEntity fact = knowledgeFactRepository
            .findByCreatedByAndSourceAndDeletedFalse(userId, KnowledgeFactEntity.SOURCE_QUESTION)
            .stream()
            .filter(row -> possible.contains(row.getFactText()))
            .findFirst()
            .orElseGet(() -> {
                KnowledgeFactEntity fresh = new KnowledgeFactEntity();
                fresh.setCreatedBy(userId);
                fresh.setSource(KnowledgeFactEntity.SOURCE_QUESTION);
                fresh.setCategory(OneTimeQuestionService.categoryOf(questionKey));
                return fresh;
            });
        fact.setFactText(factText.get());
        fact.setLastReinforcedAt(Instant.now());
        KnowledgeFactEntity saved = knowledgeFactRepository.saveAndFlush(fact);
        log.info("Question {} answered ({}) by user {} — remembered as one fact",
            questionKey, verdict, userId);
        return Optional.of(saved);
    }
}
