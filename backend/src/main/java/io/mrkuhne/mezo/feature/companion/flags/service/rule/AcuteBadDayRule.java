package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The most urgent card in the whole system (spec 2026-09-03 §4 row 6, rank 1): same-day ≥
 * {@code minCheckIns} check-ins with body or energy at or below {@code bodyOrEnergyAtMost}.
 *
 * <p>Deliberately does NOT read {@code MetricSeriesService}/{@code MetricKey.CHECKIN_BODY}
 * or {@code CHECKIN_ENERGY} — those are day-AVERAGED, and averaging is exactly what would
 * destroy this signal (two 3s and a 7 average to a healthy-looking 4.3). Instead this rule
 * reads today's raw {@code check_in} rows directly.
 *
 * <p>{@code body}/{@code energy} are nullable 1–10 scores: a null is an unanswered question,
 * never a low score, so it never counts as qualifying.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class AcuteBadDayRule implements FlagRule {

    private final CheckInRepository checkInRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.AcuteBadDay cfg = properties.acuteBadDay();
        List<CheckInEntity> checkIns =
            checkInRepository.findByCreatedByAndDateOrderBySlotTime(userId, today);

        // Honest gate: one bad check-in is a moment, not a day — the spec asks for a PATTERN.
        if (checkIns.size() < cfg.minCheckIns()) {
            return FlagVerdict.unavailable(FlagKey.ACUTE_BAD_DAY,
                UnavailableReason.NOT_ENOUGH_CHECKINS);
        }

        List<FlagPayloadEnvelope.QualifyingCheckIn> qualifying = new ArrayList<>();
        for (CheckInEntity checkIn : checkIns) {
            if (qualifies(checkIn.getBody(), cfg.bodyOrEnergyAtMost())
                || qualifies(checkIn.getEnergy(), cfg.bodyOrEnergyAtMost())) {
                qualifying.add(new FlagPayloadEnvelope.QualifyingCheckIn(
                    checkIn.getSlotTime(), checkIn.getBody(), checkIn.getEnergy()));
            }
        }

        if (qualifying.size() < cfg.minCheckIns()) {
            return FlagVerdict.clear(FlagKey.ACUTE_BAD_DAY, new FlagVerdict.ClearEvidence(
                "bad_checkins", (double) qualifying.size(), (double) cfg.minCheckIns(), null));
        }

        return FlagVerdict.raised(FlagKey.ACUTE_BAD_DAY,
            FlagPayloadEnvelope.acuteBadDay(new FlagPayloadEnvelope.AcuteBadDay(
                cfg.minCheckIns(), cfg.bodyOrEnergyAtMost(), qualifying.size(),
                List.copyOf(qualifying))));
    }

    /** A null score is an unanswered question, never a low one. */
    private static boolean qualifies(Integer score, int atMost) {
        return score != null && score <= atMost;
    }
}
