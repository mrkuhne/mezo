package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.service.ActivityClassifier;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** AI classification against the companion-fake: sentinel-scripted answers, defensive parsing. */
@ActiveProfiles("companion-fake")
class ActivityClassifierIT extends AbstractIntegrationTest {

    @Autowired private ActivityClassifier classifier;

    @Test
    void testClassify_shouldParseScriptedAnswer_whenSentinelPlanted() {
        var result = classifier.classify(
            "Olvastam 30 percet [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.92,"
                + "\"xpSuggestion\":18,\"durationMin\":30,\"amountHuf\":null}]");

        assertThat(result).isPresent();
        assertThat(result.get().skillKey()).isEqualTo("learning");
        assertThat(result.get().confidence()).isEqualByComparingTo("0.92");
        assertThat(result.get().xpSuggestion()).isEqualTo(18);
        assertThat(result.get().durationMin()).isEqualTo(30);
    }

    @Test
    void testClassify_shouldNullSkill_whenUnknownKeyScripted() {
        var result = classifier.classify(
            "X [fake-activity:{\"skillKey\":\"hacking\",\"confidence\":0.95,\"xpSuggestion\":20}]");

        assertThat(result).isPresent();
        assertThat(result.get().skillKey()).isNull(); // unknown key → uncategorized, never a bad row
    }

    @Test
    void testClassify_shouldReturnEmpty_whenLlmFails() {
        assertThat(classifier.classify("Valami [fake-fail]")).isEmpty();
    }

    @Test
    void testClassify_shouldReturnEmpty_whenAnswerIsNotJson() {
        assertThat(classifier.classify("Valami [fake-activity:ez nem json]")).isEmpty();
    }
}
