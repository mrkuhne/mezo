package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry;
import io.mrkuhne.mezo.feature.lifegoal.config.LifeGoalProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarDayEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.habit.service.HabitCatalogService;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pillar list replace + the closed-catalog / skill / kind / cap validation (spec D4, D10).
 *
 * <p>Task 4 adds the habit-key check against the user's own {@code habit_def} rows. The
 * dependency on {@code HabitCatalogService} goes through {@code ObjectProvider} (never a direct
 * repository import) so that turning off {@code HABIT_SWITCH} degrades to "cannot verify" (reject
 * with the same 400) instead of breaking the Spring context — see {@code spring_patterns.md} /
 * the cross-feature-reads convention.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalPillarService {

    private static final Set<String> SKILLS = new HashSet<>();
    static {
        SKILLS.addAll(ProgressionTaxonomy.LIFE);
        SKILLS.addAll(ProgressionTaxonomy.ATHLETIC);
        SKILLS.addAll(ProgressionTaxonomy.MUSCLE);
        SKILLS.add(ProgressionTaxonomy.ROBUSTNESS);
    }

    private final LifeGoalPillarRepository pillarRepository;
    private final LifeGoalPillarDayRepository pillarDayRepository;
    private final LifeGoalMapper mapper;
    private final SignalCatalog catalog;
    private final LifeGoalProperties props;
    private final ObjectProvider<HabitCatalogService> habitCatalog;

    /**
     * Validates and persists the whole list, replacing the goal's current pillars. An input that
     * carries an {@code id} of one of the goal's live pillars UPDATES that row in place (mezo-iizd.2)
     * — identity is what the nightly {@code life_goal_pillar_day} history hangs on, so a rename must
     * not mint a fresh UUID. Inputs without an id are inserted; live pillars nobody claimed are
     * soft-deleted together with their day rows. Returns the new list in request order.
     */
    @Transactional
    public List<LifeGoalPillarEntity> replace(UUID userId, LifeGoalEntity goal, List<LifeGoalPillarInput> inputs) {
        List<LifeGoalPillarInput> list = inputs == null ? List.of() : inputs;
        validate(userId, list);
        Map<UUID, LifeGoalPillarEntity> existing = new LinkedHashMap<>();
        pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goal.getId())
            .forEach(p -> existing.put(p.getId(), p));

        List<LifeGoalPillarEntity> saved = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            LifeGoalPillarInput in = list.get(i);
            if (in.getId() == null) {
                saved.add(pillarRepository.save(mapper.toPillarEntity(in, goal, i)));
                continue;
            }
            // remove() also rejects the same id twice in one list — the second claim finds nothing.
            LifeGoalPillarEntity kept = existing.remove(in.getId());
            if (kept == null) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("LIFE_GOAL_UNKNOWN_PILLAR", "pillars").build(), HttpStatus.BAD_REQUEST);
            }
            // Identity survives a rename/retune, but the day rows only survive if they still
            // measure the same thing: a swapped source or kind makes the old hit/miss verdicts
            // incomparable, so that pillar's history is dropped rather than silently reused.
            boolean remeasured = !kept.getSource().equals(mapper.toSourceJson(in.getSource()))
                || !kept.getKind().equals(in.getKind().getValue());
            saved.add(pillarRepository.save(mapper.applyPillar(kept, in, i)));
            if (remeasured) deleteDays(List.of(kept.getId()));
        }
        deleteWithDays(existing.values());
        pillarRepository.flush();
        return saved;
    }

    /** Soft-deletes every live pillar of a goal together with its day rows (goal delete path). */
    @Transactional
    public void deleteAllForGoal(UUID goalId) {
        deleteWithDays(pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goalId));
        pillarRepository.flush();
    }

    /**
     * Soft-deletes pillars AND their {@code life_goal_pillar_day} rows — the day table has no
     * cascade of its own, and a live day row on a dead pillar would keep feeding the scorer.
     */
    private void deleteWithDays(Collection<LifeGoalPillarEntity> pillars) {
        if (pillars.isEmpty()) return;
        deleteDays(pillars.stream().map(LifeGoalPillarEntity::getId).toList());
        pillars.forEach(pillarRepository::delete);
    }

    /** Soft-deletes the nightly evaluation rows of the given pillars. */
    private void deleteDays(List<UUID> pillarIds) {
        List<LifeGoalPillarDayEntity> days = pillarDayRepository.findByPillarIdInAndDeletedFalse(pillarIds);
        if (days.isEmpty()) return;
        days.forEach(pillarDayRepository::delete);
        pillarDayRepository.flush();
    }

    public void validate(UUID userId, List<LifeGoalPillarInput> inputs) {
        if (inputs.size() > props.maxPillars()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("LIFE_GOAL_TOO_MANY_PILLARS", "pillars").build(), HttpStatus.BAD_REQUEST);
        }
        for (LifeGoalPillarInput in : inputs) {
            if (!SKILLS.contains(in.getSkillKey())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("LIFE_GOAL_UNKNOWN_SKILL", "pillars").build(), HttpStatus.BAD_REQUEST);
            }
            PillarSourceJson src = mapper.toSourceJson(in.getSource());
            if ("habit".equals(src.type())) {
                // Cross-feature read via ObjectProvider (never a direct habit-repository import):
                // an absent bean (HABIT_SWITCH off) means "cannot verify" and is rejected the same
                // way as an unknown key, rather than breaking the context.
                HabitCatalogService svc = habitCatalog.getIfAvailable();
                boolean known = svc != null && svc.activeOrderedWithoutBootstrap(userId).stream()
                    .anyMatch(d -> d.getHabitKey().equals(src.habitKey()));
                if (!known) {
                    throw new SystemRuntimeErrorException(
                        SystemMessage.field("LIFE_GOAL_UNKNOWN_SIGNAL", "pillars").build(), HttpStatus.BAD_REQUEST);
                }
                continue;
            }
            SignalCatalogEntry entry = catalog.find(src).orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.field("LIFE_GOAL_UNKNOWN_SIGNAL", "pillars").build(), HttpStatus.BAD_REQUEST));
            if (!entry.kinds().contains(in.getKind().getValue())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("LIFE_GOAL_KIND_NOT_ALLOWED", "pillars").build(), HttpStatus.BAD_REQUEST);
            }
            requireRuleShape(in);
        }
    }

    /**
     * Per-kind required rule fields (spec §5 + D-2 — the scorer's honest-absence contract only
     * holds if a well-formed rule reaches it): habit/average need threshold+comparator, target
     * needs its full pace line, baseline needs a direction; linked and habit-source pillars (see
     * the habit branch above, which `continue`s before reaching here) carry no requirement.
     */
    private void requireRuleShape(LifeGoalPillarInput in) {
        PillarRule rule = in.getRule();
        boolean ok = switch (in.getKind().getValue()) {
            case "habit", "average" -> rule != null && rule.getThreshold() != null && rule.getComparator() != null;
            case "target" -> rule != null && rule.getStartValue() != null && rule.getTargetValue() != null
                && rule.getStartDate() != null && rule.getTargetDate() != null && rule.getDirection() != null;
            case "baseline" -> rule != null && rule.getDirection() != null;
            default -> true;
        };
        if (!ok) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("LIFE_GOAL_INVALID_RULE", "pillars").build(), HttpStatus.BAD_REQUEST);
        }
    }
}
