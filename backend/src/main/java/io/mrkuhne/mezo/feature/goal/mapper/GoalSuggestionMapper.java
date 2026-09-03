package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.GoalSuggestionPayload;
import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** Entity → {@link GoalSuggestionResponse}; plain-String kind/status become the DTO enums. */
@Mapper(componentModel = "spring")
public interface GoalSuggestionMapper {

    @Mapping(target = "kind",
        expression = "java(GoalSuggestionResponse.KindEnum.fromValue(entity.getKind()))")
    @Mapping(target = "status",
        expression = "java(GoalSuggestionResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "payload", expression = "java(toPayload(entity.getPayload()))")
    @Mapping(target = "createdAt", expression = "java(toOffset(entity.getCreatedAt()))")
    @Mapping(target = "decidedAt", expression = "java(entity.getDecidedAt() == null ? null : toOffset(entity.getDecidedAt()))")
    GoalSuggestionResponse toResponse(GoalSuggestionEntity entity);

    default GoalSuggestionPayload toPayload(GoalSuggestionPayloadJson j) {
        return GoalSuggestionPayload.builder()
            .reason(j.reason())
            .suggestedTrajectory(j.suggestedTrajectory() == null ? null
                : GoalSuggestionPayload.SuggestedTrajectoryEnum.fromValue(j.suggestedTrajectory()))
            .balanceOverrideKcal(j.balanceOverrideKcal())
            .fromWeek(j.fromWeek()).toWeek(j.toWeek())
            .mesoId(j.mesoId()).mesoTitle(j.mesoTitle())
            .snapshotTrajectory(
                GoalSuggestionPayload.SnapshotTrajectoryEnum.fromValue(j.snapshotTrajectory()))
            .build();
    }

    default OffsetDateTime toOffset(java.time.Instant i) {
        return i.atOffset(ZoneOffset.UTC);
    }
}
