package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ReadinessCare;
import io.mrkuhne.mezo.api.dto.ReadinessChoiceRequest;
import io.mrkuhne.mezo.api.dto.ReadinessReason;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity.Choice;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ReadinessChoiceRepository;
import io.mrkuhne.mezo.feature.train.service.ReadinessAssessor.Assessment;
import io.mrkuhne.mezo.feature.train.service.ReadinessAssessor.Care;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Check-in 2.0 training readiness (mezo-ck2, spec 2026-09-27 §3.3) — the Edzés today card's
 * backend. {@link #today} is a pure read: this morning's check-in ({@link ReadinessAssessor})
 * against TODAY's planned gym day, resolved through the side-effect-free
 * {@link WorkoutService#findPlannedTemplateForDate} (never {@code getToday}, which auto-closes
 * stale instances and rolls volume over). {@link #choose} / {@link #undo} store the day's answer;
 * the LIGHTEN effect itself is a read-time overlay in {@code WorkoutService.getToday}.
 */
@Service
@RequiredArgsConstructor
public class ReadinessService {

    private final ReadinessAssessor assessor;
    private final WorkoutService workoutService;
    private final ExerciseRepository exerciseRepository;
    private final ReadinessChoiceRepository choiceRepository;

    public ReadinessTodayResponse today(UUID userId) {
        LocalDate date = LocalDate.now();
        Assessment assessment = assessor.assess(userId, date);
        List<ExerciseEntity> planned = plannedExercises(userId, date);
        List<Care> care = assessor.care(assessment.source(), planned);
        Optional<Choice> choice = assessor.choice(userId, date);
        ReadinessTodayResponse.StateEnum state;
        if (choice.isPresent()) {
            state = choice.get() == Choice.LIGHTEN
                ? ReadinessTodayResponse.StateEnum.LIGHTENED
                : ReadinessTodayResponse.StateEnum.KEPT;
        } else if (!planned.isEmpty() && (assessment.suggest() || !care.isEmpty())) {
            state = ReadinessTodayResponse.StateEnum.OFFER;
        } else {
            state = ReadinessTodayResponse.StateEnum.NONE;
        }
        return ReadinessTodayResponse.builder()
            .suggest(assessment.suggest())
            .state(state)
            .reasons(assessment.reasons().stream()
                .map(r -> ReadinessReason.builder()
                    .item(ReadinessReason.ItemEnum.fromValue(r.item()))
                    .value(r.value())
                    .build())
                .toList())
            .care(care.stream()
                .map(c -> ReadinessCare.builder()
                    .exerciseName(c.exercise().getName())
                    .region(c.region())
                    .regionLabel(PainRegionMap.possessive(c.region()))
                    .intensity(c.intensity())
                    .build())
                .toList())
            .build();
    }

    /** Idempotent upsert of today's choice. */
    @Transactional
    public ReadinessTodayResponse choose(UUID userId, ReadinessChoiceRequest request) {
        LocalDate date = LocalDate.now();
        Choice choice = Choice.valueOf(request.getChoice().getValue());
        ReadinessChoiceEntity row = choiceRepository.findByCreatedByAndDateAndDeletedFalse(userId, date)
            .orElseGet(() -> {
                ReadinessChoiceEntity e = new ReadinessChoiceEntity();
                e.setCreatedBy(userId); // server-side ownership — never from the client
                e.setDate(date);
                return e;
            });
        row.setChoice(choice);
        choiceRepository.saveAndFlush(row);
        return today(userId);
    }

    /** „Visszaállítom a tervet": drops today's choice (soft delete); a no-op when there is none. */
    @Transactional
    public ReadinessTodayResponse undo(UUID userId) {
        choiceRepository.findByCreatedByAndDateAndDeletedFalse(userId, LocalDate.now())
            .ifPresent(row -> {
                choiceRepository.delete(row);
                choiceRepository.flush();
            });
        return today(userId);
    }

    private List<ExerciseEntity> plannedExercises(UUID userId, LocalDate date) {
        return workoutService.findPlannedTemplateForDate(userId, date)
            .map(day -> exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                userId, List.of(day.getId())))
            .orElse(List.of());
    }
}
