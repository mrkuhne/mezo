package io.mrkuhne.mezo.feature.proactive.mapper;

import io.mrkuhne.mezo.api.dto.ChallengeRef;
import io.mrkuhne.mezo.api.dto.ChallengeResponse;
import io.mrkuhne.mezo.api.dto.DiagnosisEvidenceItem;
import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.api.dto.DiagnosisSuspect;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.api.dto.FeedRef;
import io.mrkuhne.mezo.api.dto.MemoirAnchor;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.PredictionResponse;
import io.mrkuhne.mezo.api.dto.WeeklyLessonResponse;
import io.mrkuhne.mezo.api.dto.WeeklyReviewDayNote;
import io.mrkuhne.mezo.api.dto.WeeklyReviewHighlight;
import io.mrkuhne.mezo.api.dto.WeeklyReviewResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeRefsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewDayNotesEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProactiveMapper {

    WeeklySuggestionResponse toWeeklySuggestionResponse(WeeklySuggestionEntity entity);

    @Mapping(target = "anchors", source = "anchors.anchors")
    MemoirResponse toMemoirResponse(MemoirEntity entity);

    MemoirAnchor toMemoirAnchor(MemoirAnchorsEnvelope.Anchor anchor);

    PredictionResponse toPredictionResponse(PredictionEntity entity);

    /** {@code stale} is NOT mapped — it depends on OTHER aggregates' rows, computed by
     *  {@code WeeklyReviewService} and set on the returned DTO after this call. */
    @Mapping(target = "dayNotes", source = "dayNotes.notes")
    @Mapping(target = "highlights", source = "highlights.highlights")
    @Mapping(target = "stale", ignore = true)
    WeeklyReviewResponse toWeeklyReviewResponse(WeeklyReviewEntity entity);

    WeeklyReviewDayNote toWeeklyReviewDayNote(WeeklyReviewDayNotesEnvelope.DayNote note);

    WeeklyReviewHighlight toWeeklyReviewHighlight(WeeklyReviewHighlightsEnvelope.Highlight highlight);

    /** "A hét tanulságai" (mezo-d20.7.6): the weekly read of a companion {@code learned_fact} row.
     *  Field-compatible with {@code CompanionMapper.toFactCandidateResponse} by contract — one
     *  entity, two surfaces (the Tudástár inbox and the week's settled list). */
    WeeklyLessonResponse toWeeklyLessonResponse(LearnedFactEntity entity);

    ExperimentResponse toExperimentResponse(ExperimentEntity entity);

    /** {@code stale} is NOT mapped — it is a live probe result over OTHER aggregates' rows,
     *  computed by {@code DiagnosisService} and set on the returned DTO after this call (the
     *  {@code toWeeklyReviewResponse} precedent, mezo-hqfi). */
    @Mapping(target = "evidence", source = "evidence.items")
    @Mapping(target = "suspects", source = "suspects.suspects")
    @Mapping(target = "stale", ignore = true)
    DiagnosisResponse toDiagnosisResponse(DiagnosisEntity entity);

    DiagnosisEvidenceItem toDiagnosisEvidenceItem(DiagnosisEvidenceEnvelope.EvidenceItem item);

    DiagnosisSuspect toDiagnosisSuspect(DiagnosisSuspectsEnvelope.Suspect suspect);

    @Mapping(target = "exercise", source = "exerciseName")
    @Mapping(target = "refs", source = "refs.refs")
    @Mapping(target = "typeLabel", expression = "java(ChallengeDisplay.typeLabel(e.getType()))")
    @Mapping(target = "target", expression = "java(ChallengeDisplay.target(e))")
    ChallengeResponse toChallengeResponse(ChallengeEntity e);

    ChallengeRef toChallengeRef(ChallengeRefsEnvelope.Ref r);

    @Mapping(target = "date", source = "messageDate")
    @Mapping(target = "eyebrow", source = "content.eyebrow")
    @Mapping(target = "body", source = "content.body")
    @Mapping(target = "refs", source = "content.refs")
    FeedMessageResponse toFeedResponse(CompanionMessageEntity entity);

    FeedRef toFeedRef(CompanionMessageEnvelope.Ref ref);

    /** String→enum via the generated {@code fromValue} (the wire value, e.g. "morning"), not
     *  MapStruct's default {@code Enum.valueOf} (the constant NAME, "MORNING") — the entity's
     *  {@code kind} column stores the lowercase {@code CompanionMessageEntity.KIND_*} value. */
    default FeedMessageResponse.KindEnum map(String kind) {
        return kind == null ? null : FeedMessageResponse.KindEnum.fromValue(kind);
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    default Double map(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }
}
