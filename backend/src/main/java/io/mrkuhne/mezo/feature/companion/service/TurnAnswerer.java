package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit.ToolOutcome;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

/**
 * Answers the turn on the SMART tier (spec 2026-09-16 §6.5). Builds the volatile prompt half —
 * today's context plus the {@link ToolOutcomeDigest} of what the plan's tool calls actually
 * returned — and, for an ANALYSIS turn with a replan lap still available, appends the DATA-GAP
 * OFFER: an escape hatch letting the model ask for more data instead of guessing past the tool
 * results it was given. {@link #answer}/{@link #answerStream} are thin delegations to {@link
 * CompanionLlm}'s smart-tier calls — tagging the SSE stream and deciding whether to actually take
 * the replan lap are the caller's job, not this class's.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class TurnAnswerer {

    /**
     * Public: the answer's own literal, single-line "I need more data" marker (spec §A2). Also
     * the prefix the fake keys its data-gap dispatch on and {@link #dataGapReason} parses.
     */
    public static final String DATA_GAP_MARKER = "[TOVÁBBI-ADAT:";

    /**
     * Appended to the volatile half of an ANALYSIS turn that may still replan — offers the model
     * the {@link #DATA_GAP_MARKER} escape hatch instead of answering past insufficient tool
     * results. NOT offered again on the replan lap itself ({@link #buildReplanVolatile} carries
     * {@link #REPLAN_DONE_BLOCK} instead) — the marker must not be usable a second time.
     */
    static final String DATA_GAP_OFFER = """


        [Adathiány] Ha a fenti eszköz-eredmények nem elegendők a kérdés megválaszolásához, a teljes \
        válaszod legyen KIZÁRÓLAG egyetlen sor, pontosan ebben a formában: [TOVÁBBI-ADAT: mi hiányzik]. \
        Ha elegendők, válaszolj normálisan, és ezt a jelölőt soha ne írd le.""";

    /**
     * Appended to the volatile half of the replan lap's answering call — tells the model its
     * requested data now sits in the (merged) tool-outcome digest and the {@link
     * #DATA_GAP_MARKER} escape hatch is spent.
     */
    static final String REPLAN_DONE_BLOCK = """


        [PÓTLÁS] A kért kiegészítő adatok fent vannak az eszköz-eredmények között. Most válaszolj a \
        kérdésre; a [TOVÁBBI-ADAT jelölő többé nem használható.""";

    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;

    /**
     * turnContext + the tool-outcome digest, budgeted per {@code turn.answerer}, plus the
     * data-gap offer for an ANALYSIS turn that may still replan. Lap-2 callers pass {@code
     * replanStillAllowed=false} here and append {@link #REPLAN_DONE_BLOCK} themselves via {@link
     * #buildReplanVolatile}.
     */
    public String buildVolatile(String turnContext, List<ToolOutcome> outcomes, TurnGear gear,
                                boolean replanStillAllowed) {
        String digest = renderDigest(outcomes);
        String offer = gear == TurnGear.ANALYSIS && replanStillAllowed ? DATA_GAP_OFFER : "";
        return turnContext + "\n\n" + digest + offer;
    }

    /** Same shape as {@link #buildVolatile}, minus the offer, plus {@link #REPLAN_DONE_BLOCK}. */
    public String buildReplanVolatile(String turnContext, List<ToolOutcome> mergedOutcomes) {
        return turnContext + "\n\n" + renderDigest(mergedOutcomes) + REPLAN_DONE_BLOCK;
    }

    private String renderDigest(List<ToolOutcome> outcomes) {
        CompanionProperties.Turn.Answerer answererConfig = properties.turn().answerer();
        return ToolOutcomeDigest.render(outcomes, answererConfig.outcomeMaxCharsPerResult(),
            answererConfig.outcomeMaxCharsTotal());
    }

    /** One {@code completeSmart} call — no tagging, no logic; the caller owns those. */
    public String answer(String systemPrompt, String volatileHalf, List<Turn> history, String userMessage) {
        return companionLlm.completeSmart(systemPrompt, volatileHalf, history, userMessage);
    }

    /** Streamed twin of {@link #answer}. */
    public Flux<String> answerStream(String systemPrompt, String volatileHalf, List<Turn> history,
                                     String userMessage) {
        return companionLlm.streamSmart(systemPrompt, volatileHalf, history, userMessage);
    }

    /**
     * Non-empty iff the TRIMMED answer STARTS WITH {@link #DATA_GAP_MARKER} — a marker appearing
     * mid-answer is not a gap request, just leaked prompt vocabulary. The reason is the text up to
     * the marker's closing {@code ]}; a missing {@code ]} yields the rest of the string. Both are
     * trimmed.
     */
    public static Optional<String> dataGapReason(String answer) {
        if (answer == null || answer.isBlank()) {
            return Optional.empty();
        }
        String trimmed = answer.trim();
        if (!trimmed.startsWith(DATA_GAP_MARKER)) {
            return Optional.empty();
        }
        String rest = trimmed.substring(DATA_GAP_MARKER.length());
        int closeIndex = rest.indexOf(']');
        String reason = closeIndex >= 0 ? rest.substring(0, closeIndex) : rest;
        return Optional.of(reason.trim());
    }
}
