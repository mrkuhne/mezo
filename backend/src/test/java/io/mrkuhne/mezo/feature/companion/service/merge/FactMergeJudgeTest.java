package io.mrkuhne.mezo.feature.companion.service.merge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergeJudge.JudgedGroup;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

/** Task 2 (mezo-d6ivw.10): the fact-merge judge never throws and drops any invalid group. */
class FactMergeJudgeTest {

    private final CompanionLlm companionLlm = mock(CompanionLlm.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final LlmCallContextHolder llmCallContextHolder = new LlmCallContextHolder();
    private final FactMergeJudge judge =
            new FactMergeJudge(companionLlm, objectMapper, llmCallContextHolder);

    private final UUID userId = UUID.randomUUID();

    private static KnowledgeFactEntity fact(String text) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setFactText(text);
        fact.setCategory("life");
        return fact;
    }

    private List<KnowledgeFactEntity> facts(int count) {
        return java.util.stream.IntStream.rangeClosed(1, count)
                .mapToObj(i -> fact("Tény " + i))
                .toList();
    }

    @Test
    void validAnswerReturnsBothGroups() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"same","members":[1,3],"sentence":""},
                {"verdict":"combine","members":[2,4],"sentence":"Késő esti evés után nálad gyakran nehezebb az elalvás."}]}
                """);

        List<JudgedGroup> result = judge.judge(userId, facts(4));

        assertThat(result).hasSize(2);
        assertThat(result.get(0).verdict()).isEqualTo("same");
        assertThat(result.get(0).members()).containsExactly(1, 3);
        assertThat(result.get(1).verdict()).isEqualTo("combine");
        assertThat(result.get(1).members()).containsExactly(2, 4);
        assertThat(result.get(1).sentence()).isEqualTo("Késő esti evés után nálad gyakran nehezebb az elalvás.");
    }

    @Test
    void garbageAnswerReturnsEmptyList() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn("nem tudom");

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void llmThrowingReturnsEmptyList() {
        when(companionLlm.completeSmart(anyString(), anyString()))
                .thenThrow(new IllegalStateException("boom"));

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void duplicateMembersAreDropped() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"same","members":[1,1],"sentence":""}]}
                """);

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void tooFewMembersAreDropped() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"same","members":[1],"sentence":""}]}
                """);

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void tooManyMembersAreDropped() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"same","members":[1,2,3,4],"sentence":""}]}
                """);

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void outOfRangeMemberIsDropped() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"same","members":[1,9],"sentence":""}]}
                """);

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void unknownVerdictIsDropped() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"maybe","members":[1,2],"sentence":""}]}
                """);

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }

    @Test
    void combineWithBlankSentenceIsDropped() {
        when(companionLlm.completeSmart(anyString(), anyString())).thenReturn(
                """
                {"groups":[{"verdict":"combine","members":[1,2],"sentence":"  "}]}
                """);

        assertThat(judge.judge(userId, facts(4))).isEmpty();
    }
}
