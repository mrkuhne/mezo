package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * V1.3 combined LLM verdict — ONE cheap-tier call judging the answer for (1) never-ask-twice
 * redundancy against the injected fact block and (2) grounding-lite (specific past claims with
 * no source in the provided context). Strict JSON, defensively parsed, FAIL-OPEN: a broken or
 * unreachable judge yields zero violations (availability over strictness) + a warn log.
 * Tool results are not captured in v1 — the judge is told claims may derive from the listed
 * tool calls (conservative; the high-value catch is the no-tool fabrication case).
 */
@Slf4j
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
@RequiredArgsConstructor
public class TurnVerdictCheck {

    /** The verdict prompt's first word — the fake LLM keys its deterministic verdict on it. */
    public static final String VERDICT_MARKER = "VÁLASZ-ELLENŐRZÉS";

    static final String VERDICT_PROMPT = VERDICT_MARKER + """
            . Bíráld el a Mezo asszisztens válaszát az alábbi szempontok szerint.
            1) redundantQuestion: rákérdez-e a válasz olyasmire, amire a kontextus MEGERŐSÍTETT TÉNYEK blokkja már választ ad?
            2) ungroundedClaim: állít-e a válasz konkrét múltbeli adatot vagy számot, amit sem a kontextus, sem a felsorolt eszközhívások, sem Daniel üzenete nem támaszt alá? A kontextusban szereplő adatokból számolt/becsült érték alátámasztottnak számít.
            Válaszolj KIZÁRÓLAG ezzel a JSON objektummal, magyarázat nélkül:
            {"redundantQuestion":true|false,"ungroundedClaim":true|false,"reason":"rövid indoklás"}""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;

    record TurnVerdict(boolean redundantQuestion, boolean ungroundedClaim, String reason) {}

    public List<AdvisorViolation> check(
            String turnSystemPrompt, String userMessage, String answer, List<String> toolCallNames) {
        String payload = "KONTEXTUS:\n" + turnSystemPrompt
                + "\n\nESZKÖZHÍVÁSOK: " + (toolCallNames.isEmpty() ? "nincs" : String.join(", ", toolCallNames))
                + "\n\nDaniel üzenete: " + userMessage
                + "\n\nMEZO VÁLASZA:\n" + answer;
        String raw;
        try {
            raw = companionLlm.complete(VERDICT_PROMPT, payload);
        } catch (Exception e) {
            log.warn("Advisor verdict LLM call failed — failing open", e);
            return List.of();
        }
        TurnVerdict verdict = parse(raw);
        List<AdvisorViolation> violations = new ArrayList<>();
        if (verdict.redundantQuestion()) {
            violations.add(new AdvisorViolation("redundancy", verdict.reason()));
        }
        if (verdict.ungroundedClaim()) {
            violations.add(new AdvisorViolation("grounding", verdict.reason()));
        }
        return violations;
    }

    /** Defensive: first '{'..last '}' substring; anything unparseable is a CLEAN verdict (fail-open). */
    private TurnVerdict parse(String raw) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("Advisor verdict was not JSON — failing open: {}", raw);
            return new TurnVerdict(false, false, "");
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), TurnVerdict.class);
        } catch (Exception e) {
            log.warn("Advisor verdict JSON unparseable — failing open: {}", raw, e);
            return new TurnVerdict(false, false, "");
        }
    }
}
