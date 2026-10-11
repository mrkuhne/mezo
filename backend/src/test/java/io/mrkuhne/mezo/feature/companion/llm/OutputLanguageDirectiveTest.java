package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import java.util.List;
import org.junit.jupiter.api.Test;

class OutputLanguageDirectiveTest {

    private static final String P = "Te vagy Mezo. Válaszolj röviden.";

    @Test
    void testApply_shouldLeavePromptByteIdentical_whenLanguageIsHungarian() {
        assertThat(OutputLanguageDirective.apply(P, "hu", "companion_chat")).isSameAs(P);
    }

    @Test
    void testApply_shouldAppendAndNeverPrepend_whenLanguageIsEnglish() {
        String r = OutputLanguageDirective.apply(P, "en", "companion_chat");

        assertThat(r).startsWith(P);
        assertThat(r.length()).isGreaterThan(P.length());
        assertThat(r).endsWith(OutputLanguageDirective.EN);
    }

    @Test
    void testApply_shouldPinKeysEnumsAndUserWords_whenLanguageIsEnglish() {
        String r = OutputLanguageDirective.apply(P, "en", "companion_chat");

        assertThat(r).contains("English", "JSON keys", "enum values", "tool names", "exactly", "never translate",
            "Do not translate names");
    }

    @Test
    void testApply_shouldAddNothing_whenSlugIsExempt() {
        for (String slug : List.of("embed_memory", "companion_recall")) {
            assertThat(OutputLanguageDirective.apply(P, "en", slug)).isSameAs(P);
        }
    }

    @Test
    void testApply_shouldAddNothing_whenSlugIsTheAdminReplay() {
        assertThat(OutputLanguageDirective.apply(P, "en", "admin_replay")).isSameAs(P);
        assertThat(OutputLanguageDirective.apply(P, "en", LlmCallContext.FEATURE_ADMIN_REPLAY)).isSameAs(P);
    }

    @Test
    void testExemptSlugs_shouldBeTheSharedConstants_theCallSitesTagWith() {
        assertThat(OutputLanguageDirective.EXEMPT_SLUGS).containsExactlyInAnyOrder(
            LlmCallContext.FEATURE_EMBED_MEMORY, LlmCallContext.FEATURE_COMPANION_RECALL,
            LlmCallContext.FEATURE_ADMIN_REPLAY);
        // the wire values are stored in llm_log.feature and read by the cost reports: pinned
        assertThat(LlmCallContext.FEATURE_EMBED_MEMORY).isEqualTo("embed_memory");
        assertThat(LlmCallContext.FEATURE_COMPANION_RECALL).isEqualTo("companion_recall");
    }

    @Test
    void testApply_shouldAppendTheDirective_whenSlugIsNull() {
        assertThat(OutputLanguageDirective.apply(P, "en", null)).isEqualTo(P + OutputLanguageDirective.EN);
        assertThat(OutputLanguageDirective.apply(P, "hu", null)).isSameAs(P);
    }

    @Test
    void testApply_shouldBeSafe_whenLanguageOrPromptIsNull() {
        assertThat(OutputLanguageDirective.apply(P, null, "x")).isSameAs(P);
        assertThat(OutputLanguageDirective.apply(P, "xx", "x")).isSameAs(P);
        assertThat(OutputLanguageDirective.apply(null, "en", "x")).isNull();
    }
}
