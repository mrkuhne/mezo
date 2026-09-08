package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import java.util.regex.Pattern;
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
 * <p><b>The card is never dropped.</b> An exception, a blank answer, an ungrounded numeral, or
 * formal address ({@link #FORMAL_ADDRESS}, mezo-m4m0) all fall back to
 * {@code candidate.fallbackProse()} — the exact text that shipped pre-S4 — so an LLM outage or a
 * register slip degrades the card's wording, never its delivery (spec §7).
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

    /** Visible so {@code AdviceProseGeneratorIT} can pin the two LOAD-BEARING halves (the
     *  {@code MemoirPromptTest} precedent): the {@link #ADVICE_MARKER} PREFIX the fake LLM
     *  dispatches on, and the shared register rule. {@link PromptPersona#VOICE_HU} is appended to
     *  the instruction BODY (mezo-m4m0) — putting it anywhere near the front would shift the
     *  marker prefix and silently unhook every fake-backed advice test. */
    public static final String ADVICE_PROMPT = ADVICE_MARKER + "\n"
            + "Írj 2-3 mondatos magyar tanácsot {{NÉV}} számára, kizárólag a megadott TÉNYEK és "
            + "JAVASLATOK alapján. (1) A tényeket a kártya külön listában mutatja, ezért SZÁMOT "
            + "NE ÍRJ LE a szövegben — fogalmazz szavakkal. (2) Új tényt, új számot vagy új "
            + "teendőt kitalálni tilos. (3) Ne szidj és ne ijesztgess: nevezd meg, mi történt, és "
            + "mondd meg, mi a következő apró lépés. (4) Gyógyszer adagolására vonatkozó "
            + "változtatást SOHA ne javasolj — az orvosi döntés. (5) Sima folyószöveggel "
            + "válaszolj, markdown és felsorolás nélkül." + PromptPersona.VOICE_HU;

    /**
     * The polite-pronoun forms — the only UNMISTAKABLE formal-address markers Hungarian has
     * (mezo-m4m0). Deliberately NOT {@code \b}-delimited: Java's {@code \b} is ASCII-only unless
     * {@code UNICODE_CHARACTER_CLASS} is on, so {@code \bön} would happily fire on the "ön"
     * inside "köszönöm" (the s→ö transition IS an ASCII word boundary). Explicit Unicode
     * lookarounds instead, hyphen included, so prefix compounds ("önbizalom", "önismeret",
     * "ön-kép") and the "ön" buried in "köszönöm" / "külön" / "ösztönöz" / "bőrönd" cannot match.
     *
     * <p>The SUFFIXED forms accept either an upper- or a lowercase initial — orthography wants
     * "Önnek", but nothing forces a model to obey it, and no Hungarian word IS "önnek" / "önnél"
     * / "öntől". The bare "Ön" and "Önt" DO require the capital, because lowercase "önt" is the
     * verb "pours". For the same reason {@code -ként} is left out of the suffix list: "önként"
     * means "voluntarily". Only front-vowel suffixes are listed, since that is the only harmony
     * "Ön" takes.
     *
     * <p><b>What this guard deliberately does NOT look for: the formal imperative</b>
     * ({@code -jon/-jen/-jön}, e.g. "feküdjön"). That suffix is also the ordinary third-person
     * subjunctive every informal Hungarian sentence uses ("hogy a tested pihenjen", "hadd
     * aludjon"), and plain nouns end in it too ("vajon", "olajon", "tejen"). A check on it would
     * downgrade CORRECT informal prose to the template — the one failure mode this guard must
     * never have. The prompt rule above is what covers the verb forms.
     */
    private static final Pattern FORMAL_ADDRESS = Pattern.compile(
            "(?<![\\p{L}\\p{M}-])(?:Ön(?:t|ök)?"
            + "|[Öö]n(?:ök)?(?:nek|nél|nel|ről|re|ben|be|ből|től|höz|ig|éi|é|et|kel))"
            + "(?![\\p{L}\\p{M}-])");

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
        // mezo-m4m0: the register is enforced the same way the numerals are — the prompt asks,
        // this deterministic post-check verifies, and a violation reuses the SAME fallback path.
        // Safe because every fallbackProse is library/config template text, which is written
        // informally by hand: the card is never dropped, only its wording downgraded. On
        // 2026-09-08 a card shipped in formal address directly above its own informal template
        // sentence, which is the shape this closes.
        if (FORMAL_ADDRESS.matcher(prose).find()) {
            log.warn("Advice prose for user {} ({}) used formal address — template fallback",
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
