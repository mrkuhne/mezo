package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * fix round 1 finding 3 — {@link ChatService#guardAgainstMarker} had zero coverage. Plain unit
 * test (no Spring context): the guard is {@code static} + package-private exactly so this class
 * can call it directly.
 */
class ChatServiceMarkerGuardTest {

    @Test
    void testGuardAgainstMarker_shouldReturnNull_whenAnswerIsExactlyTheMarker() {
        String answer = TurnAnswerer.DATA_GAP_MARKER + " alvásnapló]";

        assertThat(ChatService.guardAgainstMarker(answer)).isNull();
    }

    @Test
    void testGuardAgainstMarker_shouldReturnNull_whenTheMarkerHasSurroundingWhitespace() {
        String answer = "  \n" + TurnAnswerer.DATA_GAP_MARKER + " alvásnapló]\n  ";

        assertThat(ChatService.guardAgainstMarker(answer)).isNull();
    }

    @Test
    void testGuardAgainstMarker_shouldReturnTheAnswer_whenItIsNormalText() {
        String answer = "88,4 — a héten fél kilót lement, ami pont a tervezett ütem.";

        assertThat(ChatService.guardAgainstMarker(answer)).isEqualTo(answer);
    }

    @Test
    void testGuardAgainstMarker_shouldReturnTheAnswer_whenTheMarkerOnlyAppearsMidAnswer() {
        // dataGapReason only honors the marker at the START of the (trimmed) answer — a marker
        // appearing later is leaked prompt vocabulary, not a real data-gap request, and must pass
        // through unchanged rather than being treated as a pipeline failure.
        String answer = "Erről nincs elég adatom. " + TurnAnswerer.DATA_GAP_MARKER + " alvásnapló]";

        assertThat(ChatService.guardAgainstMarker(answer)).isEqualTo(answer);
    }
}
