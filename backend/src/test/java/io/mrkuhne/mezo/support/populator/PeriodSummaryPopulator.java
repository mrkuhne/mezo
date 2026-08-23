package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.PeriodSummaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.LocalDate;
import java.util.UUID;

/** Test data factory for {@code period_summary} rows (W3.2, mezo-b3pp.13). */
@TestComponent
@RequiredArgsConstructor
public class PeriodSummaryPopulator {

    private final PeriodSummaryRepository periodSummaryRepository;

    /** Any valid row for the given period. */
    public PeriodSummaryEntity periodSummary(UUID createdBy, String granularity, LocalDate periodStart) {
        return periodSummary(createdBy, granularity, periodStart,
                "Összefoglaló a(z) " + periodStart + " kezdetű időszakról.");
    }

    public PeriodSummaryEntity periodSummary(UUID createdBy, String granularity, LocalDate periodStart,
                                             String summaryText) {
        PeriodSummaryEntity entity = new PeriodSummaryEntity();
        entity.setCreatedBy(createdBy);
        entity.setGranularity(granularity);
        entity.setPeriodStart(periodStart);
        entity.setSummaryText(summaryText);
        return periodSummaryRepository.saveAndFlush(entity);
    }
}
