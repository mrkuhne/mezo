package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the life-goal aggregate — persists via saveAndFlush so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class LifeGoalPopulator {

    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;

    public LifeGoalEntity goal(UUID owner, String status) {
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Kockahas");
        g.setWhyText("Erős, egészséges test, ami bírja a röpit.");
        g.setFrame("intrinsic");
        g.setDimension("health");
        g.setSecondaryDimension("accomplishment");
        g.setStatus(status);
        g.setStartDate(LocalDate.of(2026, 8, 10));
        g.setTargetDate(LocalDate.of(2026, 11, 30));
        return goalRepository.saveAndFlush(g);
    }

    public LifeGoalPillarEntity pillar(LifeGoalEntity goal, String label, String kind,
            PillarSourceJson source, PillarRuleJson rule) {
        LifeGoalPillarEntity p = new LifeGoalPillarEntity();
        p.setCreatedBy(goal.getCreatedBy());
        p.setGoalId(goal.getId());
        p.setLabel(label);
        p.setSkillKey("recovery");
        p.setKind(kind);
        p.setSource(source);
        p.setRule(rule);
        return pillarRepository.saveAndFlush(p);
    }

    /** The canonical "Alvás ≥ 7 ó" average pillar on the sleep-duration metric. */
    public LifeGoalPillarEntity sleepPillar(LifeGoalEntity goal) {
        return pillar(goal, "Alvás", "average",
            new PillarSourceJson("metric", "SLEEP_DURATION_H", null, null, null, null),
            new PillarRuleJson(new BigDecimal("7.0"), "gte", null, 7, null, null, null, null, null, null));
    }
}
