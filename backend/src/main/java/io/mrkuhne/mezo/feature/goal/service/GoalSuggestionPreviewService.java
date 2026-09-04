package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalSuggestionPreviewResponse;
import io.mrkuhne.mezo.api.dto.GoalSuggestionProjection;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalPrescriptionCalculator;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds the read-only before/after model shown before a suggestion can be accepted. */
@Service
@RequiredArgsConstructor
public class GoalSuggestionPreviewService {

    private static final List<String> FIELD_ORDER = List.of(
        "trajectory", "targetWeightKg", "targetDate", "targetRateKgPerWeek",
        "weekAverageKcal", "trainingDayKcal", "restDayKcal", "proteinG", "carbsG",
        "fatG", "segment", "guards");

    private final GoalRepository goalRepository;
    private final GoalSuggestionRepository suggestionRepository;
    private final GoalSuggestionDraftApplier draftApplier;
    private final GoalSuggestionFingerprintService fingerprintService;
    private final GoalPrescriptionCalculator calculator;
    private final GoalInvariantValidator invariantValidator;
    private final GoalMapper goalMapper;

    @Transactional(readOnly = true)
    public GoalSuggestionPreviewResponse preview(UUID userId, UUID goalId, UUID suggestionId) {
        GoalEntity goal = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId)
            .orElseThrow(this::notFound);
        GoalSuggestionEntity suggestion = suggestionRepository
            .findByIdAndCreatedByAndDeletedFalse(suggestionId, userId)
            .filter(item -> item.getGoalId().equals(goalId))
            .orElseThrow(this::notFound);

        boolean accepted = GoalSuggestionService.STATUS_ACCEPTED.equals(suggestion.getStatus());
        GoalEntity beforeGoal = copy(goal);
        GoalEntity afterGoal = copy(goal);
        if (accepted) {
            draftApplier.revert(beforeGoal, suggestion);
        } else {
            draftApplier.apply(afterGoal, suggestion);
        }
        int week = affectedFromWeek(goal, suggestion);
        GoalPrescriptionJson currentPrescription = calculator.calculate(userId, beforeGoal).prescription();
        GoalPrescriptionJson proposedPrescription = currentPrescription;
        List<String> blockers = new ArrayList<>();
        try {
            invariantValidator.validate(
                afterGoal.getTrajectory(), afterGoal.getStartWeightKg(), afterGoal.getTargetWeightKg(),
                afterGoal.getStartDate(), afterGoal.getTargetDate());
            proposedPrescription = calculator.calculate(userId, afterGoal).prescription();
        } catch (SystemRuntimeErrorException ex) {
            if (hasCode(ex, "GOAL_DIRECTION_TARGET_CONFLICT")) {
                blockers.add("GOAL_DIRECTION_TARGET_CONFLICT");
            } else {
                throw ex;
            }
        }

        GoalSuggestionProjection current = projection(beforeGoal, currentPrescription, week);
        GoalSuggestionProjection proposed = projection(afterGoal, proposedPrescription, week);
        Map<String, Object> before = values(current);
        Map<String, Object> after = values(proposed);
        List<String> changed = FIELD_ORDER.stream()
            .filter(key -> !Objects.equals(before.get(key), after.get(key))).toList();
        List<String> unchanged = FIELD_ORDER.stream()
            .filter(key -> Objects.equals(before.get(key), after.get(key))).toList();
        boolean proposedStatus = GoalSuggestionService.STATUS_PROPOSED.equals(suggestion.getStatus());
        boolean canApply = proposedStatus && blockers.isEmpty();

