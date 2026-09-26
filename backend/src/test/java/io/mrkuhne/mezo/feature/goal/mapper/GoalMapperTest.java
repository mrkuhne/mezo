package io.mrkuhne.mezo.feature.goal.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.TdeeBootstrap;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

/** The tdee bootstrap's learned-base provenance on the wire (mezo-zz91i). */
class GoalMapperTest {

    private final GoalMapper mapper = Mappers.getMapper(GoalMapper.class);
    private static final OffsetDateTime AT = OffsetDateTime.parse("2026-09-21T06:00:00Z");

    @Test
    void aLearnedBootstrapCarriesItsProvenance() {
        TdeeBootstrap dto = mapper.toTdeeBootstrap(new TdeeBootstrapJson(
            new BigDecimal("1900"), new BigDecimal("1.42"), new BigDecimal("2500"), new BigDecimal("400"),
            new BigDecimal("2900"), "MSJ", AT, 2, "learned", new BigDecimal("2700"), 140, "MEDIUM"));

        assertThat(dto.getNeatBaselineKcal()).isEqualByComparingTo("2500");
        assertThat(dto.getBaseSource()).isEqualTo(TdeeBootstrap.BaseSourceEnum.LEARNED);
        assertThat(dto.getFormulaNeatBaselineKcal()).isEqualByComparingTo("2700");
        assertThat(dto.getLearnedSdKcal()).isEqualTo(140);
        assertThat(dto.getLearnedConfidence()).isEqualTo(TdeeBootstrap.LearnedConfidenceEnum.MEDIUM);
    }

    @Test
    void aPreLearningBootstrapReadsAsFormula() {
        TdeeBootstrap dto = mapper.toTdeeBootstrap(new TdeeBootstrapJson(
            new BigDecimal("1900"), new BigDecimal("1.42"), new BigDecimal("2700"), new BigDecimal("400"),
            new BigDecimal("3100"), "MSJ", AT, 2));

        assertThat(dto.getBaseSource()).isEqualTo(TdeeBootstrap.BaseSourceEnum.FORMULA);
        assertThat(dto.getFormulaNeatBaselineKcal()).isNull();
        assertThat(dto.getLearnedSdKcal()).isNull();
        assertThat(dto.getLearnedConfidence()).isNull();
    }
}
