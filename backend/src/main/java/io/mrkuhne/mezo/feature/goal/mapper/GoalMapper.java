package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity -> {@link GoalResponse}. The entity stores {@code trajectory}/{@code status} as plain
 * {@code String} and {@code guards} as {@code List<String>}; the generated DTO uses inner enums, so
 * each is converted explicitly via the enum's {@code fromValue(String)}. MapStruct cannot auto-map
 * {@code List<String>} -> {@code List<Enum>}, hence the {@code toGuardEnums} default method.
 */
@Mapper(componentModel = "spring")
public interface GoalMapper {

    @Mapping(target = "trajectory",
        expression = "java(GoalResponse.TrajectoryEnum.fromValue(entity.getTrajectory()))")
    @Mapping(target = "status",
        expression = "java(GoalResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "guards",
        expression = "java(toGuardEnums(entity.getGuards()))")
    GoalResponse toResponse(GoalEntity entity);

    default List<GoalResponse.GuardsEnum> toGuardEnums(List<String> guards) {
        return guards == null ? List.of()
            : guards.stream().map(GoalResponse.GuardsEnum::fromValue).toList();
    }
}
