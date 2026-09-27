package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyDecision;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyDraft;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatReplyDecision.Outcome;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TeamChatReplyDecisionTest {
    private static TeamChatReplyDraft concrete() {
        return new TeamChatReplyDraft("Értem, meccsnap volt.", true, "concrete_context", "meccsnap",
                "Meccsnapokon későn eszel — ez rendben van.", List.of("meccs"));
    }

    @Test void concreteOnOpenPlainThread_closesWithANewException() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, concrete(), false, false, null))
                .isEqualTo(Outcome.CLOSE_NEW_EXCEPTION);
    }
    @Test void concreteWithAnActiveSameTag_closesAsAHit() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, concrete(), true, false, null))
                .isEqualTo(Outcome.CLOSE_AS_HIT_ON_ACTIVE);
    }
    @Test void vetoedTag_onlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, concrete(), false, true, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
    }
    @ParameterizedTest @ValueSource(strings = {"mood", "disagreement", "question", "other"})
    void nonConcreteVerdicts_onlyAnswer(String verdict) {
        var d = new TeamChatReplyDraft("Értem.", true, verdict, "meccsnap", "x", List.of("meccs"));
        assertThat(TeamChatReplyDecision.decide("OPEN", null, d, false, false, null)).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void templateOrUnvoiced_neverCloses() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null, TeamChatReplyDraft.template("Láttam."), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
        var unvoiced = new TeamChatReplyDraft("x", false, "concrete_context", "meccsnap", "f", List.of("meccs"));
        assertThat(TeamChatReplyDecision.decide("OPEN", null, unvoiced, false, false, null)).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void missingTagFactOrKeywords_onlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("OPEN", null,
                new TeamChatReplyDraft("x", true, "concrete_context", " ", "f", List.of("meccs")), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
        assertThat(TeamChatReplyDecision.decide("OPEN", null,
                new TeamChatReplyDraft("x", true, "concrete_context", "meccsnap", null, List.of("meccs")), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
        assertThat(TeamChatReplyDecision.decide("OPEN", null,
                new TeamChatReplyDraft("x", true, "concrete_context", "meccsnap", "f", List.of()), false, false, null))
                .isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void tagThatNormalizesToEmpty_onlyAnswers() {
        // emoji / punctuation only: nothing to remember, and an empty normalized tag would be
        // shared (or vetoed) by every later empty tag.
        for (String tag : List.of("⚽🏆", "!!! …", "—")) {
            var d = new TeamChatReplyDraft("Értem.", true, "concrete_context", tag,
                    "Meccsnapokon későn eszel — ez rendben van.", List.of("meccs"));
            assertThat(TeamChatReplyDecision.decide("OPEN", null, d, false, false, null))
                    .as(tag).isEqualTo(Outcome.ANSWER_ONLY);
            assertThat(TeamChatReplyDecision.decide("OPEN", "EXCUSE", d, false, false, ""))
                    .as(tag + " on an EXCUSE offer").isEqualTo(Outcome.ANSWER_ONLY);
        }
    }
    @Test void alreadyResolvedThread_onlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("RESOLVED", null, concrete(), false, false, null)).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void excuseOffer_sameTagActsAsTheTap_otherTagOnlyAnswers() {
        assertThat(TeamChatReplyDecision.decide("OPEN", "EXCUSE", concrete(), true, false, "meccsnap"))
                .isEqualTo(Outcome.EXCUSE_TAP_EQUIVALENT);
        var other = new TeamChatReplyDraft("x", true, "concrete_context", "utazás", "f", List.of("utaz"));
        assertThat(TeamChatReplyDecision.decide("OPEN", "EXCUSE", other, false, false, "meccsnap")).isEqualTo(Outcome.ANSWER_ONLY);
    }
    @Test void reviewOffer_freeTextNeverDecides() {
        assertThat(TeamChatReplyDecision.decide("OPEN", "REVIEW", concrete(), true, false, "meccsnap")).isEqualTo(Outcome.ANSWER_ONLY);
    }
}
