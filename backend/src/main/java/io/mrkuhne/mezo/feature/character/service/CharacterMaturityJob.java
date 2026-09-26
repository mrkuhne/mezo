package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterMaturityProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly maturity snapshot (csapatfal érettség-görbe, mezo-a9bo7.11): for every active user,
 * refreshes the current ISO week's per-dimension row. No LLM, so no COMPANION dependency. A missed
 * night heals on the next one; a missed Sunday leaves the week at Saturday's real reading.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.CHARACTER_MATURITY_JOB_SWITCH},
        havingValue = "true")
public class CharacterMaturityJob {

    private final UserFanOut userFanOut;
    private final CharacterMaturityService maturityService;
    private final CharacterMaturityProperties properties;

    @Scheduled(cron = "${mezo.character.maturity.cron}", zone = "${mezo.character.maturity.zone}")
    public void run() {
        run(LocalDate.now(ZoneId.of(properties.zone())));
    }

    /** The tick body for an explicit local day — public so tests can pin the clock. */
    public void run(LocalDate today) {
        userFanOut.forEachActiveUser("Character maturity snapshot", user -> {
            try {
                int rows = maturityService.snapshot(user.getId(), today);
                log.info("Maturity snapshot for user {} day {}: {} dimension row(s)", user.getId(), today, rows);
            } catch (RuntimeException e) {
                // e.g. a second node racing uq_character_maturity_week: the week already holds a
                // row and the next night refreshes it — never abort the fan-out.
                log.warn("Maturity snapshot failed for user {} day {}", user.getId(), today, e);
            }
        });
    }
}
