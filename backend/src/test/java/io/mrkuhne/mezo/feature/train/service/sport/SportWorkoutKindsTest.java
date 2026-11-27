package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Boop Sport S1/S2 (mezo-r36n9.201/.202): which Health workout may tick which layer. */
class SportWorkoutKindsTest {

    @Test
    void strengthIsGymNeverSport() {
        assertThat(SportWorkoutKinds.isGym("strength")).isTrue();
        assertThat(SportWorkoutKinds.isGym("traditionalStrengthTraining")).isTrue();
        assertThat(SportWorkoutKinds.fitsSport("strength", "volleyball")).isFalse();
    }

    @Test
    void volleyballIsSportNeverGym() {
        assertThat(SportWorkoutKinds.isGym("volleyball")).isFalse();
        assertThat(SportWorkoutKinds.fitsSport("volleyball", "volleyball")).isTrue();
        assertThat(SportWorkoutKinds.fitsSport("volleyball", "running")).isFalse();
    }

    @Test
    void eachSportFindsItsOwnHealthType() {
        assertThat(SportWorkoutKinds.fitsSport("running", "running")).isTrue();
        assertThat(SportWorkoutKinds.fitsSport("cycling", "bike")).isTrue();
        assertThat(SportWorkoutKinds.fitsSport("hiking", "hike")).isTrue();
        assertThat(SportWorkoutKinds.fitsSport("walking", "hike")).isFalse();
        assertThat(SportWorkoutKinds.fitsSport("hiit", "cross")).isTrue();
        assertThat(SportWorkoutKinds.fitsSport("hiit", "trx")).isTrue();
    }

    @Test
    void otherTicksNothing() {
        assertThat(SportWorkoutKinds.isGym("other")).isFalse();
        assertThat(SportWorkoutKinds.fitsSport("other", "volleyball")).isFalse();
        assertThat(SportWorkoutKinds.fitsSport("other", "other")).isFalse();
        assertThat(SportWorkoutKinds.isGym(null)).isFalse();
    }

    @Test
    void sportOfNamesOnlyUnambiguousKinds() {
        assertThat(SportWorkoutKinds.sportOf("volleyball")).isEqualTo("volleyball");
        assertThat(SportWorkoutKinds.sportOf("cycling")).isEqualTo("bike");
        assertThat(SportWorkoutKinds.sportOf("soccer")).isEqualTo("football");
        assertThat(SportWorkoutKinds.sportOf("hiit")).isNull();
        assertThat(SportWorkoutKinds.sportOf("strength")).isNull();
        assertThat(SportWorkoutKinds.sportOf("other")).isNull();
        assertThat(SportWorkoutKinds.sportOf(null)).isNull();
    }
}
