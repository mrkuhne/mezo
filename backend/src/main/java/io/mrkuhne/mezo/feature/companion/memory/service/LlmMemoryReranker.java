package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Smart-tier reranker that can only reorder supplied IDs and always fails back to fused order. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LlmMemoryReranker implements MemoryReranker {

    public static final String RERANK_MARKER = "MEMORIA-UJRARANGSOROLAS";

    private static final String SYSTEM_PROMPT = RERANK_MARKER + "\n"
            + "Rendezd relevancia szerint a kapott memóriaazonosítókat. "
            + "Csak egy JSON UUID-tömböt adj vissza, új azonosítót ne találj ki.";

    private final CompanionLlm llm;
    private final ObjectMapper objectMapper;
    private final MemoryPlatformProperties properties;
    @Qualifier("applicationTaskExecutor")
    private final AsyncTaskExecutor applicationTaskExecutor;

    @Override
    public boolean shouldRerank(
            MemoryRequest request,
            Map<String, List<MemoryCandidate>> rankedByRetriever,
            List<FusedCandidate> selected) {
        if (!properties.reranker().enabled() || selected.isEmpty()) {
            return false;
        }
        if (request.deep() || request.consumerPolicy() == io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy.WEEKLY_MEMOIR) {
            return true;
        }
        if (selected.stream().anyMatch(item -> item.candidate().conflicting())) {
            return true;
        }
        if (selected.size() >= 2 && selected.get(0).score().finalScore()
                - selected.get(1).score().finalScore() < properties.reranker().uncertaintyDelta()) {
            return true;
        }
        List<MemoryCandidate> dense = rankedByRetriever.getOrDefault("dense", List.of());
        List<MemoryCandidate> lexical = rankedByRetriever.getOrDefault("lexical", List.of());
        return !dense.isEmpty() && !lexical.isEmpty()
                && !dense.getFirst().stableId().equals(lexical.getFirst().stableId());
    }

    @Override
    public List<FusedCandidate> rerank(List<FusedCandidate> fusedOrder) {
        if (fusedOrder.size() < 2) {
            return fusedOrder;
        }
        int limit = Math.min(properties.reranker().maxCandidates(), fusedOrder.size());
        List<FusedCandidate> exposed = fusedOrder.subList(0, limit);
        Future<String> call = null;
        try {
            call = applicationTaskExecutor.submit(() -> llm.completeSmart(SYSTEM_PROMPT, render(exposed)));
            String answer = call.get(properties.reranker().timeoutMs(), TimeUnit.MILLISECONDS);
            List<UUID> orderedIds = parseIds(answer);
            Map<UUID, FusedCandidate> supplied = new LinkedHashMap<>();
            exposed.forEach(item -> supplied.put(item.candidate().stableId(), item));
            List<FusedCandidate> result = new ArrayList<>(fusedOrder.size());
            Set<UUID> seen = new HashSet<>();
            for (UUID id : orderedIds) {
                FusedCandidate candidate = supplied.get(id);
                if (candidate != null && seen.add(id)) {
                    result.add(candidate);
                }
            }
            for (FusedCandidate candidate : fusedOrder) {
                if (seen.add(candidate.candidate().stableId())) {
                    result.add(candidate);
                }
            }
            return List.copyOf(result);
        } catch (TimeoutException exception) {
            if (call != null) {
                call.cancel(true);
            }
            log.warn("Memory reranking timed out; deterministic fused order will be used");
            return fusedOrder;
        } catch (InterruptedException exception) {
            if (call != null) {
                call.cancel(true);
            }
            Thread.currentThread().interrupt();
            log.warn("Memory reranking was interrupted; deterministic fused order will be used");
            return fusedOrder;
        } catch (ExecutionException exception) {
            log.warn("Memory reranking failed; deterministic fused order will be used", exception.getCause());
            return fusedOrder;
        } catch (RuntimeException exception) {
            log.warn("Memory reranking failed; deterministic fused order will be used", exception);
            return fusedOrder;
        }
    }

    private String render(List<FusedCandidate> candidates) {
        StringBuilder prompt = new StringBuilder();
        int maxChars = properties.reranker().maxContentChars();
        for (FusedCandidate fused : candidates) {
            MemoryCandidate candidate = fused.candidate();
            String content = candidate.content() == null ? "" : candidate.content();
            prompt.append(candidate.stableId()).append('|')
                    .append(content, 0, Math.min(content.length(), maxChars)).append('\n');
        }
        return prompt.toString();
    }

    private List<UUID> parseIds(String answer) {
        try {
            return List.of(objectMapper.readValue(answer, UUID[].class));
        } catch (JacksonException exception) {
            SystemRuntimeErrorException failure = new SystemRuntimeErrorException(
                    SystemMessage.error("INTERNAL_ERROR").build());
            failure.initCause(exception);
            throw failure;
        }
    }
}
