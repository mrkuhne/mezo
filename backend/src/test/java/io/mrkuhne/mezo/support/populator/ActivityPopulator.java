package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code activity_log} rows (gamified growth E2, bd mezo-jzca). */
@TestComponent
@RequiredArgsConstructor
public class ActivityPopulator {

    private final ActivityLogRepository repository;

    public ActivityLogEntity activity(UUID createdBy, LocalDate day, String text,
                                      String skillKey, int xpAwarded, String categorizedBy) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(createdBy);
        e.setOccurredOn(day);
        e.setText(text);
        e.setSkillKey(skillKey);
        e.setConfidence(skillKey != null ? new BigDecimal("0.900") : null);
        e.setXpAwarded(xpAwarded);
        e.setXpSuggested(Math.max(xpAwarded, 10));
        e.setExtracted(new ActivityExtract(30, null));
        e.setCategorizedBy(categorizedBy);
        return repository.saveAndFlush(e);
    }
}
