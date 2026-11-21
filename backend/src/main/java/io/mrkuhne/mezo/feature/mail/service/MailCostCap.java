package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The per-day mail LLM cap (spec §5.7, mezo-r36n9.38): the morning post may spend {@code mezo.mail.daily-usd-cap}
 * (USD 0.15, about EUR 3 a month) per Budapest day across its three call slugs; at or over it the rest of the run is
 * rules-only and the page says so. Scoped to the mail slugs ({@link LlmLogRepository#costForOwnerFeatureSince}), the
 * {@code TeamChatBudget} shape — a different feature's spend never eats into it.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailCostCap {

    private static final List<String> SLUGS = List.of(LlmCallContext.FEATURE_MAIL_CLASSIFY,
        LlmCallContext.FEATURE_MAIL_SCORE, LlmCallContext.FEATURE_MAIL_SCREEN);

    private final LlmLogRepository llmLogRepository;
    private final MailProperties properties;

    /** {@code owner}'s mail spend since the start of {@code now}'s Budapest day is still under the cap. */
    public boolean allows(UUID owner, ZonedDateTime now) {
        ZoneId zone = ZoneId.of(properties.zone());
        Instant dayStart = now.withZoneSameInstant(zone).toLocalDate().atStartOfDay(zone).toInstant();
        BigDecimal spent = BigDecimal.ZERO;
        for (String slug : SLUGS) {
            spent = spent.add(llmLogRepository.costForOwnerFeatureSince(owner, slug, dayStart));
        }
        return spent.compareTo(BigDecimal.valueOf(properties.dailyUsdCap())) < 0;
    }
}
