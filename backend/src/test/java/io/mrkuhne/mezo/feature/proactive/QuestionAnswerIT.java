package io.mrkuhne.mezo.feature.proactive;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.service.MessageFeedbackService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.feature.proactive.service.QuestionAnswerService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §c): the 👍/👎 on a question card is an ANSWER. It becomes
 * exactly one {@code knowledge_fact} with the {@code question} source, it is rewritten in place when
 * the user flips it, and nothing else happens — no mutation, no second fact, no feature hidden.
 */
class QuestionAnswerIT extends AbstractIntegrationTest {

    @Autowired private QuestionAnswerService questionAnswerService;
    @Autowired private MessageFeedbackService messageFeedbackService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRecord_shouldRememberTheUpAnswer() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card =
            questionCard(owner, OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT);

        Optional<KnowledgeFactEntity> fact = questionAnswerService.record(
            owner, card.getId(), MessageFeedbackEntity.VERDICT_UP);

        assertThat(fact).isPresent();
        assertThat(fact.orElseThrow().getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_QUESTION);
        assertThat(fact.orElseThrow().getCategory()).isEqualTo("life");
        assertThat(fact.orElseThrow().getFactText()).contains("TUDATOSAN");
        assertThat(fact.orElseThrow().isIncludeInPrompt()).isTrue();
    }

    /** A flip rewrites the SAME fact — the user has one opinion, not a history of them. */
    @Test
    void testRecord_shouldRewriteTheSameFact_whenTheAnswerFlips() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card =
            questionCard(owner, OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT);

        UUID first = questionAnswerService
            .record(owner, card.getId(), MessageFeedbackEntity.VERDICT_UP).orElseThrow().getId();
        UUID second = questionAnswerService
            .record(owner, card.getId(), MessageFeedbackEntity.VERDICT_DOWN).orElseThrow().getId();

        assertThat(second).isEqualTo(first);
        List<KnowledgeFactEntity> facts = knowledgeFactRepository
            .findByCreatedByAndSourceAndDeletedFalse(owner, KnowledgeFactEntity.SOURCE_QUESTION);
        assertThat(facts).hasSize(1);
        assertThat(facts.get(0).getFactText()).contains("kikoptak");
    }

    /** An ordinary advice card's „Segített?" verdict is NOT an answer and must mint no fact. */
    @Test
    void testRecord_shouldDoNothing_forANonQuestionCard() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card = companionMessagePopulator.createAdvice(owner, LocalDate.now(),
            "sleep_debt", "sleep_recover_tonight", "Mezo · észrevétel", "…", List.of(),
            List.of("…"), Instant.now());

        assertThat(questionAnswerService.record(owner, card.getId(),
            MessageFeedbackEntity.VERDICT_UP)).isEmpty();
        assertThat(knowledgeFactRepository.findByCreatedByAndSourceAndDeletedFalse(
            owner, KnowledgeFactEntity.SOURCE_QUESTION)).isEmpty();
    }

    /** The wiring: a real feedback write reaches the listener (async hop, Awaitility). */
    @Test
    void testPutFeedback_shouldMintTheFactThroughTheListener() {
        UUID owner = userPopulator.createUser().getId();
        CompanionMessageEntity card =
            questionCard(owner, OneTimeQuestionService.QUESTION_FLAT_FEEDBACK);

        messageFeedbackService.put(owner, PutFeedbackRequest.builder()
            .artifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE)
            .artifactId(card.getId())
            .verdict(MessageFeedbackEntity.VERDICT_UP)
            .build());

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(knowledgeFactRepository
            .findByCreatedByAndSourceAndDeletedFalse(owner, KnowledgeFactEntity.SOURCE_QUESTION))
            .singleElement()
            .satisfies(fact -> assertThat(fact.getCategory()).isEqualTo("train")));
    }

    private CompanionMessageEntity questionCard(UUID owner, String questionKey) {
        return companionMessagePopulator.createQuestion(owner, LocalDate.now(), questionKey,
            OneTimeQuestionService.EYEBROW, "Kérdés?", List.of("tény"),
            List.of("👍 — igen", "👎 — nem"), Instant.now());
    }
}
