package io.mrkuhne.mezo.feature.lifegoal.mapper;

import io.mrkuhne.mezo.api.dto.IfThenPlan;
import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalFrame;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatus;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.api.dto.PillarSource;
import io.mrkuhne.mezo.api.dto.PlanTrigger;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Entity ↔ DTO mapping for the life-goal aggregate. {@code toSourceDto} is public (rather than the
 * brief's private) because {@code LifeGoalSignalService} (task 3's full catalog listing) reuses it
 * to render each {@link io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry}'s source as the
 * wire {@link PillarSource} — see task-3 override notes.
 */
@Component
public class LifeGoalMapper {

    public LifeGoalResponse toResponse(LifeGoalEntity g, List<LifeGoalPillarEntity> pillars) {
        return LifeGoalResponse.builder()
            .id(g.getId()).title(g.getTitle()).whyText(g.getWhyText())
            .frame(LifeGoalFrame.fromValue(g.getFrame()))
            .dimension(LifeGoalDimension.fromValue(g.getDimension()))
            .secondaryDimension(g.getSecondaryDimension() == null ? null : LifeGoalDimension.fromValue(g.getSecondaryDimension()))
            .status(LifeGoalStatus.fromValue(g.getStatus()))
            .startDate(g.getStartDate()).targetDate(g.getTargetDate())
            .activatedAt(g.getActivatedAt() == null ? null : g.getActivatedAt().atOffset(ZoneOffset.UTC))
            .closedAt(g.getClosedAt() == null ? null : g.getClosedAt().atOffset(ZoneOffset.UTC))
            .obstacleText(g.getObstacleText())
            .ifThenPlans(g.getIfThenPlans().stream().map(this::toPlanDto).toList())
            .pillars(pillars.stream().map(this::toPillarResponse).toList())
            .build();
    }

    public LifeGoalPillarResponse toPillarResponse(LifeGoalPillarEntity p) {
        return LifeGoalPillarResponse.builder()
            .id(p.getId()).position(p.getPosition())
            .label(p.getLabel()).skillKey(p.getSkillKey()).kind(PillarKind.fromValue(p.getKind()))
            .weight(p.getWeight()).active(p.isActive())
            .source(toSourceDto(p.getSource())).rule(toRuleDto(p.getRule()))
            .build();
    }

    public LifeGoalPillarEntity toPillarEntity(LifeGoalPillarInput in, LifeGoalEntity goal, int position) {
        LifeGoalPillarEntity p = new LifeGoalPillarEntity();
        p.setCreatedBy(goal.getCreatedBy());
        p.setGoalId(goal.getId());
        p.setLabel(in.getLabel());
        p.setSkillKey(in.getSkillKey());
        p.setKind(in.getKind().getValue());
        p.setWeight(in.getWeight() == null ? 1 : in.getWeight());
        p.setActive(in.getActive() == null || in.getActive());
        p.setPosition(position);
        p.setSource(toSourceJson(in.getSource()));
        p.setRule(toRuleJson(in.getRule()));
        return p;
    }

    public PillarSourceJson toSourceJson(PillarSource s) {
        return new PillarSourceJson(s.getType().getValue(), s.getKey(), s.getSkillKey(),
            s.getMeasure() == null ? null : s.getMeasure().getValue(), s.getHabitKey(),
            s.getRing() == null ? null : s.getRing().getValue());
    }

    public PillarRuleJson toRuleJson(PillarRule r) {
        if (r == null) return new PillarRuleJson(null, null, null, null, null, null, null, null, null, null);
        return new PillarRuleJson(r.getThreshold(), r.getComparator() == null ? null : r.getComparator().getValue(),
            r.getDaysPerWeek(), r.getWindowDays(), r.getStartValue(), r.getTargetValue(), r.getStartDate(),
            r.getTargetDate(), r.getDirection() == null ? null : r.getDirection().getValue(), r.getMinDataDays());
    }

    public IfThenPlanJson toPlanJson(IfThenPlan p) {
        PlanTrigger t = p.getTrigger();
        return new IfThenPlanJson(p.getHa(), p.getAkkor(),
            t == null ? null : new PlanTriggerJson(t.getSource(), t.getCondition(), t.getDelayHours()));
    }

    /** Maps a catalog entry's source spec onto the wire {@link PillarSource} (used by both the
     *  pillar-response path above and {@code LifeGoalSignalService.catalog()}). */
    public PillarSource toSourceDto(PillarSourceJson s) {
        return PillarSource.builder().type(PillarSource.TypeEnum.fromValue(s.type())).key(s.key())
            .skillKey(s.skillKey()).measure(s.measure() == null ? null : PillarSource.MeasureEnum.fromValue(s.measure()))
            .habitKey(s.habitKey()).ring(s.ring() == null ? null : PillarSource.RingEnum.fromValue(s.ring())).build();
    }

    private IfThenPlan toPlanDto(IfThenPlanJson j) {
        return IfThenPlan.builder().ha(j.ha()).akkor(j.akkor())
            .trigger(j.trigger() == null ? null : PlanTrigger.builder().source(j.trigger().source())
                .condition(j.trigger().condition()).delayHours(j.trigger().delayHours()).build())
            .build();
    }

    private PillarRule toRuleDto(PillarRuleJson r) {
        return PillarRule.builder().threshold(r.threshold())
            .comparator(r.comparator() == null ? null : PillarRule.ComparatorEnum.fromValue(r.comparator()))
            .daysPerWeek(r.daysPerWeek()).windowDays(r.windowDays()).startValue(r.startValue()).targetValue(r.targetValue())
            .startDate(r.startDate()).targetDate(r.targetDate())
            .direction(r.direction() == null ? null : PillarRule.DirectionEnum.fromValue(r.direction()))
            .minDataDays(r.minDataDays()).build();
    }
}
