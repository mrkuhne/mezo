package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.ExpenditureEstimateRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** Serving the learned base as Alap (mezo-zz91i, spec §5.6). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LearnedBaseResolverTest {

    private static final UUID USER = UUID.randomUUID();
    private static final TdeeBootstrapJson FORMULA = new TdeeBootstrapJson(
        new BigDecimal("1900.00"), new BigDecimal("1.42"), new BigDecimal("2700.00"), new BigDecimal("400.00"),
        new BigDecimal("3100.00"), "MSJ", OffsetDateTime.parse("2026-09-21T06:00:00Z"), 2);

    @Mock private ExpenditureEstimateRepository estimates;
    @Mock private GoalEngineProperties props;

    private LearnedBaseResolver resolver;

    @BeforeEach
    void setUp() {
        when(props.expenditure()).thenReturn(ExpenditureFilterTest.defaults());
        resolver = new LearnedBaseResolver(props, estimates);
    }

    @Test
    void noEstimateRowServesTheFormulaUnchanged() {
        when(estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(USER)).thenReturn(Optional.empty());

        assertThat(resolver.apply(USER, FORMULA)).isSameAs(FORMULA);
    }

    @Test
    void aLearnedRowReplacesTheAlapAndKeepsTheFormulaNextToIt() {
        when(estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(USER))
            .thenReturn(Optional.of(row(2500, 140, "MEDIUM")));

        TdeeBootstrapJson served = resolver.apply(USER, FORMULA);

        assertThat(served.neatBaselineKcal()).isEqualByComparingTo("2500");
        assertThat(served.tdee()).isEqualByComparingTo("2900");
        assertThat(served.baseSource()).isEqualTo("learned");
        assertThat(served.learned()).isTrue();
        assertThat(served.formulaNeatBaselineKcal()).isEqualByComparingTo("2700");
        assertThat(served.learnedSdKcal()).isEqualTo(140);
        assertThat(served.learnedConfidence()).isEqualTo("MEDIUM");
        // Everything else is the formula's.
        assertThat(served.bmr()).isEqualByComparingTo("1900");
        assertThat(served.neat()).isEqualByComparingTo("1.42");
        assertThat(served.weeklyEatKcalPerDay()).isEqualByComparingTo("400");
        assertThat(served.formula()).isEqualTo("MSJ");
        assertThat(served.computedAt()).isEqualTo(FORMULA.computedAt());
        assertThat(served.activityModel()).isEqualTo(2);
    }

    @Test
    void aStoredBaseOutsideTodaysRailsIsReRailed() {
        // The formula dropped after a weigh-in: formula 2700, bmr 1900 → lo = max(1755, 2090) = 2090.
        when(estimates.findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(USER))
            .thenReturn(Optional.of(row(2000, 140, "MEDIUM")));

        TdeeBootstrapJson served = resolver.apply(USER, FORMULA);

        assertThat(served.neatBaselineKcal()).isEqualByComparingTo("2090");
        assertThat(served.tdee()).isEqualByComparingTo("2490");
    }

    @Test
    void disabledServesTheFormula() {
        GoalEngineProperties.Expenditure d = ExpenditureFilterTest.defaults();
        when(props.expenditure()).thenReturn(new GoalEngineProperties.Expenditure(false, d.windowDays(),
            d.sigmaScaleKg(), d.sigmaTissueKg(), d.sigmaInitMassKg(), d.sigmaInitWaterKg(), d.intakeErrorPct(),
            d.sigmaUnknownKcal(), d.waterPhi(),
            d.sigmaWaterKg(), d.sigmaBaseKcal(), d.glycogenKgPerG(), d.glycogenMaxKg(), d.glycogenAlpha(),
            d.suspiciousRatio(), d.referenceDays(), d.minReferenceDays(), d.minUsableDays(),
            d.minUsableDaysPerWeek(), d.minWeighInDaysPerWeek(), d.maxStepKcal(), d.deadBandKcal(),
            d.maxDeviation(), d.minBaseBmrRatio(), d.highConfidenceSdKcal(), d.mediumConfidenceSdKcal(), d.waterEventKg()));

        assertThat(resolver.apply(USER, FORMULA)).isSameAs(FORMULA);
        verifyNoInteractions(estimates);
    }

    @Test
    void aNullOrIncompleteBootstrapPassesThrough() {
        assertThat(resolver.apply(USER, null)).isNull();
        verifyNoInteractions(estimates);
    }

    private static ExpenditureEstimateEntity row(int applied, int sd, String confidence) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setAppliedBaseKcal(applied);
        e.setPosteriorSdKcal(sd);
        e.setConfidence(confidence);
        e.setFormulaBaseKcal(2700);
        return e;
    }
}
