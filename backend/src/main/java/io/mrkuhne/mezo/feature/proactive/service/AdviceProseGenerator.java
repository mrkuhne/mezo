package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The advice card's prose (S4, bd mezo-d58h.4, spec §5): PURE-CODE gather (the candidate's own
 * facts + suggestions) → ONE cheap-tier {@link CompanionLlm} call → defensive checks → the text.
 * The model writes WORDING ONLY: the prompt forbids numerals outright (the numbers are shown in
 * the card's own facts list), and {@link ProseNumberGuard} enforces it afterwards.
 *
 * <p><b>The card is never dropped.</b> An exception, a blank answer, or an ungrounded numeral all
 * fall back to {@code candidate.fallbackProse()} — the exact text that shipped pre-S4 — so an LLM
 * outage degrades the card's wording, never its delivery (spec §7).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class AdviceProseGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (a companion→proactive import would be a new package cycle). Keep the two in sync;
     *  {@code AdviceProseGeneratorIT} asserts the equality. */
    public static final String ADVICE_MARKER = "TANACS-KARTYA-FELADAT";

    private static final String ADVICE_PROMPT = ADVICE_MARKER + "\n"
            + "Írj 2-3 mondatos magyar tanácsot {{NÉV}} számára, kizárólag a megadott TÉNYEK és "
            + "JAVASLATOK alapján. (1) A tényeket a kártya külön listában mutatja, ezért SZÁMOT "
            + "NE ÍRJ LE a szövegben — fogalmazz szavakkal. (2) Új tényt, új számot vagy új "
            + "teendőt kitalálni tilos. (3) Ne szidj és ne ijesztgess: nevezd meg, mi történt, és "
            + "mondd meg, mi a következő apró lépés. (4) Gyógyszer adagolására vonatkozó "
            + "változtatást SOHA ne javasolj — az orvosi döntés. (5) Sima folyószöveggel "
            + "válaszolj, markdown és felsorolás nélkül.";

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;

    /** The card's body text — model prose when it is usable, the template otherwise. Never blank. */
    public String write(UUID userId, AdviceCandidate candidate) {
        String grounding = renderGrounding(candidate);
        String answer;
        try {
            answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_advice", candidate.adviceKey(), null, null),
                () -> companionLlm.complete(promptPersona.render(userId, ADVICE_PROMPT), grounding));
        } catch (Exception e) {
            log.warn("Advice prose call failed for user {} ({}) — template fallback",
                userId, candidate.adviceKey(), e);
            return candidate.fallbackProse();
        }
        if (answer == null || answer.isBlank()) {
            log.warn("Blank advice prose for user {} ({}) — template fallback",
                userId, candidate.adviceKey());
            return candidate.fallbackProse();
        }
        String prose = answer.strip();
        if (!ProseNumberGuard.grounded(prose, grounding)) {
            log.warn("Advice prose for user {} ({}) carried an ungrounded number — template fallback",
                userId, candidate.adviceKey());
            return candidate.fallbackProse();
        }
        return prose;
    }

    /** The ONLY numbers the model is allowed to echo, and the only suggestions it may lean on. */
    private String renderGrounding(AdviceCandidate candidate) {
        StringBuilder payload = new StringBuilder("TÉNYEK:\n");
        if (candidate.facts().isEmpty()) {
            payload.append("- (nincs számszerű tény ehhez a kártyához)\n");
        } else {
            candidate.facts().forEach(fact -> payload.append("- ").append(fact).append('\n'));
        }
        payload.append("\nJAVASLATOK:\n");
        candidate.suggestions().forEach(s -> payload.append("- ").append(s).append('\n'));
        return payload.toString();
    }
}
