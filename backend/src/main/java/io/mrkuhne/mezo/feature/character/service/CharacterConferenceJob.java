package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Karakter weekly konzílium cron (spec §6, mezo-1gim.5): for every user and every FINISHED week
 * in the catch-up window, runs {@link CharacterConferenceService#runWeekly(java.util.UUID,
 * LocalDate)}. Idempotent per (user, week) — the service returns the existing WEEKLY row (or
 * {@code null} for the honest empty week) instead of re-running, so catch-up heals missed
 * Sundays. Per-week failures are isolated (the DailySummaryJob idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.CHARACTER_CONFERENCE_JOB_SWITCH},
        havingValue = "true")
public class CharacterConferenceJob {

    private final AppUserRepository appUserRepository;
    private final CharacterConferenceService conferenceService;
    private final CharacterProperties properties;

    @Scheduled(cron = "${mezo.character.conference.cron}")
    public void run() {
        // A Sunday run targets the week that is ENDING today: minusDays(6) lands back inside
        // that week (any day between Mon..Sun), then previousOrSame(MONDAY) resolves to its
        // ISO Monday — the same derivation the IT seeds its observations against.
        LocalDate latestWeekStart = LocalDate.now().minusDays(6)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate earliestWeekStart = latestWeekStart.minusWeeks(properties.conference().catchUpWeeks() - 1L);
        for (AppUserEntity user : appUserRepository.findAll()) {
            int held = 0;
            for (LocalDate weekStart = earliestWeekStart; !weekStart.isAfter(latestWeekStart);
                    weekStart = weekStart.plusWeeks(1)) {
                try {
                    if (conferenceService.runWeekly(user.getId(), weekStart) != null) {
                        held++;
                    }
                } catch (Exception e) {
                    log.warn("Character conference run failed for user {} week {}", user.getId(), weekStart, e);
                }
            }
            log.info("Character conference run for user {}: {} konzílium(s) held in window {}..{}",
                    user.getId(), held, earliestWeekStart, latestWeekStart);
        }
    }
}
