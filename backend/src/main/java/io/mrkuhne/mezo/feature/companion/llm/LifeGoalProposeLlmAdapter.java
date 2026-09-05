package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Smart-tier adapter for {@link LifeGoalProposePort} (mezo-iizd, ADR 0019 propose-only). Gated on
 * LIFEGOAL_AI_PROPOSE_SWITCH + COMPANION_SWITCH + LIFEGOAL_SWITCH; absent bean ⇒ template. Strict
 * validation: pillars whose catalogId/skillKey are not in the caller-supplied sets are dropped; the
 * dimension must be one of the six PERMAH keys. The {@code HabitSuggestLlmAdapter#propose} pattern:
 * a failed call or unparseable JSON degrades to {@code Optional.empty()}, never a 5xx.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.LIFEGOAL_AI_PROPOSE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.LIFEGOAL_SWITCH},
    havingValue = "true")
public class LifeGoalProposeLlmAdapter implements LifeGoalProposePort {

    /** Prompt marker the fake LLM keys its deterministic answer on (companion-fake profile). */
    public static final String PROPOSE_MARKER = "[lifegoal-propose]";

    static final Set<String> DIMENSIONS =
        Set.of("positive_emotion", "engagement", "relationships", "meaning", "accomplishment", "health");
    static final Set<String> KINDS = Set.of("habit", "average", "target", "baseline", "linked");
    /** The only trigger sources anything downstream can evaluate — see the system prompt's rule 4. */
    static final Set<String> TRIGGER_SOURCES = Set.of("sport_session_logged", "checkin_energy_lte", "ritual_missed");

    // LifeGoalUpsertRequest / IfThenPlan / LifeGoalPillarInput schema maxima (api/feature/lifegoal).
    private static final int MAX_ITEMS = 5;
    private static final int MAX_LABEL = 80;
    private static final int MAX_PLAN_TEXT = 240;
    private static final int MAX_OBSTACLE = 300;

    private static final String SYSTEM_PROMPT = PROPOSE_MARKER + """
            . {{NÉV}} életcél-tervezője vagy. Kapsz egy célt és egy „miért”-et. Feladatod:
            1) Sorold be egy PERMAH-dimenzióba (positive_emotion|engagement|relationships|meaning|accomplishment|health),
               opcionális másodlagossal.
            2) Ítéld meg a keretet: ha a „miért” külső (kinézet, pénz, státusz) → frame="extrinsic", és adj
               egy belső (egészség/képesség/kapcsolat) átfogalmazást reframedWhy-ban; különben frame="intrinsic",
               reframedWhy=null. frameNote: egy magyar mondat Mezo hangján.
            3) Javasolj legfeljebb %d pillért KIZÁRÓLAG a [Jelek] listából (catalogId), a listában engedett
               fajtával (kind) és skill-lel (skillKey a [Skillek] listából). threshold/comparator az átlag és
               szokás fajtához, daysPerWeek a szokáshoz, startValue/targetValue a cél-értékhez.
            4) 1–3 akadály és 1–3 ha–akkor terv; a triggerSource csak sport_session_logged, checkin_energy_lte,
               ritual_missed vagy null lehet.
            Válaszolj KIZÁRÓLAG egy JSON objektummal:
            {"dimension":"...","secondaryDimension":null,"frame":"...","frameNote":"...","reframedWhy":null,
             "pillars":[{"catalogId":"...","label":"...","kind":"...","skillKey":"...","weight":1,"threshold":null,
             "comparator":null,"daysPerWeek":null,"startValue":null,"targetValue":null}],
             "obstacles":["..."],"plans":[{"ha":"...","akkor":"...","triggerSource":null,"triggerCondition":null,"delayHours":null}]}""";

    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;

