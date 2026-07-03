package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.UUID;

/**
 * The V0.4 SSE turn — the ONE hand-written endpoint beside the generated CompanionApi surface.
 * PRECEDENT (recorded in _platform-api-backend.md §9): the operation IS in the contract fragment
 * (tag CompanionStream) so schemas/types stay generated, but the generated CompanionStreamApi
 * interface is deliberately not implemented — the generator cannot express
 * Flux&lt;ServerSentEvent&gt;. Mapping + @Valid therefore live here, hand-written.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionStreamController {

    private final ChatStreamService chatStreamService;
    private final CurrentUserId currentUserId;

    @PostMapping(
            value = "/api/companion/conversation/{conversationId}/message/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<Object>> streamMessage(
            @PathVariable UUID conversationId, @Valid @RequestBody SendMessageRequest request) {
        return chatStreamService.streamMessage(currentUserId.get(), conversationId, request);
    }
}
