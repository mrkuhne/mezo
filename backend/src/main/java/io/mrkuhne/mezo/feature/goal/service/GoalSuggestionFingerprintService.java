package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferences;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferencesPort;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSegmentOverrideJson;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

/** Stable hash of every semantic input that can change a suggestion preview. */
@Service
@RequiredArgsConstructor
public class GoalSuggestionFingerprintService {

    private final ObjectMapper objectMapper;
    private final DietPreferencesPort dietPreferencesPort;
    private final GoalPlanLinkRepository linkRepository;
    private final MesocycleRepository mesocycleRepository;
    private final RunningBlockRepository runningBlockRepository;
    private final GymScheduleSlotRepository gymScheduleRepository;
    private final SportScheduleSlotRepository sportScheduleRepository;

    public String fingerprint(UUID userId, GoalEntity goal, GoalSuggestionEntity suggestion) {
        List<GoalSegmentOverrideJson> overrides = new ArrayList<>(
            goal.getSegmentOverrides() == null ? List.of() : goal.getSegmentOverrides());
        overrides.sort(Comparator.comparing(GoalSegmentOverrideJson::fromWeek)
            .thenComparing(GoalSegmentOverrideJson::toWeek));

        SemanticInput input = new SemanticInput(
            suggestion.getId(), suggestion.getKind(), suggestion.getStatus(), suggestion.getPayload(),
            goal.getTrajectory(), goal.getStartWeightKg(), goal.getTargetWeightKg(),
            goal.getStartDate(), goal.getTargetDate(), goal.getRateTargetPctPerWeek(),
            goal.getBalanceAdjustmentKcal(), overrides, dietPreferencesPort.resolve(userId),
            plans(userId, goal.getId()), schedule(userId));
        try {
            byte[] canonical = objectMapper.writeValueAsString(input).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
        } catch (NoSuchAlgorithmException ex) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("INTERNAL_ERROR").build(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public boolean matches(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.US_ASCII), actual.getBytes(StandardCharsets.US_ASCII));
    }

    private List<PlanInput> plans(UUID userId, UUID goalId) {
        List<PlanInput> result = new ArrayList<>();
        for (GoalPlanLinkEntity link : linkRepository
                .findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goalId, userId)) {
            if ("mesocycle".equals(link.getPlanType())) {
                mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(link.getPlanId(), userId)
                    .ifPresent(plan -> result.add(new PlanInput(
                        link.getPlanType(), link.getPlanId(), link.getStartWeek(), link.getEndWeek(),
                        plan.getStatus(), plan.getStartDate(), plan.getEndDate(), plan.getWeeks(),
                        plan.getPhaseCurve())));
            } else {
                runningBlockRepository.findByIdAndCreatedByAndDeletedFalse(link.getPlanId(), userId)
                    .ifPresent(plan -> result.add(new PlanInput(
                        link.getPlanType(), link.getPlanId(), link.getStartWeek(), link.getEndWeek(),
                        plan.getStatus(), plan.getStartDate(), plan.getEndDate(), plan.getWeeks(), List.of())));
            }
        }
        result.sort(Comparator.comparing(PlanInput::planType)
            .thenComparing(PlanInput::startWeek).thenComparing(PlanInput::planId));
        return result;
    }

    private List<ScheduleInput> schedule(UUID userId) {
        List<ScheduleInput> result = new ArrayList<>();
        gymScheduleRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)
            .forEach(slot -> result.add(new ScheduleInput(
                "gym", slot.getDayOfWeek(), slot.getTime(), slot.getId(), null, null, null)));
        sportScheduleRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)
            .forEach(slot -> result.add(new ScheduleInput(
                "sport", slot.getDayOfWeek(), slot.getTime(), slot.getId(), slot.getDurationMin(),
                slot.getKind(), slot.getSport())));
        result.sort(Comparator.comparing(ScheduleInput::kind).thenComparing(ScheduleInput::day)
            .thenComparing(ScheduleInput::time).thenComparing(ScheduleInput::id));
        return result;
    }

    record SemanticInput(
        UUID suggestionId, String kind, String status, GoalSuggestionPayloadJson payload,
        String trajectory, BigDecimal startWeightKg, BigDecimal targetWeightKg,
        LocalDate startDate, LocalDate targetDate, BigDecimal rateTargetPctPerWeek,
        Integer balanceAdjustmentKcal, List<GoalSegmentOverrideJson> overrides,
        DietPreferences diet, List<PlanInput> plans, List<ScheduleInput> schedule) {}

    record PlanInput(
        String planType, UUID planId, Integer startWeek, Integer endWeek, String status,
        LocalDate startDate, LocalDate endDate, Integer weeks, List<String> phaseStructure) {}

    record ScheduleInput(
        String kind, Integer day, String time, UUID id, Integer durationMin,
        String sessionKind, String sport) {}
}
