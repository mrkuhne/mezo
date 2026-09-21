package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.CHARACTER_COUNCIL_JOB_SWITCH}, havingValue = "true")
public class CharacterCouncilJob {
    private final UserFanOut users;
    private final CharacterCouncilService council;
    private final CharacterCouncilProperties properties;
    private final CharacterObservationService observationService;
    private final CharacterRunLog runLog;
    private final io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository runs;

    @Scheduled(cron = "${mezo.character.council.cron}", zone = "${mezo.character.council.zone}")
    public void run() {
        var now = ZonedDateTime.now(ZoneId.of(properties.zone()));
        if (now.toLocalTime().isBefore(LocalTime.parse(properties.readyAt()))) return;
        var today = now.toLocalDate();
        users.forEachActiveUser("Daily character council", user -> {
            for (int offset = properties.catchUpDays() - 1; offset >= 0; offset--) {
                var day = today.minusDays(offset);
                try {
                    var prior = runs.findByCreatedByAndKindAndDay(user.getId(), "NIGHTLY", day.minusDays(1));
                    if (prior.isEmpty() || (!"SUCCESS".equals(prior.get().getStatus())
                            && prior.get().getFailureCount() < properties.maxAttempts())) {
                        try { observationService.generateForDay(user.getId(), day.minusDays(1)); }
                        catch (RuntimeException failure) {
                            runLog.recordObservationFailure(user.getId(), day.minusDays(1));
                            throw failure;
                        }
                    }
                    council.run(user.getId(), day);
                }
                catch (RuntimeException e) { log.warn("Daily council failed for owner {} day {}", user.getId(), day, e); }
            }
        });
    }
}
