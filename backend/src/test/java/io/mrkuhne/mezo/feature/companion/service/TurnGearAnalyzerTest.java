package io.mrkuhne.mezo.feature.companion.service;

import static io.mrkuhne.mezo.feature.companion.service.TurnGear.ANALYSIS;
import static io.mrkuhne.mezo.feature.companion.service.TurnGear.CHAT;
import static io.mrkuhne.mezo.feature.companion.service.TurnGear.LOOKUP;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class TurnGearAnalyzerTest {

    private final TurnGearAnalyzer analyzer = new TurnGearAnalyzer();

    static Stream<Arguments> classified() {
        return Stream.of(
            // No data reference at all -> pure conversation.
            arguments("Szia!", CHAT),
            arguments("Mit gondolsz a kreatinról?", CHAT),
            arguments("Seated Leg Curlnél pipál vagy spiccel a lábfej?", CHAT),
            // Domain word or time word + a "how much / when / what" shape -> simple lookup.
            arguments("Mennyit aludtam kedden?", LOOKUP),
            arguments("Mit ettem ma?", LOOKUP),
            arguments("Hány kiló voltam 2026-09-14-én?", LOOKUP),
            // Domain word + a "why / what changed / what should I" shape -> analysis.
            arguments("Miért vagyok fáradt mostanában?", ANALYSIS),
            arguments("Mi változott az alvásomban a múlt héthez képest?", ANALYSIS),
            arguments("Mit csináljak a súlyommal?", ANALYSIS));
    }

    @ParameterizedTest
    @MethodSource("classified")
    void testAnalyze_shouldClassify_whenSignalsAreUnambiguous(String message, TurnGear expected) {
        assertThat(analyzer.analyze(message)).contains(expected);
    }

    @Test
    void testAnalyze_shouldReturnAnalysis_whenUserAsksForADeeperLook() {
        assertThat(analyzer.analyze("Nézd meg alaposabban")).contains(ANALYSIS);
        assertThat(analyzer.analyze("Gondold át még egyszer")).contains(ANALYSIS);
    }

    @Test
    void testAnalyze_shouldBeUnsure_whenADomainWordCarriesNoQuestionShape() {
        // "alvás" is a domain word but there is no how-much and no why - the rules cannot tell
        // a lookup from an analysis, so the cheap classifier decides (Task 2).
        assertThat(analyzer.analyze("Az alvás.")).isEmpty();
    }

    @Test
    void testAnalyze_shouldBeCaseAndAccentInsensitive_whenMessageIsShouted() {
        assertThat(analyzer.analyze("MENNYIT ALUDTAM KEDDEN?")).contains(LOOKUP);
    }

    @Test
    void testAnalyze_shouldReturnChat_whenMessageIsNullOrBlank() {
        assertThat(analyzer.analyze(null)).contains(CHAT);
        assertThat(analyzer.analyze("   ")).contains(CHAT);
    }
}
