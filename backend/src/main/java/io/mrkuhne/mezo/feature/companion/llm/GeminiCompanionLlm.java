package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * Real {@link CompanionLlm} adapter over the autoconfigured Gemini {@link ChatModel}
 * (spring-ai-starter-model-google-genai, ADR 0008). Absent under the {@code companion-fake}
 * profile so integration tests never construct a network-bound client path. Tools ride the
 * ChatClient request spec; Spring AI runs the tool-execution loop internally (V0.5).
 */
@Component
@Profile("!companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GeminiCompanionLlm implements CompanionLlm {

    private final ChatClient chatClient;

    public GeminiCompanionLlm(ChatModel chatModel, CompanionProperties companionProperties) {
        this.chatClient = ChatClient.builder(chatModel)
            .defaultOptions(ChatOptions.builder()
                .model(companionProperties.llm().chatModel()))
            .build();
    }

    @Override
    public String complete(String systemPrompt, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        return request(systemPrompt, userMessage, tools, toolContext).call().content();
    }

    @Override
    public Flux<String> stream(String systemPrompt, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
        return request(systemPrompt, userMessage, tools, toolContext).stream().content();
    }

    private ChatClient.ChatClientRequestSpec request(String systemPrompt, String userMessage,
                                                     List<ToolCallback> tools, Map<String, Object> toolContext) {
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt().system(systemPrompt).user(userMessage);
        if (!tools.isEmpty()) {
            spec = spec.toolCallbacks(tools).toolContext(toolContext);
        }
        return spec;
    }
}
