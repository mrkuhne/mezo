package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry;
import io.mrkuhne.mezo.feature.lifegoal.config.LifeGoalProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
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
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pillar list replace + the closed-catalog / skill / kind / cap validation (spec D4, D10).
 *
 * <p>Task 4 adds the habit-key check against the user's own {@code habit_def} rows and, to do
 * that, adds {@code UUID userId} as this class's first parameter throughout — this task ships the
 * {@code "habit".equals(src.type())} skip below deliberately so that change is additive.
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

    /** Validates and persists the whole list, replacing the goal's current pillars. Returns the new rows. */
    @Transactional
    public List<LifeGoalPillarEntity> replace(LifeGoalEntity goal, List<LifeGoalPillarInput> inputs) {
        List<LifeGoalPillarInput> list = inputs == null ? List.of() : inputs;
        validate(list);
        pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goal.getId()).forEach(pillarRepository::delete);
        List<LifeGoalPillarEntity> saved = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            saved.add(pillarRepository.save(mapper.toPillarEntity(list.get(i), goal, i)));
        }
        pillarRepository.flush();
        return saved;
    }

    public void validate(List<LifeGoalPillarInput> inputs) {
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
                continue; // habit keys are checked against the user's habit_def rows (Task 4)
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
