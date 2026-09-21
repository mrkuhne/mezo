package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterReplyEvaluation;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("companion-fake")
@Transactional
class CharacterReplyDiscussionIT extends AbstractIntegrationTest {
    @Autowired private CharacterReplyEvaluation evaluation;
    @Autowired private CharacterReplyPopulator replies;
    @Autowired private DatabasePopulator users;
    @Autowired private FakeCompanionLlm model;

    @Test
    void testEvaluate_shouldUseTwoActualExpertsBeforeMezo_whenUserReplies() {
        var owner = users.populateUser("reply-discussion@test.local");
        var claim = replies.claim(owner);
        var reply = replies.savedReply(owner, claim, "Csak kedden szoktam reggel edzeni.");
        int before = model.completeCallCount();
        var result = evaluation.evaluate(reply);
        assertThat(result.discussion().comments()).hasSize(2);
        assertThat(result.discussion().comments()).extracting(comment -> comment.expertKey())
                .containsExactly("drill", "antropologus");
        assertThat(result.discussion().comments().getLast().replyToExpert()).isEqualTo("drill");
        assertThat(model.completeCallCount() - before).isEqualTo(3);
        assertThat(model.lastUserMessage()).contains("discussion", "targetDimensionKey", "discipline");
        assertThat(result.expectedClaimText()).isEqualTo(claim.getText());
    }

    @Test
    void testEvaluate_shouldNotInventComments_whenExpertAnswerIsInvalid() {
        var owner = users.populateUser("reply-discussion-invalid@test.local");
        var reply = replies.savedReply(owner, replies.claim(owner), "[fake-reply-discussion-invalid]");
        var result = evaluation.evaluate(reply);
        assertThat(result.discussion().comments()).isEmpty();
        assertThat(result.verdict()).isNotNull();
    }
}
