package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_GOAL_SWITCH, havingValue = "true")
public class SleepGoalService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final SleepGoalRepository repository;
    private final SleepGoalProperties properties;

    /** Config-default ghost when unset — never 404 (spec §3): every user has a working anchor. */
    public SleepGoalResponse getGoal(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(g -> compose(g.getTargetMinutes(), g.getAnchor(), g.getAnchorTime(), g.getRegularityBandMin()))
            .orElseGet(() -> {
                String time = "WAKE".equals(properties.defaultAnchor())
                    ? properties.defaultWake() : properties.defaultBed();
                return compose(properties.defaultTargetMin(), properties.defaultAnchor(), time,
                    properties.regularityBandMin());
            });
    }

    @Transactional
    public SleepGoalResponse setGoal(UUID userId, SetSleepGoalRequest req) {
        SleepGoalEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                SleepGoalEntity e = new SleepGoalEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        row.setTargetMinutes(req.getTargetMinutes());
        row.setAnchor(req.getAnchor());
        row.setAnchorTime(req.getAnchorTime());
        row.setRegularityBandMin(req.getRegularityBandMin() != null
            ? req.getRegularityBandMin() : properties.regularityBandMin());
        repository.save(row);
        return compose(row.getTargetMinutes(), row.getAnchor(), row.getAnchorTime(), row.getRegularityBandMin());
    }

    /**
     * Moves the anchor by {@code minutes} (negative = earlier) WITHOUT creating a goal (S5, bd
     * mezo-d58h.5). Deliberately not {@link #setGoal}: that one upserts, so calling it for a user
     * with no row would silently invent a goal — and the spec makes the missing-sleep-goal card the
     * prerequisite for ever offering this action. The missing-row condition is invisible through
     * {@code getGoal}/{@code SleepAnchorResolver} (both ghost a config default), so this reads the
     * repository directly.
     *
     * <p>{@code anchor_time} is an {@code HH:mm} string; {@link LocalTime} arithmetic wraps mod-24h,
     * so a shift across midnight needs no special case — but string math on it would be a bug.
     */
    @Transactional
    public SleepGoalResponse shiftAnchor(UUID userId, int minutes) {
        SleepGoalEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("SLEEP_GOAL_NOT_SET").build(), HttpStatus.CONFLICT));
        row.setAnchorTime(LocalTime.parse(row.getAnchorTime()).plusMinutes(minutes).format(HH_MM));
        repository.save(row);
        return compose(row.getTargetMinutes(), row.getAnchor(), row.getAnchorTime(),
            row.getRegularityBandMin());
    }

    private SleepGoalResponse compose(int targetMinutes, String anchor, String anchorTime, int bandMin) {
        var resolved = SleepAnchorResolver.derive(anchor, LocalTime.parse(anchorTime), targetMinutes);
        return SleepGoalResponse.builder()
            .targetMinutes(targetMinutes)
            .anchor(anchor)
            .anchorTime(anchorTime)
            .wakeTime(HH_MM.format(resolved.wake()))
            .bedTime(HH_MM.format(resolved.bed()))
            .regularityBandMin(bandMin)
            .build();
    }
}
