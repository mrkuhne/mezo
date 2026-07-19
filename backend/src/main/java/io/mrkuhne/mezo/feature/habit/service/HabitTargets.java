package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Wake/bed anchors: active goal day-planner first, config defaults otherwise (spec D6). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitTargets {

    private final GoalRepository goalRepository;
    private final HabitProperties properties;

    public record Resolved(LocalTime wake, LocalTime bed) {}

    public Resolved resolve(UUID userId) {
        var active = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst();
        LocalTime wake = active.map(g -> g.getWakeTime()).filter(t -> t != null && !t.isBlank())
            .map(LocalTime::parse).orElse(LocalTime.parse(properties.defaultWake()));
        LocalTime bed = active.map(g -> g.getBedTime()).filter(t -> t != null && !t.isBlank())
            .map(LocalTime::parse).orElse(LocalTime.parse(properties.defaultBed()));
        return new Resolved(wake, bed);
    }
}
