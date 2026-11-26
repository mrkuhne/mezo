package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacitySeasonPort;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link CapacitySeasonPort} over the season table (and its goal's target date), read-only. */
@Component
@RequiredArgsConstructor
public class CapacitySeasonAdapter implements CapacitySeasonPort {

    private final SeasonRepository seasons;
    private final GoalRepository goals;

    @Override
    public Optional<SeasonFrame> active(UUID owner) {
        return seasons.findActive(owner).map(s -> new SeasonFrame(s.getStartDate(), s.getWeeks()));
    }

    @Override
    public Optional<LocalDate> targetDate(UUID owner) {
        return seasons.findActive(owner)
            .flatMap(s -> s.getGoalId() == null ? Optional.empty() : goals.findById(s.getGoalId()))
            .filter(g -> owner.equals(g.getCreatedBy()))
            .map(GoalEntity::getTargetDate);
    }
}
