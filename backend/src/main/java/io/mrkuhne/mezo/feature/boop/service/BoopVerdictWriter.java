package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.config.BoopProperties;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The words of the Boop morning brief (Boop S3, mezo-r36n9.7): one cheap-tier LLM call turns the
 * already computed scores into Hungarian verdicts in Boop's voice; {@link RuleVerdicts} is the
 * fallback for the whole answer and for every single field the model left out or broke. The brief
 * never fails because of the LLM: no companion bean, a thrown call, a call slower than
 * {@code mezo.boop.llm-timeout} (8 s; the phone gives up at 20 s), a non-JSON answer or a missing
 * field all degrade to rule text with the same schema. A call slower than the wait keeps running
 * ({@link #ask}), so {@link BoopBriefService} can store its late words (mezo-r36n9.24).
 *
 * <p>The model never scores (the prompt hands it the numbers) and never decides the session
 * conflict — that is rule-detected ({@link RuleVerdicts#conflict}) and always comes from the rules.
 * In the learning state the Forma headline is pinned to {@link RuleVerdicts#LEARNING_HEADLINE}
 * whatever the model wrote.
 *
 * <p>No {@code @Transactional}: it reads nothing from the database.
 */
@Slf4j
@Service
public class BoopVerdictWriter {

    static final String LLM_FEATURE = "boop_brief";
    private static final Set<String> LINKS = Set.of("sleep", "heart", "day");

    /** One metric verdict: a short headline and at most two sentences. */
    public record Verdict(String headline, String sentence) {}

    /** One sentence of Boop's spoken brief; {@code link} ∈ sleep|heart|day or null. */
    public record BriefLine(String text, String link) {}

    /** A rule-detected clash between the session and the last meeting; {@code suggestedTime} HH:mm. */
    public record Conflict(String text, String suggestedTime) {}

    /** Everything the brief says in words. Only {@code nextMealTip} and {@code conflict} may be null. */
    public record Verdicts(Verdict forma, Verdict alvas, Verdict mozgas, Verdict fuel, Verdict pulzus,
                           List<BriefLine> brief, String tonightTip, String nextMealTip, Conflict conflict) {}

    private final ObjectProvider<CompanionLlm> companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final RuleVerdicts rules;
    private final BoopPrompts prompts;
    private final AsyncTaskExecutor executor;
    private final Duration timeout;

    public BoopVerdictWriter(ObjectProvider<CompanionLlm> companionLlm, LlmCallContextHolder llmCallContextHolder,
                             ObjectMapper objectMapper, BoopProperties props,
                             @Qualifier("applicationTaskExecutor") AsyncTaskExecutor executor) {
        this.companionLlm = companionLlm;
        this.llmCallContextHolder = llmCallContextHolder;
        this.objectMapper = objectMapper;
        this.rules = new RuleVerdicts(props.stepsGoal(), props.nightsNeeded());
        this.prompts = new BoopPrompts(props.stepsGoal(), props.nightsNeeded());
        this.executor = executor;
        this.timeout = props.llmTimeout();
    }

    /** The words within {@code mezo.boop.llm-timeout}: the model's if it answered in time, else the rules. */
    public Verdicts write(BoopDay d, Scores s, LocalTime now) {
        Verdicts fallback = rules(d, s, now);
        return await(ask(d, s, now, fallback), fallback);
    }

    /** The rule verdicts alone (no model call). */
    public Verdicts rules(BoopDay d, Scores s, LocalTime now) {
        return rules.write(d, s, now);
    }

    /**
     * The model's verdicts merged over {@code fallback}, on the pool; completes with null when there is
     * no model, the call failed or the answer is unusable — never exceptionally. The call is NOT bounded
     * here: a caller that stops waiting ({@link #await}) leaves it running, so a late answer can still be
     * stored (mezo-r36n9.24 — in production the model never once answered within the 8 s wait, and the
     * old cancel threw every answer away). The provider client's own timeouts end a hung call.
     */
    public CompletableFuture<Verdicts> ask(BoopDay d, Scores s, LocalTime now, Verdicts fallback) {
        CompanionLlm llm = companionLlm.getIfAvailable();
        if (llm == null) {
            return CompletableFuture.completedFuture(null);
        }
        String userMessage = prompts.context(d, s, now, fallback.conflict());
        // The holder and the actor are thread-bound and the call runs on the pool, so both are bound
        // INSIDE the task (the LlmMemoryReranker pattern, mezo-ozri.1/.7): the llm-log row and the
        // per-user cap still see the owner.
        UUID actor = LlmActorContext.capture();
        try {
            return CompletableFuture.supplyAsync(() -> LlmActorContext.runAsCaptured(actor,
                    () -> llmCallContextHolder.runWith(new LlmCallContext(LLM_FEATURE, "verdicts", null, null),
                        () -> llm.complete(BoopPrompts.SYSTEM_PROMPT, userMessage))), executor)
                .handle((raw, error) -> {
                    if (error != null) {
                        Throwable cause = error instanceof CompletionException && error.getCause() != null
                            ? error.getCause() : error;
                        log.warn("Boop brief LLM call failed, using rule verdicts: {}", cause.getMessage());
                        return null;
                    }
                    JsonNode answer = parse(raw);
                    return answer == null ? null : merge(answer, fallback, s);
                });
        } catch (RuntimeException e) { // the pool refused the task
            log.warn("Boop brief LLM call failed, using rule verdicts: {}", e.getMessage());
            return CompletableFuture.completedFuture(null);
        }
    }

    /** Waits at most {@code mezo.boop.llm-timeout} for {@code words}; null or too late = {@code fallback}.
     *  Never cancels the call. */
    public Verdicts await(CompletableFuture<Verdicts> words, Verdicts fallback) {
        try {
            Verdicts v = words.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            return v == null ? fallback : v;
        } catch (TimeoutException e) {
            log.info("Boop brief LLM call took longer than {}, answering with rule verdicts; the late words are kept",
                timeout);
            return fallback;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return fallback;
        } catch (ExecutionException e) { // ask() never completes exceptionally; defensive
            return fallback;
        }
    }

    private Verdicts merge(JsonNode answer, Verdicts fallback, Scores s) {
        Verdict forma = verdict(answer.get("forma"), fallback.forma());
        if ("learning".equals(s.state())) {
            forma = new Verdict(RuleVerdicts.LEARNING_HEADLINE, forma.sentence());
        }
        return new Verdicts(
            forma,
            verdict(answer.get("alvas"), fallback.alvas()),
            verdict(answer.get("mozgas"), fallback.mozgas()),
            verdict(answer.get("fuel"), fallback.fuel()),
            verdict(answer.get("pulzus"), fallback.pulzus()),
            brief(answer.get("brief"), fallback.brief()),
            text(answer.get("tonightTip"), fallback.tonightTip()),
            text(answer.get("nextMealTip"), fallback.nextMealTip()),
            fallback.conflict());
    }

    /** The JSON object inside the answer, or null. */
    private JsonNode parse(String raw) {
        if (raw == null) {
            return null;
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("Boop brief answer had no JSON object, using rule verdicts");
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            return node != null && node.isObject() ? node : null;
        } catch (Exception e) {
            log.warn("Boop brief answer unparseable, using rule verdicts: {}", e.getMessage());
            return null;
        }
    }

    private static Verdict verdict(JsonNode node, Verdict fallback) {
        if (node == null || !node.isObject()) {
            return fallback;
        }
        String headline = str(node.get("headline"));
        String sentence = str(node.get("sentence"));
        return headline == null || sentence == null ? fallback : new Verdict(headline, sentence);
    }

    private static List<BriefLine> brief(JsonNode node, List<BriefLine> fallback) {
        if (node == null || !node.isArray()) {
            return fallback;
        }
        List<BriefLine> lines = new ArrayList<>();
        for (JsonNode item : node) {
            String text = item == null ? null : str(item.get("text"));
            if (text == null) {
                continue;
            }
            String link = str(item.get("link"));
            lines.add(new BriefLine(text, link != null && LINKS.contains(link) ? link : null));
        }
        return lines.isEmpty() ? fallback : List.copyOf(lines);
    }

    private static String text(JsonNode node, String fallback) {
        String s = str(node);
        return s == null ? fallback : s;
    }

    /** Non-blank trimmed string value, else null. */
    private static String str(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String s = node.asString().trim();
        return s.isEmpty() ? null : s;
    }
}
