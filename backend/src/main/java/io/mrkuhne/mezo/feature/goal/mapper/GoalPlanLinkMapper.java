package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanRef;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@link GoalPlanLinkEntity} (+ a resolved {@link GoalPlanRef}) -> {@link GoalPlanLinkResponse}.
 * The entity stores {@code planType} as a plain {@code String}; the generated DTO uses an inner
 * enum, so it is converted explicitly via {@code PlanTypeEnum.fromValue(String)}. The {@code plan}
 * display ref is carried in from the service's ownership-checked second source param ({@code id},
 * {@code planId}, {@code startWeek}, {@code endWeek} map by name).
 */
@Mapper(componentModel = "spring")
public interface GoalPlanLinkMapper {

    @Mapping(target = "planType",
        expression = "java(GoalPlanLinkResponse.PlanTypeEnum.fromValue(entity.getPlanType()))")
    @Mapping(target = "plan", source = "plan")
    GoalPlanLinkResponse toResponse(GoalPlanLinkEntity entity, GoalPlanRef plan);
}
