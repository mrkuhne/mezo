package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.RecalledItem;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.Rendered;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The pure half of W3.1 ambient recall — rendering, the one-line gist, the token cap. No Spring. */
class PromptMemoryAssemblerTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 10);

    private static RecalledItem item(String kind, String content, double score) {
        return new RecalledItem(kind, UUID.randomUUID(), DAY, content, 0.9, score);
    }

    @Test
    void testRenderBlock_shouldRenderDateKindTagAndGist_whenItemsGiven() {
        Rendered rendered = PromptMemoryAssembler.renderBlock(List.of(
                item("journal_entry", "futás után jobban aludtam\nmásodik sor", 0.9),
                item("daily_summary", "Kemény nap volt.", 0.8)), 1200, 300);

        assertThat(rendered.block()).startsWith(PromptMemoryAssembler.MEMORIES_HEADER);
        assertThat(rendered.block()).contains("- 2026-08-10 (napló): futás után jobban aludtam\n");
        assertThat(rendered.block()).contains("- 2026-08-10 (napi összefoglaló): Kemény nap volt.\n");
        assertThat(rendered.block()).doesNotContain("második sor");
        assertThat(rendered.rendered()).hasSize(2);
    }

    @Test
    void testRenderBlock_shouldReturnEmpty_whenNoItems() {
        assertThat(PromptMemoryAssembler.renderBlock(List.of(), 1200, 300)).isSameAs(Rendered.EMPTY);
        assertThat(Rendered.EMPTY.block()).isEmpty();
    }

    @Test
    void testRenderBlock_shouldStopAtFirstOverflowingItem_whenBudgetTight() {
        String longText = "x".repeat(200);
        // header ≈ 100 chars; each line ≈ 230 chars → with a 120-token (360-char) budget only ONE line fits
        Rendered rendered = PromptMemoryAssembler.renderBlock(List.of(
                item("journal_entry", longText, 0.9),
                item("daily_summary", longText, 0.8),
                item("chat_turn", "rövid", 0.7)), 120, 300);

        assertThat(rendered.rendered()).hasSize(1);
        assertThat(rendered.rendered().getFirst().kind()).isEqualTo("journal_entry");
        // relevance order is sacred: the short third item must NOT sneak in past the overflowing second
        assertThat(rendered.block()).doesNotContain("rövid");
        assertThat(PromptMemoryAssembler.estimateTokens(rendered.block().length())).isLessThanOrEqualTo(120);
    }

    @Test
    void testRenderBlock_shouldReturnEmpty_whenEvenFirstItemOverflows() {
        Rendered rendered = PromptMemoryAssembler.renderBlock(
                List.of(item("journal_entry", "x".repeat(300), 0.9)), 100, 300);

        assertThat(rendered).isSameAs(Rendered.EMPTY);
    }

    @Test
    void testRenderBlock_shouldFallBackToRawKind_whenKindHasNoLabel() {
        Rendered rendered = PromptMemoryAssembler.renderBlock(
                List.of(item("monthly_summary", "havi", 0.9), item("mystery_kind", "x", 0.8)), 1200, 300);

        assertThat(rendered.block()).contains("(havi összefoglaló): havi");
        assertThat(rendered.block()).contains("(mystery_kind): x");
    }

    @Test
    void testOneLine_shouldTakeFirstLineAndTruncateWithEllipsis_whenLongMultiline() {
        assertThat(PromptMemoryAssembler.oneLine("  első sor  \nmásodik", 300)).isEqualTo("első sor");
        assertThat(PromptMemoryAssembler.oneLine("a".repeat(310), 300)).isEqualTo("a".repeat(300) + "…");
        assertThat(PromptMemoryAssembler.oneLine("Daniel: kérdés\nMezo: válasz", 300)).isEqualTo("Daniel: kérdés");
    }

    @Test
    void testEstimateTokens_shouldRoundUpAtThreeCharsPerToken_whenCalled() {
        assertThat(PromptMemoryAssembler.estimateTokens(0)).isZero();
        assertThat(PromptMemoryAssembler.estimateTokens(1)).isEqualTo(1);
        assertThat(PromptMemoryAssembler.estimateTokens(3)).isEqualTo(1);
        assertThat(PromptMemoryAssembler.estimateTokens(4)).isEqualTo(2);
    }
}
