package io.mrkuhne.mezo.feature.progression.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class LevelUpResultMapperTest {

    private final LevelUpResultMapper mapper = new LevelUpResultMapper();

    @Test
    void testToDto_shouldCopyAllFields_whenGivenEntityPayload() {
        var entity = new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult(
            "GYM", "Klasszik kondi", 58, 8, 480L,
            List.of(new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult.Gain(
                "max_strength", "ATHLETIC", "Maximális erő", null, 120L, 6, 7, 70.0, 12.0)),
            List.of("max_strength"),
            List.of(new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult.Perk(
                "max_strength", "iron_core_2", "Vas-törzs II", "+6%", 5)),
            new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult.Robustness(25L, 5));

        io.mrkuhne.mezo.api.dto.LevelUpResult dto = mapper.toDto(entity);

        assertThat(dto.getSource()).isEqualTo(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.GYM);
        assertThat(dto.getWorkoutLabel()).isEqualTo("Klasszik kondi");
        assertThat(dto.getDurationMin()).isEqualTo(58);
        assertThat(dto.getRpe()).isEqualTo(8);
        assertThat(dto.getTotalXp()).isEqualTo(480L);
        assertThat(dto.getGains()).hasSize(1);
        assertThat(dto.getGains().get(0).getSkillKey()).isEqualTo("max_strength");
        assertThat(dto.getGains().get(0).getKind())
            .isEqualTo(io.mrkuhne.mezo.api.dto.LevelUpGain.KindEnum.ATHLETIC);
        assertThat(dto.getGains().get(0).getName()).isEqualTo("Maximális erő");
        assertThat(dto.getGains().get(0).getIcon()).isNull();
        assertThat(dto.getGains().get(0).getXpGained()).isEqualTo(120L);
        assertThat(dto.getGains().get(0).getLevelBefore()).isEqualTo(6);
        assertThat(dto.getGains().get(0).getLevelAfter()).isEqualTo(7);
        assertThat(dto.getGains().get(0).getProgressFromPct())
            .isEqualByComparingTo(java.math.BigDecimal.valueOf(70.0));
        assertThat(dto.getGains().get(0).getProgressToPct())
            .isEqualByComparingTo(java.math.BigDecimal.valueOf(12.0));
        assertThat(dto.getLevelUps()).containsExactly("max_strength");
        assertThat(dto.getPerks()).hasSize(1);
        assertThat(dto.getPerks().get(0).getSkillKey()).isEqualTo("max_strength");
        assertThat(dto.getPerks().get(0).getPerkKey()).isEqualTo("iron_core_2");
        assertThat(dto.getPerks().get(0).getName()).isEqualTo("Vas-törzs II");
        assertThat(dto.getPerks().get(0).getEffectCopy()).isEqualTo("+6%");
        assertThat(dto.getPerks().get(0).getMilestoneLevel()).isEqualTo(5);
        assertThat(dto.getRobustness().getXpGained()).isEqualTo(25L);
        assertThat(dto.getRobustness().getStreakWeeks()).isEqualTo(5);
    }

    @Test
    void testToDto_shouldReturnNull_whenGivenNull() {
        assertThat(mapper.toDto(null)).isNull();
    }
}
