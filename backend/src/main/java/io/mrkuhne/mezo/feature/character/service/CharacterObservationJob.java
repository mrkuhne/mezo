package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Karakter nightly expert pass (spec §6): for every user and every FINISHED day in the
 * catch-up window, run the detector sweep + per-expert observation generation. Idempotent per
 * (user, expert, day) — the service skips already-observed expert-days, so catch-up heals
 * missed nights. Per-date failures are isolated (the DailySummaryJob idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.CHARACTER_OBSERVATION_JOB_SWITCH},
        havingValue = "true")
public class CharacterObservationJob {

    private final AppUserRepository appUserRepository;
    private final CharacterObservationService observationService;
    private final CharacterProperties properties;

    @Scheduled(cron = "${mezo.character.observation.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate from = yesterday.minusDays(properties.observation().catchUpDays() - 1L);
        for (AppUserEntity user : appUserRepository.findAll()) {
            int written = 0;
            for (LocalDate date = from; !date.isAfter(yesterday); date = date.plusDays(1)) {
                try {
                    written += observationService.generateForDay(user.getId(), date);
                } catch (Exception e) {
                    log.warn("Character observation pass failed for user {} on {}", user.getId(), date, e);
                }
            }
            log.info("Character observation run for user {}: {} row(s) in window {}..{}",
                    user.getId(), written, from, yesterday);
        }
    }
}
