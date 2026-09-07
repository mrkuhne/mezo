package io.mrkuhne.mezo.feature.companion.mapper;

import io.mrkuhne.mezo.api.dto.PatternTestPlan;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.DerivedSeriesService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Reflexió S2 (mezo-eq85.2): the stored {@link TestPlanEnvelope} → wire {@code PatternTestPlan},
 * with the two series LABELS resolved at read time. The labels are deliberately NOT stored: a
 * {@code people:anna} key's Hungarian rendering is presentation, and freezing it into the row
 * would make an old plan describe itself in yesterday's words.
 *
 * <p>Not a MapStruct {@code uses=} component: {@code CompanionMapper}'s pattern methods are
 * hand-written {@code default} interface methods, which a {@code uses=} mapper cannot reach.
 *
 * <p>{@link DerivedSeriesService} is behind an {@link ObjectProvider} because it only exists while
 * the Reflexió switch is on — and because the companion package already carries a construction
 * cycle broken exactly this way (S1). Labels fall back to the raw key when it is absent: the wire
 * stays honest rather than inventing prose.
 */
@Component
@RequiredArgsConstructor
public class PatternTestPlanMapper {

    private final ObjectProvider<DerivedSeriesService> derivedSeriesService;

    /** Null in → null out: a row without a test plan has nothing to say about falsifiability. */
    public PatternTestPlan toWire(TestPlanEnvelope plan) {
        if (plan == null) {
            return null;
        }
        return PatternTestPlan.builder()
                .seriesA(plan.seriesA())
                .seriesB(plan.seriesB())
                .seriesALabel(label(plan.seriesA()))
                .seriesBLabel(label(plan.seriesB()))
                .lagDays(plan.lagDays())
                .expectedDirection(plan.expectedDirection())
                .minN(plan.minN())
                .windowDays(plan.windowDays())
                .build();
    }

    private String label(String key) {
        DerivedSeriesService service = derivedSeriesService.getIfAvailable();
        return service == null ? key : service.labelOf(key);
    }
}
