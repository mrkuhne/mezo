package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.advisor.TurnVerdictCheck;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryService;
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

    /** Scripted verdicts (V1.3): violate only until the retry header appears in the checked answer. */
    public static final String VIOLATE_ONCE = "[fake-violate]";
    /** Scripted verdicts (V1.3): violate every round — exercises the degraded path. */
    public static final String VIOLATE_ALWAYS = "[fake-violate-always]";
    /** Scripted verdicts (V1.3): answer with non-JSON — exercises the fail-open path. */
    public static final String VERDICT_BROKEN = "[fake-verdict-broken]";

    /** Scripted tool execution: {@code [fake-tool:get_sleep {"days":3}]} runs the real callback. */
    public static final Pattern TOOL_SENTINEL = Pattern.compile("\\[fake-tool:([a-z_]+)(?: (\\{.*?\\}))?]");

    /** Scripted extraction (V1.2): {@code [fake-facts:<json-array>]} is returned verbatim to extraction calls. */
    public static final Pattern FACTS_SENTINEL =
            Pattern.compile("\\[fake-facts:(\\[.*?]|[^\\]]*)]", Pattern.DOTALL);

    /** Scripted narrative (V2.2): {@code [fake-summary:…]} payload becomes the summary answer. */
    public static final Pattern SUMMARY_SENTINEL =
            Pattern.compile("\\[fake-summary:([^\\]]*)]", Pattern.DOTALL);

    @Override
    public String complete(String systemPrompt, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
        if (userMessage.contains(FAIL_COMPLETE)) {
            throw new IllegalStateException("FAKE-LLM forced complete failure");
        }
        if (systemPrompt.startsWith(FactExtractionService.EXTRACTION_MARKER)) {
            return factsAnswer(userMessage);
        }
        if (systemPrompt.startsWith(TurnVerdictCheck.VERDICT_MARKER)) {
            return verdictAnswer(userMessage);
        }
        if (systemPrompt.startsWith(DailySummaryService.SUMMARY_MARKER)) {
            return summaryAnswer(userMessage);
        }
        return PREFIX + " system=[" + systemPrompt + "] user=[" + userMessage + "]"
                + String.join("", toolEchoes(userMessage, tools, toolContext));
    }

    /**
     * Deterministic, STATELESS verdict scripting (V1.3): the verdict payload embeds the checked
     * answer, and the echo embeds the prompts in every answer — so attempt-2 answers contain the
     * retry header, which is how {@link #VIOLATE_ONCE} "passes" the retry without the fake keeping
     * state. {@link #VIOLATE_ALWAYS} ignores the header (degraded path); {@link #VERDICT_BROKEN}
     * returns non-JSON (fail-open path).
     */
    private String verdictAnswer(String userMessage) {
        if (userMessage.contains(VERDICT_BROKEN)) {
            return "ez nem json";
        }
        boolean retryRound = userMessage.contains(AdvisorRetry.RETRY_MARKER);
        if (userMessage.contains(VIOLATE_ALWAYS) || (userMessage.contains(VIOLATE_ONCE) && !retryRound)) {
            return "{\"redundantQuestion\":true,\"ungroundedClaim\":false,\"reason\":\"ismert tényre kérdez rá\"}";
        }
        return "{\"redundantQuestion\":false,\"ungroundedClaim\":false,\"reason\":\"\"}";
    }

    /**
     * Extraction calls answer deterministically: the {@code [fake-facts:…]} sentinel payload found
     * in the turn content becomes the "LLM" answer (a flat JSON array of fact objects, or any
     * malformed payload a test scripts), {@code []} when the turn carries no sentinel.
     */
    private String factsAnswer(String userMessage) {
        Matcher m = FACTS_SENTINEL.matcher(userMessage);
        return m.find() ? m.group(1) : "[]";
    }

    /**
     * Summary calls (V2.2) answer deterministically: a {@code [fake-summary:…]} sentinel in the
     * digest (plant it via a check-in note) becomes the narrative verbatim; otherwise the digest
     * is echoed inside {@code ÖSSZEFOGLALÓ(…)} so ITs can assert real day-facts land in the
     * persisted narrative without any LLM.
     */
    private String summaryAnswer(String userMessage) {
        Matcher m = SUMMARY_SENTINEL.matcher(userMessage);
        return m.find() ? m.group(1) : "ÖSSZEFOGLALÓ(" + userMessage + ")";
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