    @Override
    public Optional<Proposal> propose(UUID userId, String title, String whyText, String catalogText,
            Set<String> catalogIds, Set<String> skillKeys) {
        String prompt = promptPersona.render(userId,
                String.format(Locale.ROOT, SYSTEM_PROMPT, properties.lifegoalPropose().maxPillars()));
        String context = "[Cél]\n" + title + "\n[Miért]\n" + (whyText == null ? "" : whyText)
            + "\n[Skillek]\n" + String.join(", ", skillKeys) + "\n[Jelek]\n" + catalogText;
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                new LlmCallContext("lifegoal_propose", "propose", null, null),
                () -> companionLlm.completeSmart(prompt, context));
        } catch (Exception e) {
            log.warn("Life-goal proposal LLM call failed for user {}", userId, e);
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        Proposal p;
        try {
            p = objectMapper.readValue(raw.substring(start, end + 1), Proposal.class);
        } catch (Exception e) {
            log.warn("Life-goal proposal was not parseable JSON — dropping: {}", raw, e);
            return Optional.empty();
        }
        if (p.dimension() == null || !DIMENSIONS.contains(p.dimension())) {
            return Optional.empty();
        }
        List<PillarProposal> pillars = (p.pillars() == null ? List.<PillarProposal>of() : p.pillars()).stream()
            .filter(Objects::nonNull)
            .filter(x -> x.catalogId() != null && catalogIds.contains(x.catalogId()))
            .filter(x -> x.kind() != null && KINDS.contains(x.kind()))
            .filter(x -> x.skillKey() != null && skillKeys.contains(x.skillKey()))
            .filter(x -> x.label() != null && !x.label().isBlank())
            .limit(properties.lifegoalPropose().maxPillars())
            .map(x -> new PillarProposal(x.catalogId(), truncate(x.label(), MAX_LABEL), x.kind(), x.skillKey(),
                x.weight(), x.threshold(), x.comparator(), x.daysPerWeek(), x.startValue(), x.targetValue()))
            .toList();
        // The propose response feeds the create request VERBATIM, so anything the LLM over-produces
        // here would 400 on save (LifeGoalUpsertRequest carries maxItems: 5 on both lists and
        // maxLength on every string) and dead-end the wizard. Clamp/truncate to the schema maxima.
        List<String> obstacles = (p.obstacles() == null ? List.<String>of() : p.obstacles()).stream()
            .filter(Objects::nonNull)
            .limit(MAX_ITEMS)
            .map(o -> truncate(o, MAX_OBSTACLE))
            .toList();
        List<PlanProposal> plans = (p.plans() == null ? List.<PlanProposal>of() : p.plans()).stream()
            .filter(Objects::nonNull)
            .limit(MAX_ITEMS)
            // An un-whitelisted triggerSource nulls the TRIGGER but KEEPS the plan: nothing in this
            // slice (or slice 2's evaluator) can act on an unknown source, and the UI would have
            // rendered the raw string as „Mezo figyeli (<source>)" — a fabricated capability claim.
            // With a null trigger it falls through to the honest „nincs hozzá jel" label instead.
            .map(LifeGoalProposeLlmAdapter::sanitizePlan)
            .toList();
        return Optional.of(new Proposal(p.dimension(),
            p.secondaryDimension() != null && DIMENSIONS.contains(p.secondaryDimension()) ? p.secondaryDimension() : null,
            "extrinsic".equals(p.frame()) ? "extrinsic" : "intrinsic", p.frameNote(), p.reframedWhy(), pillars,
            obstacles, plans));
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    /** Truncates the plan text to the schema maxima and drops a trigger nothing can evaluate. */
    private static PlanProposal sanitizePlan(PlanProposal pl) {
        // Set.of(...).contains(null) throws — guard the null source explicitly.
        boolean known = pl.triggerSource() != null && TRIGGER_SOURCES.contains(pl.triggerSource());
        return new PlanProposal(truncate(pl.ha(), MAX_PLAN_TEXT), truncate(pl.akkor(), MAX_PLAN_TEXT),
            known ? pl.triggerSource() : null, known ? pl.triggerCondition() : null, known ? pl.delayHours() : null);
    }
}
