package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Appends to {@code companion_flag_trace}, but only when a rule's verdict actually CHANGED
 * (spec 2026-09-05 §4.3). The comparison covers the disposition too: a rule that stays RAISED
 * while flipping from LOGGED to SUPPRESSED_BY_COOLDOWN has genuinely changed state, and that is
 * exactly the "why did it go quiet" moment worth recording.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagTraceWriter {

    private final CompanionFlagTraceRepository repository;

    public void record(UUID userId, FlagVerdict verdict, TraceDisposition disposition, Instant at) {
        String outcome = verdict.outcome().name().toLowerCase();
        String reasonCode = verdict.reason() == null ? null : verdict.reason().name().toLowerCase();
        String dispositionValue = disposition == null ? null : disposition.name().toLowerCase();

        CompanionFlagTraceEntity previous = repository
            .findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(userId, verdict.flagKey())
            .orElse(null);
        if (previous != null
            && Objects.equals(previous.getOutcome(), outcome)
            && Objects.equals(previous.getReasonCode(), reasonCode)
            && Objects.equals(previous.getDisposition(), dispositionValue)) {
            return;
        }

        CompanionFlagTraceEntity row = new CompanionFlagTraceEntity();
        row.setCreatedBy(userId);
        row.setFlagKey(verdict.flagKey());
        row.setOutcome(outcome);
        row.setReasonCode(reasonCode);
        row.setDisposition(dispositionValue);
        row.setEvidence(verdict.clear());
        row.setOccurredAt(at);
        repository.save(row);
    }
}
