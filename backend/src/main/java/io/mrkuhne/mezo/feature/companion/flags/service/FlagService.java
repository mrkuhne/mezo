package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W5.1 raise path (bd mezo-b3pp.18, spec §9.1): run {@link FlagEvaluator}, drop everything
 * still inside its per-flag cooldown, and append what survives to {@code companion_flag_log} with
 * the inputs frozen in {@code payload}. The ONLY difference between the on-write listener and the
 * hourly sweep is the {@code source} string — same evaluator, same cooldowns, same rows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagService {

    private final FlagEvaluator evaluator;
    private final CompanionFlagLogRepository repository;
    private final FlagProperties properties;
    private final ApplicationEventPublisher eventPublisher;

    /** Evaluates {@code userId} and logs every flag past its cooldown; returns the keys written. */
    @Transactional
    public List<String> evaluateAndLog(UUID userId, String source) {
        List<String> written = new ArrayList<>();
        for (FlagVerdict verdict : evaluator.evaluate(userId)) {
            if (verdict.outcome() != FlagOutcome.RAISED) {
                continue;
            }
            FlagRaise raise = verdict.toRaise();
            Instant coolUntil = Instant.now()
                .minus(properties.cooldownHours().forFlag(raise.flagKey()), ChronoUnit.HOURS);
            if (repository.existsRaiseSince(userId, raise.flagKey(), coolUntil)) {
                continue;
            }
            CompanionFlagLogEntity row = new CompanionFlagLogEntity();
            row.setCreatedBy(userId);
            row.setFlagKey(raise.flagKey());
            row.setSource(source);
            row.setPayload(raise.payload());
            repository.save(row);
            written.add(raise.flagKey());
            eventPublisher.publishEvent(new FlagRaisedEvent(userId, raise.flagKey(), source));
        }
        if (!written.isEmpty()) {
            log.info("Flags raised for user {} ({}): {}", userId, source, written);
        }
        return written;
    }
}
