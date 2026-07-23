package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.advisor.TurnVerdictCheck;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryService;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.nio.charset.StandardCharsets;
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

    /** Scripted scrape (mezo-8vum): {@code [fake-scrape:{json}]} payload is returned verbatim. */
    public static final Pattern SCRAPE_SENTINEL =
            Pattern.compile("\\[fake-scrape:(\\{.*?})]", Pattern.DOTALL);

    /** Scripted photo import (mezo-d8tr): {@code [fake-photo:{json}]} decoded from IMAGE BYTES —
     *  the flat draft JSON nests no objects, so the non-greedy match is safe (unlike meal). */
    public static final Pattern PHOTO_SENTINEL =
            Pattern.compile("\\[fake-photo:(\\{.*?})]", Pattern.DOTALL);

    /** Scripted meal draft (mezo-78rn): {@code [fake-meal:{json}]} payload is returned verbatim —
     *  matched in the user text (text + multimodal paths) and in the UTF-8-decoded image bytes,
     *  so photo-only ITs drive canned JSON through the real multipart plumbing.
     *  GREEDY (unlike scrape) — the draft payload {@code {"slot":…,"items":[{…}]}} nests objects
     *  inside {@code items}, so the match must run to the LAST brace, not the first {@code }]}. */
    public static final Pattern MEAL_SENTINEL =
            Pattern.compile("\\[fake-meal:(\\{.*})]", Pattern.DOTALL);

    /** Scripted recipe breakdown prose (mezo-bw3y): {@code [fake-recipe-fit:{json}]} planted in the
     *  RECIPE NAME (it appears in the prompt's user message). GREEDY — the payload nests objects.
     *  No sentinel -> prompt echo -> unparseable -> the prose service degrades to the deterministic
     *  envelope, which is exactly the LLM-failure path the ITs assert. */
    public static final Pattern RECIPE_FIT_SENTINEL =
            Pattern.compile("\\[fake-recipe-fit:(\\{.*})]", Pattern.DOTALL);

    /** Scripted narrative (V2.2): {@code [fake-summary:…]} payload becomes the summary answer. */
    public static final Pattern SUMMARY_SENTINEL =
            Pattern.compile("\\[fake-summary:([^\\]]*)]", Pattern.DOTALL);

    /** Scripted hypotheses (V3.2): {@code [fake-hypotheses:<json-array>]} in the weekly context. */
    public static final Pattern HYPOTHESES_SENTINEL =
            Pattern.compile("\\[fake-hypotheses:(\\[.*?\\])]", Pattern.DOTALL);

    /** Scripted critique (V3.2): {@code [fake-critique:{…}]} planted in the hypothesis title. */
    public static final Pattern CRITIQUE_SENTINEL =
            Pattern.compile("\\[fake-critique:(\\{.*?\\})]", Pattern.DOTALL);

    /** Scripted revision (V3.2): {@code [fake-revise:{…}]} planted in the hypothesis title. */
    public static final Pattern REVISE_SENTINEL =
            Pattern.compile("\\[fake-revise:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of BriefingGenerator.BRIEFING_MARKER (feature/proactive) — a LITERAL, not an
     *  import: companion→proactive would be a NEW package cycle (feature_slices_are_cycle_free).
     *  Drift is caught loudly by BriefingGeneratorIT (echo answer -> parse fails -> null row). */
    public static final String BRIEFING_MARKER_MIRROR = "REGGELI-BRIEFING-FELADAT";

    /** Scripted briefing (B1.1): {@code [fake-briefing:{…}]} planted via a check-in note. */
    public static final Pattern BRIEFING_SENTINEL =
            Pattern.compile("\\[fake-briefing:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of WeeklySuggestionGenerator.WEEKLY_SUGGESTION_MARKER (feature/proactive) — a
     *  LITERAL, not an import (package-cycle rule; drift fails WeeklySuggestionGeneratorIT loudly). */
    public static final String WEEKLY_MARKER_MIRROR = "HETI-TERVJAVASLAT";

    /** Scripted weekly prose (W1): {@code [fake-weekly:…]} planted via a check-in note. */
    public static final Pattern WEEKLY_SENTINEL =
            Pattern.compile("\\[fake-weekly:([^\\]]*)]", Pattern.DOTALL);

    /** Mirror of MemoirGenerator.MEMOIR_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String MEMOIR_MARKER_MIRROR = "HETI-MEMOIR-FELADAT";

    /** Scripted memoir (W2): {@code [fake-memoir:{…}]} planted via a daily-summary narrative. */
    public static final Pattern MEMOIR_SENTINEL =
            Pattern.compile("\\[fake-memoir:(\\{.*?\\})]", Pattern.DOTALL);

    /** Mirror of HeartbeatGenerator.HEARTBEAT_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String HEARTBEAT_MARKER_MIRROR = "NAPKOZBENI-JEGYZET-FELADAT";

    /** Scripted heartbeat prose (H1): {@code [fake-heartbeat:…]} planted via a check-in note. */
    public static final Pattern HEARTBEAT_SENTINEL =
            Pattern.compile("\\[fake-heartbeat:([^\\]]*)]", Pattern.DOTALL);

    /** Mirror of PredictionGenerator.PREDICTION_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String PREDICTION_MARKER_MIRROR = "HETI-PREDIKCIO-FELADAT";

    /** Scripted predictions JSON (P1): {@code [fake-prediction:{…}]} planted via a check-in note.
     *  GREEDY (unlike memoir) — the payload {@code {"predictions":[{…}]}} nests objects, so the
     *  match must run to the LAST brace, not the first. */
    public static final Pattern PREDICTION_SENTINEL =
            Pattern.compile("\\[fake-prediction:(\\{.*\\})]", Pattern.DOTALL);

    /** Mirror of ExperimentProposalGenerator.EXPERIMENT_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String EXPERIMENT_MARKER_MIRROR = "N1-KISERLET-FELADAT";

    /** Scripted experiments JSON (P2): {@code [fake-experiment:{…}]} planted via a check-in note.
     *  GREEDY like predictions — the payload {@code {"experiments":[{…}]}} nests objects. */
    public static final Pattern EXPERIMENT_SENTINEL =
            Pattern.compile("\\[fake-experiment:(\\{.*\\})]", Pattern.DOTALL);

    /** Mirror of ChallengeGenerator.CHALLENGE_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String CHALLENGE_MARKER_MIRROR = "EDZES-KIHIVAS-FELADAT";

    /** Scripted challenges JSON: {@code [fake-challenge:{…}]} planted via a check-in note.
     *  GREEDY like predictions/experiments — the payload {@code {"challenges":[{…}]}} nests objects. */
    public static final Pattern CHALLENGE_SENTINEL =
            Pattern.compile("\\[fake-challenge:(\\{.*\\})]", Pattern.DOTALL);

    /** Mirror of ActivityClassifier.CLASSIFY_MARKER (feature/activity) — LITERAL, cycle rule. */
    public static final String ACTIVITY_MARKER_MIRROR = "TEVEKENYSEG-BESOROLAS-FELADAT";

    /** Scripted classification (E2): {@code [fake-activity:{…}]} planted in the entry text. */
    public static final Pattern ACTIVITY_SENTINEL =
            Pattern.compile("\\[fake-activity:(\\{.*\\}|[^\\]]*)]", Pattern.DOTALL);

    /** Mirror of QuestFlavor.FLAVOR_MARKER (feature/quest) — LITERAL, cycle rule. */
    public static final String QUEST_FLAVOR_MARKER_MIRROR = "KULDETES-IZESITES-FELADAT";

    /** Scripted flavor rewrite (E3): {@code [fake-quest-flavor:[…]]} planted in a quest title.
     *  GREEDY — the payload is a JSON array of objects. Default [] = no rewrite, so unscripted
     *  cron runs keep catalog copy deterministically. */
    public static final Pattern QUEST_FLAVOR_SENTINEL =
            Pattern.compile("\\[fake-quest-flavor:(\\[.*\\]|[^\\]]*)]", Pattern.DOTALL);

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
        if (systemPrompt.startsWith(BRIEFING_MARKER_MIRROR)) {
            Matcher m = BRIEFING_SENTINEL.matcher(userMessage);
            // default = valid minimal JSON so the un-scripted happy path still persists a row
            return m.find() ? m.group(1)
                    : "{\"eyebrow\":\"Fake briefing\",\"body\":[\"FAKE-BRIEFING-NARRATÍVA\"],\"refIndexes\":[]}";
        }
        if (systemPrompt.startsWith(WEEKLY_MARKER_MIRROR)) {
            Matcher m = WEEKLY_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-HETI-TERVJAVASLAT";
        }
        if (systemPrompt.startsWith(MEMOIR_MARKER_MIRROR)) {
            Matcher m = MEMOIR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1)
                    : "{\"title\":\"Fake memoir\",\"body\":\"FAKE-MEMOIR-NARRATÍVA\",\"anchorIndexes\":[]}";
        }
        if (systemPrompt.startsWith(HEARTBEAT_MARKER_MIRROR)) {
            Matcher m = HEARTBEAT_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-NAPKOZBENI-JEGYZET";
        }
        if (systemPrompt.startsWith(PREDICTION_MARKER_MIRROR)) {
            Matcher m = PREDICTION_SENTINEL.matcher(userMessage);
            // default = one valid minimal row so the un-scripted happy path still persists
            return m.find() ? m.group(1)
                    : "{\"predictions\":[{\"title\":\"Fake predikció\",\"basis\":\"FAKE-ALAP\","
                            + "\"patternIndex\":0,\"metricKey\":\"weight_trend\","
                            + "\"expectedDirection\":\"down\"}]}";
        }
        if (systemPrompt.startsWith(EXPERIMENT_MARKER_MIRROR)) {
            Matcher m = EXPERIMENT_SENTINEL.matcher(userMessage);
            // default = one valid minimal proposal so the un-scripted happy path still persists
            return m.find() ? m.group(1)
                    : "{\"experiments\":[{\"title\":\"Fake kísérlet\",\"hypothesis\":\"FAKE-HIPOTÉZIS\","
                            + "\"patternIndex\":0,\"metricKey\":\"sleep_avg\","
                            + "\"expectedDirection\":\"up\",\"totalDays\":7}]}";
        }
        if (systemPrompt.startsWith(CHALLENGE_MARKER_MIRROR)) {
            Matcher m = CHALLENGE_SENTINEL.matcher(userMessage);
            // default = one valid minimal PR proposal so the un-scripted happy path still persists
            return m.find() ? m.group(1)
                    : "{\"challenges\":[{\"exerciseIndex\":0,\"type\":\"PR\",\"targetWeightKg\":107.5,"
                            + "\"targetReps\":8,\"risk\":\"low\",\"why\":\"FAKE-INDOK\",\"glory\":\"FAKE-DICS\","
                            + "\"refIndexes\":[0],\"patternIndex\":0}]}";
        }
        if (systemPrompt.startsWith(ACTIVITY_MARKER_MIRROR)) {
            Matcher m = ACTIVITY_SENTINEL.matcher(userMessage);
            // default = valid confident classification so the un-scripted happy path categorizes
            return m.find() ? m.group(1)
                    : "{\"skillKey\":\"learning\",\"confidence\":0.9,\"xpSuggestion\":15,"
                            + "\"durationMin\":null,\"amountHuf\":null}";
        }
        if (systemPrompt.startsWith(QUEST_FLAVOR_MARKER_MIRROR)) {
            Matcher m = QUEST_FLAVOR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "[]";
        }
        if (systemPrompt.startsWith(HypothesisPipelineService.HYPOTHESIS_MARKER)) {
            Matcher m = HYPOTHESES_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "[]";
        }
        if (systemPrompt.startsWith(HypothesisPipelineService.CRITIQUE_MARKER)) {
            // sentinels script the HYPOTHESIS under judgement, never the shared weekly context
            Matcher m = CRITIQUE_SENTINEL.matcher(userMessage.split("KONTEXTUS:", 2)[0]);
            // default GOOD critique — the keep path is the e2e baseline; script to steer
            return m.find() ? m.group(1)
                    : "{\"statistical\":0.8,\"confounders\":0.8,\"l3align\":0.8,\"actionability\":0.8,\"reasoning\":\"rendben\"}";
        }
        if (systemPrompt.startsWith(HypothesisPipelineService.REVISE_MARKER)) {
            Matcher m = REVISE_SENTINEL.matcher(userMessage.split("KONTEXTUS:", 2)[0]);
            return m.find() ? m.group(1) : "{}";
        }
        // Scrape extraction (mezo-8vum): the served product-page text embeds [fake-scrape:{json}];
        // returning the JSON verbatim runs the real fetch->strip->prompt->parse path. A page WITHOUT
        // the sentinel falls through to the prompt echo below (unparseable -> 502), as ITs assert.
        Matcher scrape = SCRAPE_SENTINEL.matcher(userMessage);
        if (scrape.find()) {
            return scrape.group(1);
        }
        // Meal draft (mezo-78rn) text-only path: a [fake-meal:{json}] planted in the user text is
        // returned verbatim; the multimodal override handles the photo path (sentinel in the bytes).
        Matcher meal = MEAL_SENTINEL.matcher(userMessage);
        if (meal.find()) {
            return meal.group(1);
        }
        // Recipe breakdown prose (mezo-bw3y): sentinel planted in the recipe name; no sentinel ->
        // prompt echo -> unparseable -> deterministic-envelope degrade (as the ITs assert).
        Matcher recipeFit = RECIPE_FIT_SENTINEL.matcher(userMessage);
        if (recipeFit.find()) {
            return recipeFit.group(1);
        }
        return PREFIX + " system=[" + systemPrompt + "] user=[" + userMessage + "]"
                + String.join("", toolEchoes(userMessage, tools, toolContext));
    }

    @Override
    public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        Matcher meal = MEAL_SENTINEL.matcher(userMessage == null ? "" : userMessage);
        if (meal.find()) {
            return meal.group(1);
        }
        if (imageBytes != null) {
            // A "photo" in ITs is just the UTF-8 sentinel text — decode and re-match so photo-only
            // ITs drive canned JSON through the real multipart plumbing.
            Matcher img = MEAL_SENTINEL.matcher(new String(imageBytes, StandardCharsets.UTF_8));
            if (img.find()) {
                return img.group(1);
            }
        }
        return complete(systemPrompt, userMessage);
    }

    @Override
    public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
        // Photo import (mezo-d8tr): a "photo" in ITs is the UTF-8 sentinel text — decode EVERY
        // image so the two-photo path is exercised; no sentinel -> prompt echo -> the caller's
        // parse fails -> 502, which is exactly the extraction-failure path ITs assert.
        for (InlineImage img : images) {
            Matcher m = PHOTO_SENTINEL.matcher(new String(img.bytes(), StandardCharsets.UTF_8));
            if (m.find()) {
                return m.group(1);
            }
        }
        return complete(systemPrompt, userMessage);
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
