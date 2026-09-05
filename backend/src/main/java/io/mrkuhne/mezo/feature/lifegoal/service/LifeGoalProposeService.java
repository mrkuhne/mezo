package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.IfThenPlan;
import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalFrame;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.api.dto.PlanTrigger;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.PillarProposal;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.Proposal;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * POST /api/life-goals/propose (spec D9, mezo-iizd.1): AI port first, template second — never
 * empty, never a 5xx on AI trouble (spec §7). The {@link LifeGoalProposePort} bean is absent
 * unless every one of the LIFEGOAL_AI_PROPOSE_SWITCH / COMPANION_SWITCH / LIFEGOAL_SWITCH gates is
 * on (see {@code LifeGoalProposeLlmAdapter}'s three-way {@code @ConditionalOnProperty}); a present
 * bean can still answer {@code Optional.empty()} (LLM call failed, or every proposed pillar failed
 * validation) — either way this service falls back to {@link LifeGoalTemplateProposer}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalProposeService {

    private final ObjectProvider<LifeGoalProposePort> port;
    private final LifeGoalTemplateProposer template;
    private final SignalCatalog catalog;
    private final LifeGoalMapper mapper;

    public LifeGoalProposeResponse propose(UUID userId, LifeGoalProposeRequest req) {
        Set<String> skills = new HashSet<>(ProgressionTaxonomy.LIFE);
        skills.addAll(ProgressionTaxonomy.ATHLETIC);
        LifeGoalProposePort p = port.getIfAvailable();
        Optional<Proposal> ai = p == null ? Optional.empty()
            : p.propose(userId, req.getTitle(), req.getWhyText(), catalog.promptText(), skills);
        // The ai/template decision happens AFTER mapping: the per-pillar filters below (kind
        // whitelist, undated target drop) can empty an AI answer, and an ai-sourced response with
        // zero pillars would strand wizard step 3 (canNext needs one active pillar).
        if (ai.isPresent()) {
            LifeGoalProposeResponse aiResponse = toResponse(ai.get(), "ai", req.getTargetDate());
            if (!aiResponse.getPillars().isEmpty()) {
                return aiResponse;
            }
        }
        return toResponse(template.propose(req.getTitle(), req.getWhyText()), "template", req.getTargetDate());
    }

    private LifeGoalProposeResponse toResponse(Proposal p, String source, LocalDate goalTargetDate) {
        List<LifeGoalPillarInput> pillars = p.pillars().stream()
            // The catalog's per-entry `kinds()` whitelist is exactly what LifeGoalPillarService.validate
            // applies on save, so a pillar this response emits with a kind the entry does not allow
            // (e.g. kind=linked on sleep_duration) would answer 200 here and then 400 the wizard's
            // create. Re-check it here so an unsavable pillar never reaches the client at all.
            .flatMap(x -> catalog.byId(x.catalogId()).stream()
                .filter(e -> e.kinds().contains(x.kind()))
                // A target pillar without a deadline has no pace line — requireRuleShape would
                // 400 the save, so an undated (or already-due) target proposal is dropped rather
                // than emitted unsavable.
                .filter(e2 -> !"target".equals(x.kind())
                    || (x.startValue() != null && x.targetValue() != null
                        && goalTargetDate != null && goalTargetDate.isAfter(LocalDate.now())))
                .map(e -> LifeGoalPillarInput.builder()
                    .label(x.label()).skillKey(x.skillKey()).kind(PillarKind.fromValue(x.kind()))
                    .weight(x.weight() < 1 ? 1 : Math.min(3, x.weight()))
                    .active(true).source(mapper.toSourceDto(e.source()))
                    .rule(PillarRule.builder().threshold(x.threshold())
                        .comparator(x.comparator() == null ? null : PillarRule.ComparatorEnum.fromValue(x.comparator()))
                        .daysPerWeek(x.daysPerWeek()).windowDays(windowDaysFor(x.kind()))
                        .minDataDays("baseline".equals(x.kind()) ? 14 : null).startValue(x.startValue()).targetValue(x.targetValue())
                        // requireRuleShape needs target's full pace line (start/target date +
                        // direction) and baseline's direction; neither is on PillarProposal, so a
                        // pillar accepted verbatim would 400 on create without these being filled.
                        .startDate("target".equals(x.kind()) ? LocalDate.now() : null)
                        .targetDate("target".equals(x.kind()) ? goalTargetDate : null)
                        .direction(directionFor(x)).build())
                    .build()))
            .toList();
        return LifeGoalProposeResponse.builder()
            .dimension(LifeGoalDimension.fromValue(p.dimension()))
            .secondaryDimension(p.secondaryDimension() == null ? null : LifeGoalDimension.fromValue(p.secondaryDimension()))
            .frame(LifeGoalFrame.fromValue(p.frame())).frameNote(p.frameNote()).reframedWhy(p.reframedWhy())
            .pillars(pillars).obstacles(p.obstacles())
            .ifThenPlans(p.plans().stream().map(pl -> IfThenPlan.builder().ha(pl.ha()).akkor(pl.akkor())
                .trigger(pl.triggerSource() == null ? null : PlanTrigger.builder().source(pl.triggerSource())
                    .condition(pl.triggerCondition()).delayHours(pl.delayHours()).build()).build()).toList())
            .source(LifeGoalProposeResponse.SourceEnum.fromValue(source))
            .build();
    }

    /** target: derived from the pace (target > start ⇒ up); baseline: the fixtures' up default. */
    private static PillarRule.DirectionEnum directionFor(PillarProposal x) {
        if ("target".equals(x.kind())) {
            return x.targetValue().compareTo(x.startValue()) > 0
                ? PillarRule.DirectionEnum.UP : PillarRule.DirectionEnum.DOWN;
        }
        return "baseline".equals(x.kind()) ? PillarRule.DirectionEnum.UP : null;
    }

    /** Boxed on purpose: a plain {@code cond ? 7 : cond2 ? 28 : null} ternary mixes an int literal
     *  with a branch that can be {@code null}, which forces Java to UNBOX the null branch to match
     *  the other branch's primitive {@code int} type — an NPE for every non-average/baseline kind
     *  (e.g. "habit"). Returning {@code Integer} throughout sidesteps the mixed-type promotion. */
    private static Integer windowDaysFor(String kind) {
        if ("average".equals(kind)) {
            return 7;
        }
        if ("baseline".equals(kind)) {
            return 28;
        }
        return null;
    }
}
