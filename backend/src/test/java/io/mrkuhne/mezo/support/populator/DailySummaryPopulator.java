package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.LocalDate;
import java.util.UUID;

/** Test data factory for {@code daily_summary} rows (V2.2). */
@TestComponent
@RequiredArgsConstructor
public class DailySummaryPopulator {

    private final DailySummaryRepository dailySummaryRepository;

    /** Any valid summary for the given day. */
    public DailySummaryEntity summary(UUID createdBy, LocalDate summaryDate) {
        return summary(createdBy, summaryDate, "Tegnap edzés és rendben tartott makrók. (" + summaryDate + ")");
    }

    public DailySummaryEntity summary(UUID createdBy, LocalDate summaryDate, String narrative) {
        DailySummaryEntity entity = new DailySummaryEntity();
        entity.setCreatedBy(createdBy);
        entity.setSummaryDate(summaryDate);
        entity.setNarrative(narrative);
        return dailySummaryRepository.saveAndFlush(entity);
    }
}
