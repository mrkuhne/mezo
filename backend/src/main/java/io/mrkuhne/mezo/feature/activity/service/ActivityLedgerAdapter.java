package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.progression.ActivityLedgerSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Activity side of the growth aggregates — see {@link ActivityLedgerSource}. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class ActivityLedgerAdapter implements ActivityLedgerSource {

    private final ActivityLogRepository repository;

    @Override
    public Stats stats(UUID createdBy, LocalDate from, LocalDate to) {
        List<ActivityLogEntity> rows = repository.findByCreatedByAndOccurredOnBetween(createdBy, from, to);
        long savings = rows.stream()
            .filter(r -> "financial".equals(r.getSkillKey()))
            .filter(r -> r.getExtracted() != null && r.getExtracted().amountHuf() != null)
            .mapToLong(r -> r.getExtracted().amountHuf())
            .sum();
        return new Stats(rows.size(), savings);
    }
}
