package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.api.dto.HabitSuggestRequest;
import io.mrkuhne.mezo.api.dto.HabitSuggestResponse;
import io.mrkuhne.mezo.api.dto.HabitSuggestion;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * AI habit suggester (propose-only, mezo-n5e9.3, ADR 0019): the model never writes — accepting a
 * suggestion goes through the normal {@code createDef} path. {@link HabitSuggestPort} is the
 * habit-owned port; the companion feature provides the smart-model adapter (Task 2), so habit
 * never imports {@code feature.companion} (ADR 0012 keeps the slice-cycle rule closed).
 *
 * <p>Gated on {@code HABIT_SWITCH} — the SAME switch as {@code HabitController} — because this
 * bean is a plain constructor-injected field on that controller (no {@link ObjectProvider} at
 * that boundary); it must exist whenever the controller does. The port itself is reached through
 * an {@link ObjectProvider} because the adapter's own bean additionally gates on
 * {@code HABIT_AI_SUGGEST_SWITCH} AND {@code COMPANION_SWITCH} (array-AND'ed, like
 * {@code SlotPlanLlmAdapter}/{@code StackPlacementLlmAdapter}) — either off means no adapter bean,
 * so this degrades to a clean 503 rather than a 500.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitAiService {

    private static final int MIN_XP = 5;
    private static final int MAX_XP = 15;

    private final ObjectProvider<HabitSuggestPort> port;

    public HabitSuggestResponse suggest(UUID userId, HabitSuggestRequest request) {
        HabitSuggestPort suggestPort = port.getIfAvailable();
        if (suggestPort == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("HABIT_AI_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        List<HabitSuggestPort.Suggestion> suggestions =
                suggestPort.suggest(userId, request.getChainKey(), request.getHint());

        HabitSuggestResponse response = new HabitSuggestResponse();
        response.setSuggestions(sanitize(suggestions));
        return response;
    }

    /**
     * Defensive last line before the API boundary: drops anything out of the contract's bounds
     * even though the adapter also filters (ADR 0019 — propose-only, never trust the model
     * blindly all the way to the client).
     */
    private List<HabitSuggestion> sanitize(List<HabitSuggestPort.Suggestion> suggestions) {
        List<HabitSuggestion> result = new ArrayList<>();
        for (HabitSuggestPort.Suggestion s : suggestions) {
            if (s.xp() < MIN_XP || s.xp() > MAX_XP) {
                continue;
            }
            if (s.chainKey() == null || s.chainKey().isBlank()) {
                continue;
            }
            if (s.skillKey() == null || s.skillKey().isBlank()) {
                continue;
            }
            HabitSuggestion dto = new HabitSuggestion();
            dto.setTitle(s.title());
            dto.setWhy(s.why());
            dto.setAnchorCopy(s.anchorCopy());
            dto.setSkillKey(s.skillKey());
            dto.setXp(s.xp());
            dto.setChainKey(s.chainKey());
            dto.setFramework(toFrameworkEnum(s.framework()));
            dto.setCue(s.cue());
            dto.setCraving(s.craving());
            dto.setReward(s.reward());
            dto.setCelebration(s.celebration());
            result.add(dto);
        }
        return result;
    }

    /**
     * Defensive mapping to the contract enum (propose-only, ADR 0019 — never trust the model's
     * string verbatim): an unknown/hallucinated value degrades to {@code null} rather than a 5xx,
     * same tone as the rest of this method's filtering.
     */
    private static HabitSuggestion.FrameworkEnum toFrameworkEnum(String framework) {
        if (framework == null || framework.isBlank()) {
            return null;
        }
        return HabitSuggestion.FrameworkEnum.fromValue(framework);
    }
}
