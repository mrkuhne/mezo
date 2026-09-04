package io.mrkuhne.mezo.feature.companion.memory;

import static io.mrkuhne.mezo.feature.companion.CompanionLlm.Role.ASSISTANT;
import static io.mrkuhne.mezo.feature.companion.CompanionLlm.Role.USER;
import static io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy.CHAT_AMBIENT;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.CONTEXT_DEPENDENT;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.NO_MEMORY_NEEDED;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.SELF_CONTAINED;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryQueryPreparer;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class MemoryQueryPreparerIT extends AbstractIntegrationTest {

    @Autowired private MemoryQueryPreparer preparer;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    @Test
    void testPrepare_shouldReturnScriptedStandaloneQuery_whenContextDependsOnHistory() {
        String raw = "És előtte hogy aludtam? [fake-memory-rewrite:A keddi futás előtt hogyan aludtam?]";

        var result = preparer.prepare(request(raw, List.of(new Turn(USER, "Kedden gyenge volt a futásom."))));

        assertThat(result.mode()).isEqualTo(CONTEXT_DEPENDENT);
        assertThat(result.rawQuery()).isEqualTo(raw);
        assertThat(result.denseQuery()).isEqualTo("A keddi futás előtt hogyan aludtam?");
    }

    @Test
    void testPrepare_shouldPassLatestSixCappedNonblankTurns_whenRewriting() {
        List<Turn> history = new ArrayList<>(List.of(
                new Turn(USER, "DROP-1"),
                new Turn(ASSISTANT, "DROP-2"),
                new Turn(USER, "keep-1"),
                new Turn(ASSISTANT, "keep-2"),
                new Turn(USER, "keep-3"),
                new Turn(ASSISTANT, "keep-4"),
                new Turn(USER, "keep-5"),
                new Turn(ASSISTANT, "x".repeat(600))));
        history.add(3, new Turn(USER, "   "));

        preparer.prepare(request(
                "És előtte? [fake-memory-rewrite:Önálló keresőkérdés]", history));

        assertThat(fakeCompanionLlm.lastMemoryRewriteHistory())
                .extracting(Turn::content)
                .containsExactly("keep-1", "keep-2", "keep-3", "keep-4", "keep-5", "x".repeat(500));
    }

    @Test
    void testPrepare_shouldAcceptRewriteAtExactLengthLimit() {
        var result = preparer.prepare(request(
                "És előtte? [fake-memory-rewrite-exact-limit]",
                List.of(new Turn(USER, "Kedden futottam."))));

        assertThat(result.denseQuery()).isEqualTo("x".repeat(500));
    }

    static Stream<String> fallbackQueries() {
        return Stream.of(
                "És előtte hogy aludtam? [fake-fail]",
                "És előtte hogy aludtam? [fake-memory-rewrite:]",
                "És előtte hogy aludtam? [fake-memory-rewrite-overlong]");
    }

    @ParameterizedTest
    @MethodSource("fallbackQueries")
    void testPrepare_shouldFallBackToRawQuery_whenRewriteIsUnusable(String raw) {
        var result = preparer.prepare(request(raw, List.of(new Turn(USER, "Kedden futottam."))));

        assertThat(result.mode()).isEqualTo(CONTEXT_DEPENDENT);
        assertThat(result.denseQuery()).isEqualTo(raw);
    }

    @Test
    void testPrepare_shouldNotCallLlm_whenMemoryIsNotNeeded() {
        int callsBefore = fakeCompanionLlm.completeCallCount();

        var result = preparer.prepare(request("köszönöm", List.of(new Turn(USER, "Korábbi kör"))));

        assertThat(result.mode()).isEqualTo(NO_MEMORY_NEEDED);
        assertThat(result.denseQuery()).isEqualTo("köszönöm");
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(callsBefore);
    }

    @Test
    void testPrepare_shouldKeepExplicitDateRange_withoutLlmCall() {
        int callsBefore = fakeCompanionLlm.completeCallCount();
        String raw = "Mi történt 2026-08-12 és 2026-08-15 között?";

        var result = preparer.prepare(request(raw, List.of(new Turn(USER, "Korábbi kör"))));

        assertThat(result.mode()).isEqualTo(SELF_CONTAINED);
        assertThat(result.from()).contains(LocalDate.of(2026, 8, 12));
        assertThat(result.to()).contains(LocalDate.of(2026, 8, 15));
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(callsBefore);
    }

    private static MemoryRequest request(String query, List<Turn> history) {
        return new MemoryRequest(
                UUID.randomUUID(), CHAT_AMBIENT, query, history,
                LocalDate.of(2026, 9, 4), 1200, UUID.randomUUID(), false);
    }
}