        return GoalSuggestionPreviewResponse.builder()
            .status(GoalSuggestionPreviewResponse.StatusEnum.fromValue(suggestion.getStatus()))
            .reasonCode(suggestion.getKind())
            .affectedFromWeek(week)
            .affectedToWeek(affectedToWeek(goal, suggestion, week))
            .current(current)
            .proposed(proposed)
            .changedFields(changed)
            .unchangedFields(unchanged)
            .warnings(warnings(proposedPrescription))
            .blockers(blockers)
            .canApply(canApply)
            .previewFingerprint(canApply ? fingerprintService.fingerprint(userId, goal, suggestion) : null)
            .build();
    }

    private GoalSuggestionProjection projection(GoalEntity goal, GoalPrescriptionJson prescription, int week) {
        GoalPrescriptionJson.Segment segment = GoalPrescriptionJson.currentSegment(prescription, week);
        return GoalSuggestionProjection.builder()
            .trajectory(GoalSuggestionProjection.TrajectoryEnum.fromValue(goal.getTrajectory()))
            .targetWeightKg(goal.getTargetWeightKg())
            .targetDate(goal.getTargetDate())
            .targetRateKgPerWeek(segment == null ? null : segment.projectedRateKgPerWk())
            .weekAverageKcal(segment == null ? null : segment.kcal())
            .trainingDayKcal(segment == null ? null : segment.trainingDayKcal())
            .restDayKcal(segment == null ? null : segment.restDayKcal())
            .proteinG(segment == null ? null : segment.proteinG())
            .carbsG(segment == null ? null : segment.carbsG())
            .fatG(segment == null ? null : segment.fatG())
            .segmentFromWeek(segment == null ? null : segment.fromWeek())
            .segmentToWeek(segment == null ? null : segment.toWeek())
            .segmentLabel(segment == null ? null : segment.label())
            .guardStatus(prescription == null ? null : goalMapper.toGuardStatus(prescription.guardStatus()))
            .build();
    }

    private static Map<String, Object> values(GoalSuggestionProjection projection) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("trajectory", projection.getTrajectory());
        values.put("targetWeightKg", projection.getTargetWeightKg());
        values.put("targetDate", projection.getTargetDate());
        values.put("targetRateKgPerWeek", projection.getTargetRateKgPerWeek());
        values.put("weekAverageKcal", projection.getWeekAverageKcal());
        values.put("trainingDayKcal", projection.getTrainingDayKcal());
        values.put("restDayKcal", projection.getRestDayKcal());
        values.put("proteinG", projection.getProteinG());
        values.put("carbsG", projection.getCarbsG());
        values.put("fatG", projection.getFatG());
        values.put("segment", Arrays.asList(
            projection.getSegmentFromWeek(), projection.getSegmentToWeek(), projection.getSegmentLabel()));
        values.put("guards", projection.getGuardStatus());
        return values;
    }

    private static List<String> warnings(GoalPrescriptionJson prescription) {
        if (prescription == null || prescription.feasibility() == null
                || prescription.feasibility().notes() == null) {
            return List.of();
        }
        return prescription.feasibility().notes();
    }

    private static int affectedFromWeek(GoalEntity goal, GoalSuggestionEntity suggestion) {
        Integer payloadWeek = suggestion.getPayload().fromWeek();
        if (payloadWeek != null) {
            return payloadWeek;
        }
        long week = ChronoUnit.WEEKS.between(goal.getStartDate(), LocalDate.now()) + 1;
        long total = Math.max(1, ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate()));
        return (int) Math.max(1, Math.min(total, week));
    }

    private static int affectedToWeek(GoalEntity goal, GoalSuggestionEntity suggestion, int fromWeek) {
        if (suggestion.getPayload().toWeek() != null) {
            return suggestion.getPayload().toWeek();
        }
        if (suggestion.getPayload().suggestedTrajectory() != null) {
            return (int) Math.max(fromWeek,
                ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate()));
        }
        return fromWeek;
    }

    private static boolean hasCode(SystemRuntimeErrorException ex, String code) {
        return ex.getMessages().stream().map(SystemMessage::getCode).anyMatch(code::equals);
    }

    private static GoalEntity copy(GoalEntity source) {
        GoalEntity draft = new GoalEntity();
        draft.setId(source.getId());
        draft.setCreatedBy(source.getCreatedBy());
        draft.setTitle(source.getTitle());
        draft.setTrajectory(source.getTrajectory());
        draft.setGuards(new ArrayList<>(source.getGuards()));
        draft.setStatus(source.getStatus());
        draft.setStartDate(source.getStartDate());
        draft.setTargetDate(source.getTargetDate());
        draft.setStartWeightKg(source.getStartWeightKg());
        draft.setTargetWeightKg(source.getTargetWeightKg());
        draft.setRateTargetPctPerWeek(source.getRateTargetPctPerWeek());
        draft.setIdentityFrame(source.getIdentityFrame());
        draft.setMealsPerDay(source.getMealsPerDay());
        draft.setWakeTime(source.getWakeTime());
        draft.setBedTime(source.getBedTime());
        draft.setSegmentOverrides(source.getSegmentOverrides() == null
            ? null : new ArrayList<>(source.getSegmentOverrides()));
        draft.setBalanceAdjustmentKcal(source.getBalanceAdjustmentKcal());
        return draft;
    }

    private SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
