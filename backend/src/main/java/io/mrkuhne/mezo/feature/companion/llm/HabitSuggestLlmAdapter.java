package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.api.dto.SkillLevel;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.service.HabitCatalogService;
import io.mrkuhne.mezo.feature.habit.service.HabitSuggestPort;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Companion-side smart-model adapter for the habit-owned {@link HabitSuggestPort} (mezo-n5e9.3,
 * ADR 0019). Gated on the THREE-way array (the {@code SlotPlanLlmAdapter}/{@code
 * StackPlacementLlmAdapter} two-switch idiom, extended by one): with {@code
 * HABIT_AI_SUGGEST_SWITCH}, {@code COMPANION_SWITCH} or {@code HABIT_SWITCH} off there is no
 * adapter bean, so {@code HabitAiService}'s {@code ObjectProvider<HabitSuggestPort>} is empty and
 * the endpoint degrades to a clean 503 rather than a 500 — no manual flag read needed in the
 * service itself.
 *
 * <p>Propose-only (ADR 0019): the model only ever proposes; nothing here writes a {@code
 * habit_def} row — accepting a suggestion goes through the normal {@code createHabitDef} path.
 * Every proposal is grounded in and STRICTLY validated against the caller's own data (existing
 * LIFE skills with real XP, existing chain keys) so a hallucinated identifier can never reach the
 * client; xp is clamp-rejected to the contract's 5..15 band. Runs on the SMART tier ({@link
 * CompanionLlm#completeSmart}, ADR 0008) — this is a one-shot propose call, not a chat turn.
 * Defensive parsing all the way down (the {@code HypothesisPipelineService#propose} pattern): a
 * broken LLM call or unparseable JSON degrades to zero suggestions, never a 5xx.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.HABIT_AI_SUGGEST_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.HABIT_SWITCH},
    havingValue = "true")
public class HabitSuggestLlmAdapter implements HabitSuggestPort {

    /** Prompt marker the fake LLM keys its deterministic answer on (companion-fake profile). */
    public static final String SUGGEST_MARKER = "[habit-suggest]";

    private static final int MIN_XP = 5;
    private static final int MAX_XP = 15;
    private static final String NO_DATA = "nincs adat";

    private static final String SYSTEM_PROMPT = SUGGEST_MARKER + """
            . Azonosság-választó vagy: {{NÉV}} szokás-rendszerének (rutin-láncok) bővítésén dolgozol.
            Az alábbi kontextus (skillek, aktuális cél, meglévő láncok és a bennük élő szokások)
            alapján javasolj legfeljebb %d ÚJ szokást, amelyek KIEGÉSZÍTIK a meglévő láncokat —
            SOHA ne javasolj már létező szokás címét (sem szó szerint, sem átfogalmazva). Minden
            javaslatot horgonyozz egy meglévő szokáshoz (anchorCopy: mikor / mi után jön, pl.
            "reggeli után"). A skillKey KIZÁRÓLAG a megadott [Skillek] listából jöhet, a chainKey
            KIZÁRÓLAG a megadott láncok kulcsai közül, az xp essen 5 és 15 közé.
            Minden javaslat egy szokás-recept. Válassz keretet:
            - "FOGG": add meg az anchorCopy-t ("miután …" pillanat) és a celebration-t (azonnali ünneplés).
            - "CLEAR": add meg a cue-t (mikor és hol), a craving-et (miért vonzó) és a reward-ot.
            A framework mezőt mindig töltsd ki. Válaszolj
            KIZÁRÓLAG JSON tömbbel, pontosan ebben a formában:
            [{"title":"...","why":"...","anchorCopy":"...","skillKey":"...","xp":10,"chainKey":"...",
            "framework":"FOGG","cue":"...","craving":"...","reward":"...","celebration":"..."}]
            Ha nincs értelmes javaslat: []""";

    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final ProgressionService progressionService;
    private final GoalRepository goalRepository;
    /** HabitCatalogService carries its own HABIT_SWITCH gate (companion↔habit switch-independence
     *  idiom, the {@code ContextSnapshotAssembler#habitService} precedent) — this adapter's own
     *  three-way gate already requires HABIT_SWITCH, so the bean is present in practice; {@link
     *  ObjectProvider#getObject()} is fine (never actually throws) rather than a defensive
     *  null-check + manual 503. */
    private final ObjectProvider<HabitCatalogService> habitCatalogServiceProvider;
    private final PromptPersona promptPersona;

