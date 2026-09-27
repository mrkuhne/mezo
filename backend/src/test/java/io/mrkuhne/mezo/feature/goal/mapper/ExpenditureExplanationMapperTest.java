package io.mrkuhne.mezo.feature.goal.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExpenditureExplanationResponse;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

/**
 * "Hogy tanultam?" (mezo-y72o3) mapper — fix round 1: {@code tissueRateKgPerWeek} is genuinely
 * nullable ({@code ExpenditureExplainer} sets it {@code null} with no trace, e.g. a HOLDING week
 * with no weigh-ins in the window), and must serialise as an absent field on the wire, not a
 * fabricated 0.
 */
class ExpenditureExplanationMapperTest {

    private final ExpenditureExplanationMapper mapper = Mappers.getMapper(ExpenditureExplanationMapper.class);

    @Test
    void aHoldingWeekWithNoTraceCarriesANullTissueRate() {
        ExpenditureEstimateEntity entity = new ExpenditureEstimateEntity();
        entity.setWeekStart(LocalDate.of(2026, 9, 14));
        entity.setStatus("HOLDING");
        entity.setFormulaBaseKcal(2200);
        entity.setPosteriorBaseKcal(2150);
        entity.setPosteriorSdKcal(120);
        entity.setAppliedBaseKcal(2180);
        entity.setStepKcal(0);
        entity.setConfidence("LOW");

        ExpenditureExplanationJson explanation = new ExpenditureExplanationJson(
            LocalDate.of(2026, 8, 20), LocalDate.of(2026, 9, 14), null, 0, 0, 25, 0,
            null, null, null, null, null, 2180,
            List.of(), List.of(), List.of());

        ExpenditureExplanationResponse response = mapper.toResponse(entity, explanation);

        assertThat(response.getTissueRateKgPerWeek()).isNull();
        assertThat(response.getTissueKcalPerDay()).isNull();
        assertThat(response.getSimpleBaseKcal()).isNull();
        assertThat(response.getAvgIntakeKcal()).isNull();
        assertThat(response.getAvgMovementKcal()).isNull();
        assertThat(response.getDataStart()).isNull();
        assertThat(response.getStatus()).isEqualTo(ExpenditureExplanationResponse.StatusEnum.HOLDING);
    }

    @Test
    void anOrdinaryWeekCarriesItsTissueRate() {
        ExpenditureEstimateEntity entity = new ExpenditureEstimateEntity();
        entity.setCreatedBy(UUID.randomUUID());
        entity.setWeekStart(LocalDate.of(2026, 9, 14));
        entity.setStatus("LEARNING");
        entity.setFormulaBaseKcal(2200);
        entity.setPosteriorBaseKcal(2150);
        entity.setPosteriorSdKcal(120);
        entity.setAppliedBaseKcal(2180);
        entity.setStepKcal(20);
        entity.setConfidence("LOW");

        ExpenditureExplanationJson explanation = new ExpenditureExplanationJson(
            LocalDate.of(2026, 7, 21), LocalDate.of(2026, 9, 14), LocalDate.of(2026, 8, 15), 20, 15, 5, 5,
            2200, 300, new BigDecimal("-0.30"), -150, 2350, 2180,
            List.of(), List.of(), List.of());

        ExpenditureExplanationResponse response = mapper.toResponse(entity, explanation);

        assertThat(response.getTissueRateKgPerWeek()).isEqualByComparingTo(new BigDecimal("-0.30"));
    }
}
