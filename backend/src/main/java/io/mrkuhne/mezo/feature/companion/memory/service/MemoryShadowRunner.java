package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;

/** Fire-and-forget unified retrieval whose result can never affect the legacy served turn. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryShadowRunner {

    private final MemoryContextService memoryContextService;
    private final AsyncTaskExecutor applicationTaskExecutor;

    public void submit(MemoryRequest request) {
        try {
            applicationTaskExecutor.submit(() -> run(request));
        } catch (RuntimeException exception) {
            log.warn("Shadow memory retrieval could not be submitted for conversation {}",
                    request.conversationId(), exception);
        }
    }

    private void run(MemoryRequest request) {
        try {
            memoryContextService.retrieve(request, RetrievalServingMode.SHADOW);
        } catch (RuntimeException exception) {
            log.warn("Shadow memory retrieval failed for conversation {}; legacy serving was unaffected",
                    request.conversationId(), exception);
        }
    }
}
