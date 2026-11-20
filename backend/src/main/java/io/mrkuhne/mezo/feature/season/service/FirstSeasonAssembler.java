package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The first season's draft (spec §5.2 "First season"), assembled from what he already has — persists nothing:
 * the LIVE ({@code is_deleted = false}) active goal's trajectory and target, the weekly gym + sport slots, the sleep
 * goal's anchor, and the running block (adopted only when he taps „Indulhat az évad"). The season starts today and
 * is long enough to cover the running block's end (else the live goal's end), 4..24 weeks.
 */
@Component
@RequiredArgsConstructor
public class FirstSeasonAssembler {

    static final String TITLE = "Első évad";
    static final int MIN_WEEKS = 4;
    static final int MAX_WEEKS = 24;
    /** Only when neither a block nor a live goal gives the season an end. */
    static final int FALLBACK_WEEKS = 12;

    private final SeasonGoalPort goalPort;
    private final SeasonTrainPort trainPort;
    private final SeasonSleepPort sleepPort;

    public SeasonDraftJson draft(UUID owner) {
        LocalDate today = LocalDate.now();
        Optional<SeasonGoalPort.GoalView> goal = goalPort.liveActive(owner);
        Optional<SeasonTrainPort.Block> block = trainPort.activeMesocycle(owner);
        SeasonTrainPort.Schedule schedule = trainPort.currentSchedule(owner);
        SeasonSleepPort.SleepGoal sleep = sleepPort.get(owner);

        Optional<LocalDate> end = block.map(SeasonTrainPort.Block::endDate)
            .or(() -> goal.map(g -> g.fields().targetDate()));
        int weeks = end.filter(e -> e.isAfter(today))
            .map(e -> (int) Math.ceilDiv(ChronoUnit.DAYS.between(today, e) + 1, 7))
            .orElse(FALLBACK_WEEKS);
        weeks = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeks));

        String trajectory = goal.map(g -> g.fields().trajectory()).orElse("maintain");
        return new SeasonDraftJson(TITLE, trajectory,
            "maintain".equals(trajectory) ? null : goal.map(g -> g.fields().targetWeightKg()).orElse(null),
            null, null, today, weeks, schedule.gymDays(), schedule.gymTime(), schedule.sport(),
            new SeasonDraftJson.SleepAnchor(sleep.anchor(), sleep.anchorTime()), List.of(),
            block.map(b -> new SeasonDraftJson.Block("adopt", b.id(), null)).orElse(null));
    }
}