    @Override
    public List<Suggestion> suggest(UUID userId, String chainKey, String hint) {
        HabitCatalogService habitCatalogService = habitCatalogServiceProvider.getObject();
        List<HabitChainEntity> chains = habitCatalogService.chains(userId);
        List<HabitDefEntity> defs = habitCatalogService.activeOrderedWithoutBootstrap(userId);
        List<SkillLevel> groundedSkills = groundedLifeSkills(progressionService.getProfile(userId));

        Set<String> groundedSkillKeys =
                groundedSkills.stream().map(SkillLevel::getSkillKey).collect(Collectors.toSet());
        Set<String> chainKeys =
                chains.stream().map(HabitChainEntity::getChainKey).collect(Collectors.toSet());

        String context = buildContext(userId, chains, defs, groundedSkills, chainKeys, chainKey, hint);
        String prompt =
                promptPersona.render(userId, String.format(Locale.ROOT, SYSTEM_PROMPT, properties.habitSuggest().maxSuggestions()));

        return propose(userId, prompt, context).stream()
                .filter(Objects::nonNull)
                .filter(s -> s.title() != null && !s.title().isBlank())
                .filter(s -> s.skillKey() != null && !s.skillKey().isBlank())
                .filter(s -> groundedSkillKeys.contains(s.skillKey()))
                .filter(s -> s.chainKey() != null && chainKeys.contains(s.chainKey()))
                .filter(s -> s.xp() >= MIN_XP && s.xp() <= MAX_XP)
                .limit(properties.habitSuggest().maxSuggestions())
                .toList();
    }

    /** The {@code HypothesisPipelineService#propose} pattern VERBATIM: smart-tier call tagged for
     *  the audit log, bracket-substring extraction, degrade-to-empty on either failure. */
    private List<Suggestion> propose(UUID userId, String prompt, String context) {
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("habit_ai_suggest", "propose", null, null),
                    () -> companionLlm.completeSmart(prompt, context));
        } catch (Exception e) {
            log.warn("Habit-suggest proposal LLM call failed for user {}", userId, e);
            return List.of();
        }
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<List<Suggestion>>() {});
        } catch (Exception e) {
            log.warn("Habit-suggest proposal was not parseable JSON — dropping: {}", raw, e);
            return List.of();
        }
    }

    private String buildContext(UUID userId, List<HabitChainEntity> chains, List<HabitDefEntity> defs,
            List<SkillLevel> groundedSkills, Set<String> chainKeys, String chainKey, String hint) {
        StringBuilder b = new StringBuilder();
        b.append(skillsBlock(groundedSkills)).append('\n');
        b.append(goalBlock(userId)).append('\n');
        b.append(routinesBlock(chains, defs));
        // Never echo unvalidated input into the prompt: an unknown/stale chainKey (the caller's
        // own client-side state can drift — a chain deleted since the client last read the
        // catalog) is silently omitted rather than handed to the model as if it were real.
        if (chainKey != null && !chainKey.isBlank() && chainKeys.contains(chainKey)) {
            b.append("\n[Preferált lánc] ").append(chainKey);
        }
        if (hint != null && !hint.isBlank()) {
            b.append("\n[Szándék] ").append(hint);
        }
        return b.toString();
    }

    private static String skillsBlock(List<SkillLevel> groundedSkills) {
        if (groundedSkills.isEmpty()) {
            return "[Skillek] " + NO_DATA;
        }
        return "[Skillek] " + groundedSkills.stream()
                .map(s -> s.getSkillKey() + " L" + s.getLevel())
                .collect(Collectors.joining(", "));
    }

    private String goalBlock(UUID userId) {
        return goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
                .findFirst()
                .map(g -> "[Cél] " + g.getTitle() + " (" + g.getTrajectory() + ")")
                .orElse("[Cél] " + NO_DATA);
    }

    /** Per chain: key, title, daypart, and its existing def titles — the model must NOT re-suggest
     *  any of them (verbatim or paraphrased); the system prompt carries that instruction. */
    private static String routinesBlock(List<HabitChainEntity> chains, List<HabitDefEntity> defs) {
        if (chains.isEmpty()) {
            return "[Rutinok] " + NO_DATA;
        }
        Map<UUID, List<HabitDefEntity>> byChain =
                defs.stream().collect(Collectors.groupingBy(HabitDefEntity::getChainId));
        String lines = chains.stream()
                .map(c -> "- " + c.getChainKey() + " (" + c.getTitle() + ", " + c.getDaypart()
                        + "): meglévő szokások — " + titlesOf(byChain.get(c.getId())))
                .collect(Collectors.joining("\n"));
        return "[Rutinok] (a felsorolt szokás-címeket TILOS újra javasolni)\n" + lines;
    }

    private static String titlesOf(List<HabitDefEntity> defs) {
        if (defs == null || defs.isEmpty()) {
            return "nincs még szokás";
        }
        return defs.stream().map(HabitDefEntity::getTitle).collect(Collectors.joining(", "));
    }

    /** Highest-level-with-real-XP LIFE skills — the 0-XP taxonomy ghosts excluded (the {@code
     *  ContextSnapshotAssembler#topSkills} precedent): a skill the user has never touched must not
     *  read as a fabricated grounding fact, AND doubles as the suggestion's skillKey whitelist. */
    private static List<SkillLevel> groundedLifeSkills(ProgressionProfileResponse profile) {
        return profile.getLife().stream()
                .filter(s -> s.getCumulativeXp() != null && s.getCumulativeXp() > 0)
                .toList();
    }
}
