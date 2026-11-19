package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.train.service.TechniqueLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Adapter of the train-owned {@link TechniqueLlm} port (T4, {@code mezo-r36n9.82}). The {@code MesoPlanLlmAdapter}
 * idiom: SMART tier one-shot, audit-tagged ({@code train_technique / refine}), brace-substring extraction,
 * degrade-to-empty. The model gets the week's rows (eligible / challenge-candidate flags fixed by the code), the
 * planner's choice and last week's signals, and may only move techniques and challenges; every change is re-validated
 * by {@code TechniqueMerger} in train, so nothing here is trusted.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.TECHNIQUE_AI_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class TechniqueLlmAdapter implements TechniqueLlm {

    /** Prompt marker (audit / fake keying). */
    public static final String MARKER = "[technique-refine]";

    static final String SYSTEM_PROMPT = MARKER + """
            . Hipertrófia-edző vagy. Egy determinisztikus tervező már eldöntötte, a hét melyik gyakorlatán legyen
            intenzitási technika (rest_drop = pihenős drop: bukásig, 30 mp szünet, 30%-kal kisebb súly, ugyanannyi
            ismétlés; drop = klasszikus drop szett; myo = myo-szett), és melyik gyakorlat a nap kihívása (utolsó
            sorozat után félismétlések nyújtott helyzetben). A feladatod: a múlt heti adatok (napló, ízületi fájdalom,
            izomláz, megtorpanás, nehéz sorozatok) alapján finomítsd ezt — vagy hagyd, ahogy van.
            Szabályok, amiket NEM szeghetsz meg:
            - Technikát CSAK olyan sorra tehetsz, ahol "eligible": true. Kihívást CSAK "challengeCandidate": true sorra,
              ugyanazon a napon belül.
            - A "source": "owner" sorokhoz (a felhasználó saját választása) nem nyúlhatsz.
            - Egy napon legfeljebb "allowance" technikás gyakorlat lehet; izomcsoportonként hetente legfeljebb
              "maxPerMuscleWeek".
            - Sorozatszámot, ismétlést, súlyt nem változtathatsz. Csak ezek a technikák léteznek: rest_drop, myo, drop,
              none.
            - Csak akkor javasolj változást, ha jó okod van rá; minden változásnál egy rövid, barátságos magyar mondat
              indoklás (`reason`), ami a felhasználónak szól.
            Válaszolj KIZÁRÓLAG egy JSON objektummal, ebben a formában (üres listák, ha nincs változás):
            {"changes":[{"exerciseId":"<uuid>","technique":"myo","reason":"..."}],
             "challenges":[{"dayIndex":0,"exerciseId":"<uuid>","reason":"..."}]}
            Ne írj semmi mást a JSON körül.
            """;

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<Suggestion> refine(Request request) {
        String raw;
        try {
            String user = objectMapper.writeValueAsString(request);
            raw = llmCallContextHolder.runWith(
                new LlmCallContext("train_technique", "refine", null, null),
                () -> companionLlm.completeSmart(SYSTEM_PROMPT, user));
        } catch (Exception e) {
            log.warn("Technique refine LLM call failed — the planner's week stays: {}", e.toString());
            return Optional.empty();
        }
        return parse(raw);
    }

    Optional<Suggestion> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            Suggestion s = objectMapper.readValue(raw.substring(start, end + 1), Suggestion.class);
            return Optional.ofNullable(s);
        } catch (Exception e) {
            log.warn("Technique refine LLM answer was not parseable JSON — dropping: {}", raw);
            return Optional.empty();
        }
    }
}
