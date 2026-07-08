package io.mrkuhne.mezo.feature.proactive.mapper;

import io.mrkuhne.mezo.api.dto.BriefingRef;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.ChallengeRef;
import io.mrkuhne.mezo.api.dto.ChallengeResponse;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.api.dto.HeartbeatNoteResponse;
import io.mrkuhne.mezo.api.dto.MemoirAnchor;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.PredictionResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeRefsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProactiveMapper {

    @Mapping(target = "date", source = "briefingDate")
    @Mapping(target = "eyebrow", source = "content.eyebrow")
    @Mapping(target = "body", source = "content.body")
    @Mapping(target = "refs", source = "content.refs")
    BriefingResponse toBriefingResponse(BriefingEntity entity);

    BriefingRef toBriefingRef(BriefingContentEnvelope.Ref ref);

    WeeklySuggestionResponse toWeeklySuggestionResponse(WeeklySuggestionEntity entity);

    @Mapping(target = "anchors", source = "anchors.anchors")
    MemoirResponse toMemoirResponse(MemoirEntity entity);

    MemoirAnchor toMemoirAnchor(MemoirAnchorsEnvelope.Anchor anchor);

    @Mapping(target = "date", source = "noteDate")
    @Mapping(target = "window", source = "windowKey")
    HeartbeatNoteResponse toHeartbeatResponse(HeartbeatNoteEntity entity);

    PredictionResponse toPredictionResponse(PredictionEntity entity);

    ExperimentResponse toExperimentResponse(ExperimentEntity entity);

    @Mapping(target = "exercise", source = "exerciseName")
    @Mapping(target = "refs", source = "refs.refs")
    @Mapping(target = "typeLabel", expression = "java(ChallengeDisplay.typeLabel(e.getType()))")
    @Mapping(target = "target", expression = "java(ChallengeDisplay.target(e))")
    ChallengeResponse toChallengeResponse(ChallengeEntity e);

    ChallengeRef toChallengeRef(ChallengeRefsEnvelope.Ref r);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    default Double map(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }
}
