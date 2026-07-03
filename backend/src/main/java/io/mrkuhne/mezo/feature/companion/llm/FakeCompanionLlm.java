package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

/**
 * Deterministic in-process {@link CompanionLlm} for integration tests (spec §6: profile-gated
 * fake bean, not a Mockito mock — the network is never touched in tests). Echoes both prompt
 * halves so tests can assert exactly what the caller assembled; streams in fixed chunks so the
 * streaming path is exercised end to end.
 *
 * <p>V0.5 — scripted tool execution: every {@code [fake-tool:name {json}]} sentinel in the user
 * message invokes the matching REAL callback (registry decorator included), so ITs exercise the
 * audit/budget/refs pipeline deterministically without a model.
 */
@Component
@Profile("companion-fake")
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FakeCompanionLlm implements CompanionLlm {

    public static final String PREFIX = "FAKE-LLM";

    /** Content markers that force a deterministic failure — lets ITs exercise error paths. */
    public static final String FAIL_COMPLETE = "[fake-fail]";
    public static final String FAIL_STREAM = "[fake-stream-fail]";

    /** Scripted tool execution: {@code [fake-tool:get_sleep {"days":3}]} runs the real callback. */
    public static final Pattern TOOL_SENTINEL = Pattern.compile("\\[fake-tool:([a-z_]+)(?: (\\{.*?\\}))?]");

    @Override
    public String complete(String systemPrompt, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        if (userMessage.contains(FAIL_COMPLETE)) {
            throw new IllegalStateException("FAKE-LLM forced complete failure");
        }
        return PREFIX + " system=[" + systemPrompt + "] user=[" + userMessage + "]"
                + String.join("", toolEchoes(userMessage, tools, toolContext));
    }

    @Override
    public Flux<String> stream(String systemPrompt, String userMessage,
                               List<ToolCallback> tools, Map<String, Object> toolContext) {
        if (userMessage.contains(FAIL_STREAM)) {
            return Flux.concat(
                Flux.just(PREFIX),
                Flux.error(new IllegalStateException("FAKE-LLM forced stream failure")));
        }
        List<String> chunks = new ArrayList<>(List.of(
            PREFIX,
            " system=[" + systemPrompt + "]",
            " user=[" + userMessage + "]"));
        chunks.addAll(toolEchoes(userMessage, tools, toolContext));
        return Flux.fromIterable(chunks);
    }

    /** Every sentinel executes the matching REAL callback; unknown names echo UNKNOWN. */
    private List<String> toolEchoes(String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext) {
        List<String> echoes = new ArrayList<>();
        Matcher m = TOOL_SENTINEL.matcher(userMessage);
        while (m.find()) {
            String name = m.group(1);
            String args = m.group(2) != null ? m.group(2) : "{}";
            String result = tools.stream()
                    .filter(cb -> cb.getToolDefinition().name().equals(name))
                    .findFirst()
                    .map(cb -> cb.call(args, new ToolContext(toolContext)))
                    .orElse("UNKNOWN");
            echoes.add(" tool:" + name + "=[" + result + "]");
        }
        return echoes;
    }
}
