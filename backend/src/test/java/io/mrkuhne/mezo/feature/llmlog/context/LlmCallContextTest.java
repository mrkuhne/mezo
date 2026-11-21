package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LlmCallContextTest {

    @Test
    void keepsPayloadFalseForMailSlugs() {
        for (String slug : new String[] {LlmCallContext.FEATURE_MAIL_CLASSIFY, LlmCallContext.FEATURE_MAIL_SCORE,
                LlmCallContext.FEATURE_MAIL_SCREEN}) {
            assertThat(new LlmCallContext(slug, "x", null, null).keepsPayload()).as(slug).isFalse();
        }
        assertThat(LlmCallContext.FEATURE_MAIL_CLASSIFY).isEqualTo("mail_classify");
        assertThat(LlmCallContext.FEATURE_MAIL_SCORE).isEqualTo("mail_score");
        assertThat(LlmCallContext.FEATURE_MAIL_SCREEN).isEqualTo("mail_screen");
    }

    @Test
    void keepsPayloadStaysTrueForOrdinaryFeatures() {
        assertThat(new LlmCallContext("companion_chat", null, null, null).keepsPayload()).isTrue();
        assertThat(new LlmCallContext(LlmCallContext.FEATURE_PENZ_SMS, null, null, null).keepsPayload()).isFalse();
    }
}
