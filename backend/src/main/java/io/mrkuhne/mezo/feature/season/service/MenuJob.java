package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The weekly menu's schedule (Boop B6 Évad S3, spec §5.7): every minute, each active season whose menu day and time
 * have come gets next week's proposal — once (a week that exists is never re-planned here). The owner's wall clock is
 * the Boop zone ({@code mezo.wearable.zone}). One season's failure never stops the others.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mezo.season.menu-job.enabled", havingValue = "true")
public class MenuJob {

    private final SeasonRepository seasons;
    private final MenuService menuService;
    private final WearableProperties wearableProperties;

    @Scheduled(cron = "0 * * * * *")
    public void run() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of(wearableProperties.zone())).truncatedTo(ChronoUnit.MINUTES);
        for (SeasonEntity s : seasons.findByStatus(SeasonEntity.STATUS_ACTIVE)) {
            try {
                if (menuService.generateIfDue(s, now.toLocalDate(), now.toLocalTime())) {
                    log.info("Weekly menu proposed for season {}", s.getId());
                }
            } catch (RuntimeException e) {
                log.warn("Weekly menu generation failed for season {}", s.getId(), e);
            }
        }
    }
}
