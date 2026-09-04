package io.mrkuhne.mezo.feature.companion.memory.service;

import static io.mrkuhne.mezo.feature.companion.CompanionLlm.Role.USER;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.CONTEXT_DEPENDENT;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.NO_MEMORY_NEEDED;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.SELF_CONTAINED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class MemoryQueryAnalyzerTest {

    private static final List<Turn> USABLE_HISTORY = List.of(new Turn(USER, "Korábbi kérdés"));
    private static final Set<String> EXPECTED_NO_MEMORY_PHRASES = Set.of(
            "szia", "hello", "jo reggelt", "jo estet",
            "koszonom", "koszi", "kosz", "rendben", "ok", "oksa",
            "ki vagy", "mit tudsz", "hogyan mukodsz", "altalanos kerdesem van");
    private static final Set<String> EXPECTED_REFERENTIAL_MARKERS = Set.of(
            "elotte", "utana", "akkor", "arrol", "azzal", "ehhez", "vele", "o", "az");
    private static final Set<String> EXPECTED_LEADING_CONTINUATIONS = Set.of("es", "de", "viszont");

    private final MemoryQueryAnalyzer analyzer = new MemoryQueryAnalyzer();

    static Stream<Arguments> modes() {
        return Stream.of(
                arguments("köszönöm", NO_MEMORY_NEEDED),
                arguments("szia", NO_MEMORY_NEEDED),
                arguments("Mikor futottam utoljára 10 kilométert?", SELF_CONTAINED),
                arguments("Miért volt gyenge a keddi futásom?", SELF_CONTAINED),
                arguments("És előtte hogy aludtam?", CONTEXT_DEPENDENT),
                arguments("Mi történt utána?", CONTEXT_DEPENDENT));
    }

    @ParameterizedTest
    @MethodSource("modes")
    void testAnalyze_shouldChooseConservativeMode_whenHungarianQueryGiven(
            String query, QueryMode expectedMode) {
        var result = analyzer.analyze(query, USABLE_HISTORY);

        assertThat(result.mode()).isEqualTo(expectedMode);
    }

    @Test
    void testRoutingSets_shouldRemainClosedAndExplicit() {
        assertThat(MemoryQueryAnalyzer.NO_MEMORY_PHRASES).isEqualTo(EXPECTED_NO_MEMORY_PHRASES);
        assertThat(MemoryQueryAnalyzer.REFERENTIAL_MARKERS).isEqualTo(EXPECTED_REFERENTIAL_MARKERS);
        assertThat(MemoryQueryAnalyzer.LEADING_CONTINUATIONS).isEqualTo(EXPECTED_LEADING_CONTINUATIONS);
    }

    @ParameterizedTest
    @MethodSource("noMemoryPhrases")
    void testAnalyze_shouldSkipMemory_forEveryClosedNoMemoryPhrase(String phrase) {
        assertThat(analyzer.analyze(phrase, USABLE_HISTORY).mode()).isEqualTo(NO_MEMORY_NEEDED);
    }

    static Stream<String> noMemoryPhrases() {
        return EXPECTED_NO_MEMORY_PHRASES.stream();
    }

    @ParameterizedTest
    @MethodSource("referentialMarkers")
    void testAnalyze_shouldRequireContext_forEveryReferentialMarker(String marker) {
        assertThat(analyzer.analyze("Kérdésem " + marker + " kapcsolatban?", USABLE_HISTORY).mode())
                .isEqualTo(CONTEXT_DEPENDENT);
    }

    static Stream<String> referentialMarkers() {
        return EXPECTED_REFERENTIAL_MARKERS.stream();
    }

    @ParameterizedTest
    @MethodSource("leadingContinuations")
    void testAnalyze_shouldRequireContext_forEveryLeadingContinuation(String continuation) {
        assertThat(analyzer.analyze(continuation + " mi történt?", USABLE_HISTORY).mode())
                .isEqualTo(CONTEXT_DEPENDENT);
    }

    static Stream<String> leadingContinuations() {
        return EXPECTED_LEADING_CONTINUATIONS.stream();
    }

    @Test
    void testAnalyze_shouldDowngradeToSelfContained_whenReferentialQueryHasOnlyBlankHistory() {
        var result = analyzer.analyze("És előtte hogy aludtam?", List.of(new Turn(USER, "   ")));

        assertThat(result.mode()).isEqualTo(SELF_CONTAINED);
    }

    @Test
    void testAnalyze_shouldUseStrictContextLengthBoundary() {
        assertThat(analyzer.analyze(contextualQueryOfLength(159), USABLE_HISTORY).mode())
                .isEqualTo(CONTEXT_DEPENDENT);
        assertThat(analyzer.analyze(contextualQueryOfLength(160), USABLE_HISTORY).mode())
                .isEqualTo(SELF_CONTAINED);
    }

    @Test
    void testAnalyze_shouldExtractIsoDateRange_withoutRewriting() {
        var result = analyzer.analyze(
                "Mi történt 2026-08-12 és 2026-08-15 között?",
                USABLE_HISTORY);

        assertThat(result.mode()).isEqualTo(SELF_CONTAINED);
        assertThat(result.from()).contains(LocalDate.of(2026, 8, 12));
        assertThat(result.to()).contains(LocalDate.of(2026, 8, 15));
        assertThat(result.rawQuery()).isEqualTo("Mi történt 2026-08-12 és 2026-08-15 között?");
        assertThat(result.denseQuery()).isEqualTo(result.rawQuery());
    }

    private static String contextualQueryOfLength(int length) {
        String prefix = "előtte ";
        return prefix + "x".repeat(length - prefix.length());
    }
}
