package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.train.service.MesoPlanFiller;
import io.mrkuhne.mezo.feature.train.service.MesoPlanLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Gemini adapter of the train-owned {@link MesoPlanLlm} port (mesocycle wizard redesign). The
 * {@code HabitSuggestLlmAdapter} idiom verbatim: SMART tier one-shot, audit-tagged, brace-substring
 * extraction, degrade-to-empty. The model receives the FIXED frames (day → group → sets) and the
 * candidate catalog (id · name · zone · type) and must only choose ids and write one sentence;
 * every pick is re-validated by {@code MesoPlanMerger} in train, so nothing here is trusted.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.MESO_PLAN_AI_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class MesoPlanLlmAdapter implements MesoPlanLlm {

    /** Prompt marker the fake LLM keys its deterministic answer on (companion-fake profile). */
    public static final String MARKER = "[meso-plan]";

    private static final String SYSTEM_PROMPT = MARKER + """
            . Hipertrófia-programozó vagy. Egy determinisztikus váz adott: napok, és naponként
            izomcsoportonként a MUNKASZETTEK száma — ezeket NEM változtathatod. A feladatod: minden
            (nap, izomcsoport) kerethez válassz 1–2 gyakorlatot KIZÁRÓLAG a megadott katalógusból
            (a `catalogId` mezővel), a felhasználó céljához igazítva (kímélés, sport, preferencia),
            és a heti két előfordulásnál lehetőleg különböző gyakorlatokat. Írj egy 1–2 mondatos
            magyar indoklást (`rationale`), ami megnevezi, mit miért választottál.
            Válaszolj KIZÁRÓLAG egy JSON objektummal, ebben a formában:
            {"rationale":"...","days":[{"day":"Hét","exercises":[{"catalogId":"<uuid>","workingSets":3}]}]}
            Ismeretlen catalogId-t vagy nem létező napot ne írj. Ne írj semmi mást a JSON körül.
            """;

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<Suggestion> propose(Request request) {
        String user = buildUserPayload(request);
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                new LlmCallContext("train_meso_plan", "generate", null, null),
                () -> companionLlm.completeSmart(SYSTEM_PROMPT, user));
        } catch (Exception e) {
            log.warn("Meso plan LLM call failed — deterministic fill stays", e);
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            Suggestion s = objectMapper.readValue(raw.substring(start, end + 1), Suggestion.class);
            return s == null ? Optional.empty() : Optional.of(s);
        } catch (Exception e) {
            log.warn("Meso plan LLM answer was not parseable JSON — dropping: {}", raw, e);
            return Optional.empty();
        }
    }

    private static String buildUserPayload(Request r) {
        StringBuilder b = new StringBuilder();
        b.append("[Cél]\n").append(r.goalText() == null || r.goalText().isBlank() ? "nincs megadva" : r.goalText()).append("\n\n");
        b.append("[Fókusz]\n").append(r.tiers() == null || r.tiers().isEmpty() ? "mind grow" : r.tiers()).append("\n\n");
        b.append("[Keretek — nap: izomcsoport=munkaszett]\n");
        for (FramedDay d : r.days()) {
            b.append(d.day()).append(" (").append(d.type()).append("): ").append(d.setsByGroup()).append('\n');
        }
        b.append("\n[Katalógus — catalogId | név | zóna | típus]\n");
        for (MesoPlanFiller.Candidate c : r.candidates()) {
            b.append(c.id()).append(" | ").append(c.name()).append(" | ").append(c.muscle()).append(" | ").append(c.type()).append('\n');
        }
        return b.toString();
    }
}
