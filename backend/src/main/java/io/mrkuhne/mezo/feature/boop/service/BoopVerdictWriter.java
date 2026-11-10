package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.config.BoopProperties;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The words of the Boop morning brief (Boop S3, mezo-r36n9.7): one cheap-tier LLM call turns the
 * already computed scores into Hungarian verdicts in Boop's voice; {@link RuleVerdicts} is the
 * fallback for the whole answer and for every single field the model left out or broke. The brief
 * never fails because of the LLM: no companion bean, a thrown call, a non-JSON answer or a missing
 * field all degrade to rule text with the same schema.
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

    public BoopVerdictWriter(ObjectProvider<CompanionLlm> companionLlm, LlmCallContextHolder llmCallContextHolder,
                             ObjectMapper objectMapper, BoopProperties props) {
        this.companionLlm = companionLlm;
        this.llmCallContextHolder = llmCallContextHolder;
        this.objectMapper = objectMapper;
        this.rules = new RuleVerdicts(props.stepsGoal(), props.nightsNeeded());
        this.prompts = new BoopPrompts(props.stepsGoal(), props.nightsNeeded());
    }

    public Verdicts write(BoopDay d, Scores s, LocalTime now) {
        Verdicts fallback = rules.write(d, s, now);
        JsonNode answer = ask(d, s, now, fallback.conflict());
        if (answer == null) {
            return fallback;
        }
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

    /** The parsed JSON object, or null on any failure (no LLM bean, thrown call, no JSON object). */
    private JsonNode ask(BoopDay d, Scores s, LocalTime now, Conflict conflict) {
        CompanionLlm llm = companionLlm.getIfAvailable();
        if (llm == null) {
            return null;
        }
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                new LlmCallContext(LLM_FEATURE, "verdicts", null, null),
                () -> llm.complete(BoopPrompts.SYSTEM_PROMPT, prompts.context(d, s, now, conflict)));
        } catch (Exception e) {
            log.warn("Boop brief LLM call failed, using rule verdicts: {}", e.getMessage());
            return null;
        }
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
