package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.api.dto.RadarAxis;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionProfileServiceIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressPopulator skillPop;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testGetProfile_shouldReturnGhost_whenNoSkillRows() {
        UUID user = databasePopulator.populateUser("ghost@test.local");

        ProgressionProfileResponse p = progressionService.getProfile(user);

        assertThat(p.getAthleteLevel()).isNull();              // ghost
        assertThat(p.getStreakWeeks()).isZero();
        assertThat(p.getAthletic()).hasSize(12);               // 11 + robustness, all level 1
        assertThat(p.getMuscle()).hasSize(13);
        assertThat(p.getAthletic()).allSatisfy(s -> assertThat(s.getLevel()).isEqualTo(1));
        assertThat(p.getRadarAxes()).extracting(RadarAxis::getAxis)
            .containsExactly("Erő", "Robbanékonyság", "Sebesség", "Állóképesség", "Mozgékonyság", "Koordináció");
        assertThat(p.getHighlights().getBestAthletic()).isNull();
        assertThat(p.getHighlights().getBestMuscle()).isNull();
    }

    @Test
    void testGetProfile_shouldDeriveAthleteLevelOverElevenAthletic_whenRowsExist() {
        UUID user = databasePopulator.populateUser("athlete@test.local");
        skillPop.createSkill(user, "max_strength", "ATHLETIC", 303L, 3);
        skillPop.createSkill(user, "sprint_speed", "ATHLETIC", 303L, 3);

        ProgressionProfileResponse p = progressionService.getProfile(user);

        // (3 + 3 + 1*9) / 11 = 15/11 = 1.36 -> 1.4
        assertThat(p.getAthleteLevel().doubleValue()).isEqualTo(1.4);
        assertThat(axis(p, "Sebesség")).isEqualTo(3.0); // sprint_speed level
        assertThat(p.getHighlights().getBestAthletic().getSkillKey()).isIn("max_strength", "sprint_speed");
        assertThat(p.getHighlights().getBestAthletic().getLevel()).isEqualTo(3);
    }

    @Test
    void testGetProfile_shouldBlendMuscleMeanIntoEroAxis_whenMaxStrengthAndMusclesLogged() {
        UUID user = databasePopulator.populateUser("ero@test.local");
        skillPop.createSkill(user, "max_strength", "ATHLETIC", 919L, 5);
        skillPop.createSkill(user, "chest", "MUSCLE", 303L, 3);

        ProgressionProfileResponse p = progressionService.getProfile(user);

        // muscleMean = (3 + 1*12) / 13 = 15/13 = 1.1538; Erő = 5*0.5 + 1.1538*0.5 = 3.0769 -> 3.1
        assertThat(axis(p, "Erő")).isEqualTo(3.1);
        assertThat(p.getHighlights().getBestMuscle().getSkillKey()).isEqualTo("chest");
    }

    @Test
    void testGetProfile_shouldExcludeRobustnessFromAthleteLevelAndRadar_whenRobustnessHigh() {
        UUID user = databasePopulator.populateUser("rob@test.local");
        skillPop.createSkill(user, "robustness", "ATHLETIC", 5000L, 10);

        ProgressionProfileResponse p = progressionService.getProfile(user);

        // all 11 non-robustness athletic are level 1 -> athleteLevel 1.0 (robustness ignored)
        assertThat(p.getAthleteLevel().doubleValue()).isEqualTo(1.0);
        assertThat(p.getAthletic()).anySatisfy(s -> assertThat(s.getSkillKey()).isEqualTo("robustness"));
        assertThat(p.getRadarAxes()).extracting(RadarAxis::getAxis).doesNotContain("Robusztusság", "robustness");
        // robustness is not a "best athletic" highlight either
        assertThat(p.getHighlights().getBestAthletic()).isNull();
    }

    private double axis(ProgressionProfileResponse p, String name) {
        return p.getRadarAxes().stream().filter(a -> a.getAxis().equals(name))
            .findFirst().orElseThrow().getValue().doubleValue();
    }
}
