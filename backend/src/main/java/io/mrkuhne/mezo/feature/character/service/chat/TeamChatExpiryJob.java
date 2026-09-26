package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Csapatfal Act III (mezo-a9bo7.21): once a day, every ügy still OPEN after
 * {@code mezo.character.team-chat.expire-after-days} becomes EXPIRED. One global query — no
 * per-user fan-out, the expiry is a plain age cut-off.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
                FeaturesConfiguration.PROACTIVE_SWITCH, FeaturesConfiguration.INTERVENTION_SWITCH,
                FeaturesConfiguration.TEAM_CHAT_SWITCH, FeaturesConfiguration.TEAM_CHAT_EXPIRY_JOB_SWITCH},
        havingValue = "true")
public class TeamChatExpiryJob {

    private final TeamChatService teamChatService;

    @Scheduled(cron = "${mezo.character.team-chat.expiry-cron}", zone = "Europe/Budapest")
    public void run() {
        try {
            int expired = teamChatService.expire(Instant.now());
            log.info("Team chat expiry: {} ügy expired", expired);
        } catch (Exception e) {
            log.warn("Team chat expiry failed", e);
        }
    }
}
