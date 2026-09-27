package io.mrkuhne.mezo.feature.character.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.chat.TeamChatExceptionMatcher;
import java.util.List;
import org.junit.jupiter.api.Test;

class TeamChatExceptionMatcherTest {
    @Test void normalize_lowercasesFoldsAccentsAndCollapses() {
        assertThat(TeamChatExceptionMatcher.normalize("  Meccs-Nap! ")).isEqualTo("meccs nap");
        assertThat(TeamChatExceptionMatcher.normalize("Röplabda kupa")).isEqualTo("roplabda kupa");
    }
    @Test void cleanKeywords_trimsFiltersDedupesCaps() {
        assertThat(TeamChatExceptionMatcher.cleanKeywords(List.of("Meccs", "meccs", "x", "kupa", "a".repeat(30),
                "r01", "r02", "r03", "r04", "r05"))).containsExactly("meccs", "kupa", "r01", "r02", "r03", "r04");
    }
    @Test void cleanKeywords_dropsTwoLetterKeywords_keepsThree() {
        // A 2-letter substring ("ut", "ed") matches nearly any day's notes and would silence the rule.
        assertThat(TeamChatExceptionMatcher.cleanKeywords(List.of("ut", " Ed ", "edz", "út")))
                .containsExactly("edz");
    }
    @Test void matches_isAccentFoldedCaseInsensitiveSubstring() {
        assertThat(TeamChatExceptionMatcher.matches(List.of("röpi"), List.of("Ma RÖPI-kupa volt este"))).isTrue();
        assertThat(TeamChatExceptionMatcher.matches(List.of("ropi"), List.of("röpimeccs"))).isTrue();
        assertThat(TeamChatExceptionMatcher.matches(List.of("meccs"), List.of("nyugis nap"))).isFalse();
        assertThat(TeamChatExceptionMatcher.matches(List.of(), List.of("meccs"))).isFalse();
    }
}
