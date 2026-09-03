package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.google.genai.types.ContentEmbedding;
import com.google.genai.types.EmbedContentConfig;
import com.google.genai.types.EmbedContentMetadata;
import com.google.genai.types.EmbedContentResponse;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

/**
 * The embedding adapter's audit contract (mezo-2zyu), proven WITHOUT a network or a Spring context.
 *
 * <p>The Gen AI SDK's {@code Client.models} is a {@code public final} field on a {@code final} class,
 * so it cannot be stubbed; {@link GeminiEmbeddingAdapter#callEmbedContent} is the seam a test stands
 * in for instead — everything above it (timing, validation, record mapping, rethrow) is our code and
 * is what gets asserted here.
 *
 * <p>The promises under test: the caller's vectors are unchanged by the logging, each task type
 * lands exactly one record of the right {@link CallKind} with the char-based usage block, a failing
 * provider produces an ERROR record AND still rethrows, and a call that never left the process
 * (empty batch) is not invented into the log.
 */
class GeminiEmbeddingAdapterRecordingTest {

    /**
     * Deliberately NOT the real {@code gemini-embedding-001} default: the model must be proven to
     * come from {@link CompanionProperties}, and a value that matched the shipped default would let
     * a hardcoded model in the adapter pass green.
     */
    private static final String EMBED_MODEL = "test-embed-model-001";

    private final CapturingRecorder recorder = new CapturingRecorder();
    private final LlmCallContextHolder contextHolder = new LlmCallContextHolder();
    private final AtomicReference<EmbedContentConfig> lastConfig = new AtomicReference<>();
    private final AtomicReference<String> lastModel = new AtomicReference<>();

