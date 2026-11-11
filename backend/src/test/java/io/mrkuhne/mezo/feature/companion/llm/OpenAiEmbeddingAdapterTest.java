package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingResponse;

/** mezo-lb2yb: the OpenAI embedding adapter's vector + audit contract, without a network. */
class OpenAiEmbeddingAdapterTest {

    private static final String EMBED_MODEL = "test-openai-embed";

    private final List<LlmCallRecord> records = new ArrayList<>();
    private final LlmCallRecorder recorder = records::add;

    private OpenAiEmbeddingAdapter adapter(Function<List<String>, EmbeddingResponse> provider) {
        return new OpenAiEmbeddingAdapter(properties(), recorder, new LlmCallContextHolder(), "sk-test") {
            @Override
            EmbeddingResponse callEmbed(List<String> texts) {
                return provider.apply(texts);
            }
        };
    }

    private static float[] raw(float first, float second) {
        float[] v = new float[EmbeddingPort.DIMENSIONS];
        v[0] = first;
        v[1] = second;
        return v;
    }

    @Test
    void embedDocuments_returnsUnitVectorsInInputOrder_andRecordsOneSuccessRow() {
        OpenAiEmbeddingAdapter adapter = adapter(texts -> new EmbeddingResponse(List.of(
                new Embedding(raw(0f, 5f), 1), new Embedding(raw(3f, 4f), 0))));

        List<float[]> vectors = adapter.embedDocuments(List.of("alma", "korte"));

        assertThat(vectors).hasSize(2);
        assertThat(vectors.get(0)[0]).isEqualTo(0.6f);
        assertThat(vectors.get(0)[1]).isEqualTo(0.8f);
        assertThat(vectors.get(1)[1]).isEqualTo(1f);
        assertThat(records).singleElement().satisfies(r -> {
            assertThat(r.status()).isEqualTo(CallStatus.SUCCESS);
            assertThat(r.callKind()).isEqualTo(CallKind.EMBED_DOC);
            assertThat(r.requestedModel()).isEqualTo(EMBED_MODEL);
            assertThat(r.embed().dimensions()).isEqualTo(EmbeddingPort.DIMENSIONS);
            assertThat(r.embed().billableChars()).isEqualTo(9);
        });
    }

    @Test
    void embedQuery_recordsTheQueryKind() {
        adapter(texts -> new EmbeddingResponse(List.of(new Embedding(raw(1f, 0f), 0)))).embedQuery("alvás");

        assertThat(records).singleElement()
                .satisfies(r -> assertThat(r.callKind()).isEqualTo(CallKind.EMBED_QUERY));
    }

    @Test
    void wrongWidth_isAnInvalidResponse_recordedWithItsCode() {
        OpenAiEmbeddingAdapter adapter = adapter(texts -> new EmbeddingResponse(List.of(
                new Embedding(new float[] {1f, 2f}, 0))));

        assertThatThrownBy(() -> adapter.embedQuery("x")).isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(records).singleElement().satisfies(r -> {
            assertThat(r.status()).isEqualTo(CallStatus.ERROR);
            assertThat(r.errorCode()).isEqualTo("COMPANION_EMBEDDING_INVALID_RESPONSE");
        });
    }

    @Test
    void providerFailure_isRethrown_withItsMessageOnTheRow() {
        OpenAiEmbeddingAdapter adapter = adapter(texts -> {
            throw new IllegalStateException("wrapped", new RuntimeException("insufficient_quota"));
        });

        assertThatThrownBy(() -> adapter.embedDocuments(List.of("a"))).isInstanceOf(IllegalStateException.class);
        assertThat(records).singleElement().satisfies(r -> {
            assertThat(r.status()).isEqualTo(CallStatus.ERROR);
            assertThat(r.responseText()).isEqualTo("insufficient_quota");
            assertThat(r.embed().billableChars()).isNull();
        });
    }

    @Test
    void emptyBatch_leavesNoRow() {
        assertThat(adapter(texts -> null).embedDocuments(List.of())).isEmpty();
        assertThat(records).isEmpty();
    }

    private static CompanionProperties properties() {
        return new CompanionProperties(null, null, null, null, null, null, null,
            new CompanionProperties.Embedding("openai", EMBED_MODEL, false, 2_000, true, 80, 200), null, null, null, null, null, null, null, null, null, null, null,
            new CompanionProperties.Turn(true,
                new CompanionProperties.Turn.Gear(true),
                new CompanionProperties.Turn.Planner(1),
                new CompanionProperties.Turn.Executor(4, 15_000L),
                new CompanionProperties.Turn.Answerer("high", 8000, 40000),
                new CompanionProperties.Turn.Replan(1),
                        new CompanionProperties.Turn.Provenance(90, "0 50 3 * * *")));
    }
}
