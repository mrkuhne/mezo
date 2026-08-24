package io.mrkuhne.mezo.feature.companion.profile.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * W4.3 review fix (mezo-b3pp.17): direct, Spring-free unit coverage for {@link
 * ProfileAssembler#cap} — the {@code ProfileAssemblerIT} cap assertion only proves the STORED
 * summary's length stays under budget, which the fake's fixed ~130-char profile answer satisfies
 * trivially even with {@code cap} deleted. These tests instead pin the three cases that
 * actually exercise the method: text already under the budget, the exact boundary, and text with
 * no space to cut on (the hard-cut fallback branch).
 */
class ProfileAssemblerCapTest {

    @Test
    void text_shorter_than_the_cap_is_returned_unchanged() {
        String text = "Rövid mondat.";

        assertThat(ProfileAssembler.cap(text, 400)).isEqualTo(text);
    }

    @Test
    void text_exactly_at_the_cap_boundary_is_returned_unchanged() {
        // maxTokens=10 -> maxChars=30 (CHARS_PER_TOKEN=3); length == maxChars must NOT trigger a cut.
        String text = "a".repeat(30);

        assertThat(ProfileAssembler.cap(text, 10)).isEqualTo(text);
    }

    @Test
    void text_with_no_spaces_over_the_cap_is_hard_cut_with_an_ellipsis() {
        // maxTokens=10 -> maxChars=30; no space anywhere, so the word-boundary branch can't fire
        // and the method must fall back to a hard cut at maxChars-1 plus the ellipsis.
        String text = "a".repeat(50);

        String capped = ProfileAssembler.cap(text, 10);

        assertThat(capped).isEqualTo("a".repeat(29) + "…");
    }
}
