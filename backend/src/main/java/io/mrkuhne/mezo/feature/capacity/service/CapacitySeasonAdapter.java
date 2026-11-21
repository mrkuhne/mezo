package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacitySeasonPort;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link CapacitySeasonPort} over the season table, read-only. */
@Component
@RequiredArgsConstructor
public class CapacitySeasonAdapter implements CapacitySeasonPort {

    private final SeasonRepository seasons;

    @Override
    public Optional<SeasonFrame> active(UUID owner) {
        return seasons.findActive(owner).map(s -> new SeasonFrame(s.getStartDate(), s.getWeeks()));
    }
}
