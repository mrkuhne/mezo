package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.train.service.TechniqueLlm;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class TechniqueLlmAdapterTest {

    private final ObjectMapper mapper = JsonMapper.builder().build();
    private final CompanionLlm llm = mock(CompanionLlm.class);
    private final TechniqueLlmAdapter adapter = new TechniqueLlmAdapter(llm, new LlmCallContextHolder(), mapper);

    private static final UUID ROW = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private static TechniqueLlm.Request request() {
        TechniqueLlm.RowView row = new TechniqueLlm.RowView(ROW, "Gépi mellnyomás", "chest", "emphasize", 3, 8, 12,
            "balanced", "rest_drop", "planner", false, true, false, "rest_drop", false, "60×10, 60×9 (cél 8–12)");
        return new TechniqueLlm.Request(3, 6, false, 2,
            List.of(new TechniqueLlm.DayView(0, "Hét", false, 2, List.of(row))),
            List.of(new TechniqueLlm.GroupSignal("chest", false, true, false, false)));
    }

    @Test
    void sendsTheWeekAndParsesTheAnswer() {
        when(llm.completeSmart(anyString(), anyString())).thenReturn("""
            Íme: {"changes":[{"exerciseId":"00000000-0000-0000-0000-000000000001","technique":"myo",
            "reason":"A mell ízülete fájt."}],"challenges":[]} köszi""");

        Optional<TechniqueLlm.Suggestion> s = adapter.refine(request());

        assertThat(s).hasValueSatisfying(x -> {
            assertThat(x.changes()).singleElement().satisfies(c -> {
                assertThat(c.exerciseId()).isEqualTo(ROW);
                assertThat(c.technique()).isEqualTo("myo");
            });
            assertThat(x.challenges()).isEmpty();
        });
        ArgumentCaptor<String> user = ArgumentCaptor.forClass(String.class);
        verify(llm).completeSmart(eq(TechniqueLlmAdapter.SYSTEM_PROMPT), user.capture());
        assertThat(user.getValue()).contains("Gépi mellnyomás", "\"eligible\":true", "\"jointPain\":true",
            "60×10, 60×9");
    }

    @Test
    void garbageOrAFailureIsEmpty() {
        when(llm.completeSmart(anyString(), anyString())).thenReturn("nem tudok segíteni");
        assertThat(adapter.refine(request())).isEmpty();

        when(llm.completeSmart(anyString(), anyString())).thenReturn("{nem json}");
        assertThat(adapter.refine(request())).isEmpty();

        when(llm.completeSmart(anyString(), anyString())).thenThrow(new RuntimeException("429 no credits"));
        assertThat(adapter.refine(request())).isEmpty();
    }
}