    @Test
    void testEmbedDocuments_shouldRecordEmbedDocSuccess_whenTheProviderReportsBillableChars() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> response(42, vector(3f, 4f), vector(0f, 5f)));

        List<float[]> vectors = adapter.embedDocuments(List.of("alma", "korte"));

        // the vectors the caller gets are exactly what they were before the logging (L2-normalized)
        assertThat(vectors).hasSize(2);
        assertThat(vectors.get(0)).containsExactly(0.6f, 0.8f);
        assertThat(vectors.get(1)).containsExactly(0f, 1f);

        LlmCallRecord record = recorder.single();
        assertThat(record.status()).isEqualTo(CallStatus.SUCCESS);
        assertThat(record.callKind()).isEqualTo(CallKind.EMBED_DOC);
        assertThat(record.requestedModel()).isEqualTo(EMBED_MODEL);
        // the embedContent response carries no served-model echo — the requested model IS what ran
        assertThat(record.servedModel()).isEqualTo(EMBED_MODEL);
        assertThat(record.embed().inputCount()).isEqualTo(2);
        assertThat(record.embed().dimensions()).isEqualTo(EmbeddingPort.DIMENSIONS);
        assertThat(record.embed().billableChars()).isEqualTo(42);
        assertThat(record.tokens()).isNull();
        assertThat(record.streamed()).isFalse();
        assertThat(record.systemPrompt()).isNull();
        assertThat(record.userMessage()).isNull();
        assertThat(record.responseText()).isNull();
        assertThat(record.errorCode()).isNull();
        assertThat(record.errorClass()).isNull();
        assertThat(record.context()).isEqualTo(LlmCallContext.UNKNOWN);

        // what actually went ON THE WIRE — the configured model, not a hardcoded one, and the same
        // string the row reports
        assertThat(lastModel.get()).isEqualTo(companionProperties().embedding().model());
        assertThat(lastModel.get()).isEqualTo(record.requestedModel()).isEqualTo(record.servedModel());
        assertThat(lastConfig.get().taskType()).contains(GeminiEmbeddingAdapter.TASK_DOCUMENT);
        assertThat(lastConfig.get().outputDimensionality()).contains(EmbeddingPort.DIMENSIONS);
    }

    @Test
    void testEmbedQuery_shouldRecordEmbedQueryKindWithOneInput_whenCalled() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> response(7, vector(1f, 0f)));

        adapter.embedQuery("mit ettem tegnap");

        LlmCallRecord record = recorder.single();
        assertThat(record.callKind()).isEqualTo(CallKind.EMBED_QUERY);
        assertThat(record.embed().inputCount()).isEqualTo(1);
        assertThat(record.embed().billableChars()).isEqualTo(7);
        assertThat(lastModel.get()).isEqualTo(companionProperties().embedding().model());
        assertThat(lastConfig.get().taskType()).contains(GeminiEmbeddingAdapter.TASK_QUERY);
    }

    /** No metadata block means the provider did not report a char count — null beats a fabricated 0. */
    @Test
    void testEmbedDocuments_shouldRecordNullBillableChars_whenTheResponseCarriesNoMetadata() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> EmbedContentResponse.builder()
            .embeddings(List.of(vector(1f, 0f)))
            .build());

        adapter.embedDocuments(List.of("alma"));

        LlmCallRecord record = recorder.single();
        assertThat(record.status()).isEqualTo(CallStatus.SUCCESS);
        assertThat(record.embed().billableChars()).isNull();
        assertThat(record.embed().inputCount()).isEqualTo(1);
    }

    @Test
    void testEmbedDocuments_shouldRecordErrorAndRethrow_whenTheProviderFails() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> {
            throw new IllegalStateException("provider blew up");
        });

        assertThatThrownBy(() -> adapter.embedDocuments(List.of("alma", "korte")))
            .isInstanceOf(IllegalStateException.class);

        LlmCallRecord record = recorder.single();
        assertThat(record.status()).isEqualTo(CallStatus.ERROR);
        assertThat(record.callKind()).isEqualTo(CallKind.EMBED_DOC);
        assertThat(record.errorClass()).isEqualTo("IllegalStateException");
        assertThat(record.errorCode()).isNull();
        assertThat(record.embed().inputCount()).isEqualTo(2);
        assertThat(record.embed().billableChars()).isNull();
    }

    /** A malformed response is an app-level failure — its SystemMessage code lands on the row. */
    @Test
    void testEmbedDocuments_shouldRecordTheSystemMessageCode_whenTheResponseIsMalformed() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> response(9, vector(1f, 0f)));

        assertThatThrownBy(() -> adapter.embedDocuments(List.of("alma", "korte")))
            .isInstanceOf(SystemRuntimeErrorException.class);

        LlmCallRecord record = recorder.single();
        assertThat(record.status()).isEqualTo(CallStatus.ERROR);
        assertThat(record.errorClass()).isEqualTo("SystemRuntimeErrorException");
        assertThat(record.errorCode()).isEqualTo("COMPANION_EMBEDDING_INVALID_RESPONSE");
    }

    /** An empty batch never reaches the provider — logging it would invent a call that never happened. */
    @Test
    void testEmbedDocuments_shouldRecordNothing_whenTheBatchIsEmpty() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> {
            throw new IllegalStateException("must not be called");
        });

        assertThat(adapter.embedDocuments(List.of())).isEmpty();

        assertThat(recorder.records).isEmpty();
    }

    @Test
    void testEmbedQuery_shouldCarryTheAmbientContext_whenACallSiteBoundOne() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> response(7, vector(1f, 0f)));
        UUID turnId = UUID.randomUUID();

        contextHolder.runWith(new LlmCallContext("companion_recall", "query", "chat_turn", turnId),
            () -> adapter.embedQuery("mit ettem tegnap"));

        assertThat(recorder.single().context())
            .isEqualTo(new LlmCallContext("companion_recall", "query", "chat_turn", turnId));
    }

    /**
     * The provider-response → record translation on its own: a pure mapping, asserted without the
     * surrounding call so a change in the wiring can never hide a change in the mapping.
     */
    @Test
    void testSuccessRecord_shouldMapTheProviderMetadata_whenCalledDirectly() {
        GeminiEmbeddingAdapter adapter = adapter(texts -> null);
        EmbedContentResponse response = EmbedContentResponse.builder()
            .metadata(EmbedContentMetadata.builder().billableCharacterCount(42).build())
            .build();

        LlmCallRecord record = adapter.successRecord(
            CallKind.EMBED_DOC, 3, response, 17L, LlmCallContext.UNKNOWN);

        assertThat(record.callKind()).isEqualTo(CallKind.EMBED_DOC);
        assertThat(record.status()).isEqualTo(CallStatus.SUCCESS);
        assertThat(record.requestedModel()).isEqualTo(EMBED_MODEL);
        assertThat(record.servedModel()).isEqualTo(EMBED_MODEL);
        assertThat(record.latencyMs()).isEqualTo(17L);
        assertThat(record.embed().inputCount()).isEqualTo(3);
        assertThat(record.embed().dimensions()).isEqualTo(EmbeddingPort.DIMENSIONS);
        assertThat(record.embed().billableChars()).isEqualTo(42);
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    /** Stands in for the one SDK hop, capturing what would have gone on the wire; the rest runs for real. */
    private GeminiEmbeddingAdapter adapter(Function<List<String>, EmbedContentResponse> provider) {
        return new GeminiEmbeddingAdapter(null, companionProperties(), recorder, contextHolder) {
            @Override
            EmbedContentResponse callEmbedContent(String model, List<String> texts, EmbedContentConfig config) {
                lastModel.set(model);
                lastConfig.set(config);
                return provider.apply(texts);
            }
        };
    }

    private static CompanionProperties companionProperties() {
        return new CompanionProperties(null, null, null, null, null, null, null,
            new CompanionProperties.Embedding(EMBED_MODEL, false, 2_000, true, 80, 200), null, null, null, null, null, null, null, null, null, null, null);
    }

    private static EmbedContentResponse response(int billableChars, ContentEmbedding... embeddings) {
        return EmbedContentResponse.builder()
            .embeddings(List.of(embeddings))
            .metadata(EmbedContentMetadata.builder().billableCharacterCount(billableChars).build())
            .build();
    }

    private static ContentEmbedding vector(Float... values) {
        return ContentEmbedding.builder().values(List.of(values)).build();
    }

    private static final class CapturingRecorder implements LlmCallRecorder {

        private final List<LlmCallRecord> records = new CopyOnWriteArrayList<>();

        @Override
        public void record(LlmCallRecord record) {
            records.add(record);
        }

        /** Every call path must land EXACTLY one row — a double-record is as wrong as none. */
        LlmCallRecord single() {
            assertThat(records).hasSize(1);
            return records.getFirst();
        }
    }
}
