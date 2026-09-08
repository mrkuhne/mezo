package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.ChatHistory;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit.ToolOutcome;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
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
 * redundancy against the injected fact block and (2) unmarked claims (mezo-q71s: specific past
 * claims with no source in the provided context AND no linguistic hedge — a marked hunch is
 * allowed, an invented concrete number never is, marked or not). Strict JSON, defensively
 * parsed, FAIL-OPEN: a broken or unreachable judge yields zero violations (availability over
 * strictness) + a warn log. Since mezo-indo the payload carries the tool OUTPUTS next to the tool
 * names ({@link ToolOutcomeDigest}, budgeted) — the v1 names-only payload made every tool-derived
 * number structurally unsupported to the judge (0% pass at every reasoning-effort level, measured
 * in mezo-9yqq class 1), which was the last known structural false-positive source in the chain.
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
            2) unmarkedClaim: állít-e a válasz MAGABIZTOSAN, JELÖLÉS NÉLKÜL konkrét múltbeli adatot vagy számot, amit sem a kontextus, sem az eszközhívások kimenete, sem a felhasználó üzenete nem támaszt alá? Ha a válasz nyelvileg jelöli a bizonytalanságot („tippelek", „gyanítom", „lehet, hogy", „ezt csak sejtem"), az NEM sértés — a jelölt sejtés megengedett. Kitalált konkrét szám viszont jelöléssel is sértés. A kontextusban szereplő adatokból számolt/becsült érték alátámasztottnak számít.
            AZ ESZKÖZKIMENETEK UGYANOLYAN FORRÁS, MINT A KONTEXTUS: az „ESZKÖZHÍVÁSOK ÉS A KIMENETÜK" blokkban szereplő adat — és a belőle számolt vagy becsült érték — alátámasztottnak számít. Ha egy kimenet mellett „[…a kimenet innen levágva]", „[a kimenet helyhiány miatt kimaradt]" vagy „[a kimenet nem ismert]" jelölés áll, akkor a kimenetet csak részben látod: pusztán abból, hogy ott nem találod a számot, NE következtess kitalálásra.
            Válaszolj KIZÁRÓLAG ezzel a JSON objektummal, magyarázat nélkül:
            {"redundantQuestion":true|false,"unmarkedClaim":true|false,"reason":"rövid indoklás"}""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final CompanionProperties properties;

    record TurnVerdict(boolean redundantQuestion, boolean unmarkedClaim, String reason) {}

    public List<AdvisorViolation> check(String turnSystemPrompt, List<Turn> history,
            String userMessage, String answer, List<ToolOutcome> toolOutcomes) {
        // A history már NEM része a system promptnak (mezo-q71s) — külön kell renderelni, különben
        // a bíráló megvakul a beszélgetésre és hamis redundancia/unmarked ítéleteket hoz.
        String payload = "KONTEXTUS:\n" + turnSystemPrompt
                + ChatHistory.render(history)
                + "\n\n" + ToolOutcomeDigest.render(toolOutcomes,
                        properties.advisors().toolResultMaxChars(),
                        properties.advisors().toolResultsTotalMaxChars())
                + "\n\nA felhasználó üzenete: " + userMessage
                + "\n\nMEZO VÁLASZA:\n" + answer;
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_advisor", "verdict_check", null, null),
                    () -> companionLlm.complete(VERDICT_PROMPT, payload));
        } catch (Exception e) {
            log.warn("Advisor verdict LLM call failed — failing open", e);
            return List.of();
        }
        TurnVerdict verdict = parse(raw);
        List<AdvisorViolation> violations = new ArrayList<>();
        if (verdict.redundantQuestion()) {
            violations.add(new AdvisorViolation("redundancy", verdict.reason()));
        }
        if (verdict.unmarkedClaim()) {
            violations.add(new AdvisorViolation("unmarked", verdict.reason()));
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
