package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepDebtRule implements FlagRule {

    private final SleepDeficitCalculator sleepDeficitCalculator;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.SleepDebt cfg = properties.sleepDebt();
        // The window ends TODAY: sleep_log.date is the wake morning, so today's row is last
        // night. See SleepDeficitCalculator for the full date-semantics note.
        LocalDate to = today;
        LocalDate from = to.minusDays(cfg.nights() - 1L);
        SleepDeficitCalculator.Deficit d = sleepDeficitCalculator.over(userId, from, to);

        if (d.loggedNights() < cfg.minNights()) {
            // Not "the user slept fine" — we do not have the nights to say anything.
            return FlagVerdict.unavailable(FlagKey.SLEEP_DEBT,
                UnavailableReason.NOT_ENOUGH_LOGGED_NIGHTS);
        }
        if (d.deficitHours() < cfg.deficitHours()) {
            return FlagVerdict.clear(FlagKey.SLEEP_DEBT, new FlagVerdict.ClearEvidence(
                "deficit_hours", d.deficitHours(), cfg.deficitHours(), null));
        }
        return FlagVerdict.raised(FlagKey.SLEEP_DEBT,
            FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                d.goalHours(), cfg.nights(), d.loggedNights(), cfg.deficitHours(),
                d.deficitHours(), d.byDay())));
    }
}
