package io.mrkuhne.mezo.feature.season.service;

import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The season's context lines for its three AI consumers — companion (chat snapshot + {@code get_season}), boop
 * (morning brief) and meal (coach) — each through its own consumer-owned {@code SeasonContextPort}. Season-side, like
 * the other adapters ({@link SeasonGoalAdapter}): nothing depends on the season feature, so no cycle can close.
 */
@Component
@RequiredArgsConstructor
public class SeasonContextAdapter implements io.mrkuhne.mezo.feature.companion.port.SeasonContextPort,
    io.mrkuhne.mezo.feature.boop.port.SeasonContextPort, io.mrkuhne.mezo.feature.meal.port.SeasonContextPort {

    private final SeasonContextRenderer renderer;

    @Override
    public String render(UUID owner, LocalDate today) {
        return renderer.render(owner, today);
    }

    @Override
    public String overview(UUID owner, LocalDate today) {
        return renderer.overview(owner, today);
    }
}
