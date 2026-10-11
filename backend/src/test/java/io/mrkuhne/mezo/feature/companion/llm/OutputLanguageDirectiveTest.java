package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

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
    void testApply_shouldBeSafe_whenLanguageOrPromptIsNull() {
        assertThat(OutputLanguageDirective.apply(P, null, "x")).isSameAs(P);
        assertThat(OutputLanguageDirective.apply(P, "xx", "x")).isSameAs(P);
        assertThat(OutputLanguageDirective.apply(null, "en", "x")).isNull();
    }
}
