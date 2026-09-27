package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.ReadinessProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity.Choice;
import io.mrkuhne.mezo.feature.train.repository.ReadinessChoiceRepository;
import io.mrkuhne.mezo.feature.train.service.DayCheckInPort.DayCheckIn;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The read-only core of Check-in 2.0 training readiness (mezo-ck2, spec 2026-09-27 §3.3): picks
 * the day's morning check-in, applies the {@link ReadinessProperties} thresholds, maps reported
 * pain onto a list of exercises ({@link PainRegionMap}) and reads the stored per-day choice.
 *
 * <p>Split from {@link ReadinessService} so {@link WorkoutService#getToday} can read the LIGHTEN
 * overlay without a bean cycle (ReadinessService needs WorkoutService's plan lookup). Never
 * touches {@code WorkoutService.getToday} itself — that call has write side effects.
 */
@Component
@RequiredArgsConstructor
public class ReadinessAssessor {

    /** Item ids of the reasons, in display order. */
    public static final String RESTED = "rested";
    public static final String SORENESS = "soreness";
    public static final String MOTIVATION = "motivation";

    private final DayCheckInPort dayCheckInPort;
    private final ReadinessProperties props;
    private final ReadinessChoiceRepository choiceRepository;

    /** One answered morning value. */
    public record Reason(String item, int value) {}

    /** A planned exercise a reported pain region loads. */
    public record Care(ExerciseEntity exercise, String region, Integer intensity) {}

    /** The morning read: its source check-in (empty = none), whether a threshold fired, the reasons. */
    public record Assessment(Optional<DayCheckIn> source, boolean suggest, List<Reason> reasons) {
        static Assessment none() {
            return new Assessment(Optional.empty(), false, List.of());
        }
    }

    /**
     * The day's morning check-in: the configured morning slot when it answered any readiness item,
     * else the first check-in of the day (slot order) that did. Empty when none did.
     */
    public Optional<DayCheckIn> morningCheckIn(UUID userId, LocalDate date) {
        List<DayCheckIn> answered = dayCheckInPort.checkIns(userId, date).stream()
            .filter(ReadinessAssessor::answersReadiness)
            .toList();
        return answered.stream()
            .filter(c -> props.morningSlot().equals(c.slotTime()))
            .findFirst()
            .or(() -> answered.stream().min(Comparator.comparing(DayCheckIn::slotTime)));
    }

    public Assessment assess(UUID userId, LocalDate date) {
        Optional<DayCheckIn> source = morningCheckIn(userId, date);
        if (source.isEmpty()) {
            return Assessment.none();
        }
        DayCheckIn c = source.get();
        List<Reason> reasons = new ArrayList<>();
        if (c.rested() != null) reasons.add(new Reason(RESTED, c.rested()));
        if (c.soreness() != null) reasons.add(new Reason(SORENESS, c.soreness()));
        if (c.motivation() != null) reasons.add(new Reason(MOTIVATION, c.motivation()));
        boolean suggest = (c.rested() != null && c.rested() <= props.restedMax())
            || (c.soreness() != null && c.soreness() >= props.sorenessMin())
            || (c.motivation() != null && c.motivation() <= props.motivationMax());
        return new Assessment(source, suggest, List.copyOf(reasons));
    }

    /**
     * The exercises of {@code exercises} a region of the source's pain answer loads, in list order,
     * each with its first loading region. Empty when the source reported no pain.
     */
    public List<Care> care(Optional<DayCheckIn> source, List<ExerciseEntity> exercises) {
        if (source.isEmpty() || !Boolean.TRUE.equals(source.get().pain())) {
            return List.of();
        }
        DayCheckIn c = source.get();
        Map<UUID, Care> out = new LinkedHashMap<>();
        for (ExerciseEntity e : exercises) {
            String region = PainRegionMap.firstLoading(c.painRegions(), e.getMuscle());
            if (region != null) {
                out.putIfAbsent(e.getId(), new Care(e, region, c.painIntensity()));
            }
        }
        return List.copyOf(out.values());
    }

    public Optional<Choice> choice(UUID userId, LocalDate date) {
        return choiceRepository.findByCreatedByAndDateAndDeletedFalse(userId, date)
            .map(ReadinessChoiceEntity::getChoice);
    }

    /**
     * The LIGHTEN overlay for {@code getToday}: present only when the user chose „Könnyítsük" for
     * {@code date}; maps each care exercise id → its pain region (those drop their heavy sets).
     */
    public Optional<Map<UUID, String>> lightening(UUID userId, LocalDate date, List<ExerciseEntity> exercises) {
        if (choice(userId, date).filter(Choice.LIGHTEN::equals).isEmpty()) {
            return Optional.empty();
        }
        Map<UUID, String> careRegions = new LinkedHashMap<>();
        care(morningCheckIn(userId, date), exercises)
            .forEach(c -> careRegions.put(c.exercise().getId(), c.region()));
        return Optional.of(careRegions);
    }

    private static boolean answersReadiness(DayCheckIn c) {
        return c.rested() != null || c.soreness() != null || c.motivation() != null || c.pain() != null;
    }
}
