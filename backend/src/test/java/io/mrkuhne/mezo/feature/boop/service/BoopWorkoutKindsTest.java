package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Boop Sport S1 (mezo-r36n9.201): which Health workout may tick which layer. */
class BoopWorkoutKindsTest {

    @Test
    void strengthIsGymNeverSport() {
        assertThat(BoopWorkoutKinds.isGym("strength")).isTrue();
        assertThat(BoopWorkoutKinds.isGym("traditionalStrengthTraining")).isTrue();
        assertThat(BoopWorkoutKinds.fitsSport("strength", "volleyball")).isFalse();
    }

    @Test
    void volleyballIsSportNeverGym() {
        assertThat(BoopWorkoutKinds.isGym("volleyball")).isFalse();
        assertThat(BoopWorkoutKinds.fitsSport("volleyball", "volleyball")).isTrue();
        assertThat(BoopWorkoutKinds.fitsSport("volleyball", "running")).isFalse();
    }

    @Test
    void eachSportFindsItsOwnHealthType() {
        assertThat(BoopWorkoutKinds.fitsSport("running", "running")).isTrue();
        assertThat(BoopWorkoutKinds.fitsSport("cycling", "bike")).isTrue();
        assertThat(BoopWorkoutKinds.fitsSport("walking", "hike")).isTrue();
        assertThat(BoopWorkoutKinds.fitsSport("hiit", "cross")).isTrue();
        assertThat(BoopWorkoutKinds.fitsSport("hiit", "trx")).isTrue();
    }

    @Test
    void otherTicksNothing() {
        assertThat(BoopWorkoutKinds.isGym("other")).isFalse();
        assertThat(BoopWorkoutKinds.fitsSport("other", "volleyball")).isFalse();
        assertThat(BoopWorkoutKinds.fitsSport("other", "other")).isFalse();
        assertThat(BoopWorkoutKinds.isGym(null)).isFalse();
    }
}
