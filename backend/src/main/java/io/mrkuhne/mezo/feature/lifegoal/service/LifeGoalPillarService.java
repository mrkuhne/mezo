package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry;
import io.mrkuhne.mezo.feature.lifegoal.config.LifeGoalProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.habit.service.HabitCatalogService;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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
    private final LifeGoalMapper mapper;
    private final SignalCatalog catalog;
    private final LifeGoalProperties props;
    private final ObjectProvider<HabitCatalogService> habitCatalog;

    /** Validates and persists the whole list, replacing the goal's current pillars. Returns the new rows. */
    @Transactional
    public List<LifeGoalPillarEntity> replace(UUID userId, LifeGoalEntity goal, List<LifeGoalPillarInput> inputs) {
        List<LifeGoalPillarInput> list = inputs == null ? List.of() : inputs;
        validate(userId, list);
        pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goal.getId()).forEach(pillarRepository::delete);
        List<LifeGoalPillarEntity> saved = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            saved.add(pillarRepository.save(mapper.toPillarEntity(list.get(i), goal, i)));
        }
        pillarRepository.flush();
        return saved;
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
        }
    }
}
