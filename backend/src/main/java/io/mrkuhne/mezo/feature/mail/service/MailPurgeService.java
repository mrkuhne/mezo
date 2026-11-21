package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Drops raw mail bodies once they are older than {@code rawRetentionDays} (30); classified items stay (spec §5.2). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailPurgeService {

    private final MailProperties properties;
    private final MailIntakeStore store;

    /** Nulls {@code body_redacted} of mail received more than the retention before {@code now}; returns the count. */
    public int purge(Instant now) {
        return store.purgeBodiesBefore(now.minus(Duration.ofDays(properties.rawRetentionDays())));
    }
}
