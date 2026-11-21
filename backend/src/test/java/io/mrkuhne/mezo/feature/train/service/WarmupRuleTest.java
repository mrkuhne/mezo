package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import java.util.List;
import org.junit.jupiter.api.Test;

class WarmupRuleTest {

    private static GymExerciseInput ex(String muscle, GymExerciseInput.TypeEnum type) {
        return GymExerciseInput.builder().name(muscle).muscle(muscle).type(type).warmupSets(9).workingSets(3).build();
    }

    @Test
    void generatedDayWarmsUpOnlyFirstExercisePerGroup() {
        List<GymExerciseInput> day = List.of(
            ex("chest-mid", GymExerciseInput.TypeEnum.COMPOUND),
            ex("chest-upper", GymExerciseInput.TypeEnum.COMPOUND),
            ex("biceps-long", GymExerciseInput.TypeEnum.ISOLATION),
            ex("chest-lower", GymExerciseInput.TypeEnum.ISOLATION),
            ex("biceps-short", GymExerciseInput.TypeEnum.ISOLATION),
            ex("shoulder-front", GymExerciseInput.TypeEnum.COMPOUND));

        WarmupRule.apply(day, 2, 1);

        assertThat(day).extracting(GymExerciseInput::getWarmupSets).containsExactly(2, 0, 0, 0, 0, 2);
    }

    @Test
    void isolationBeforeCompoundDoesNotUseUpTheGroupsWarmup() {
        List<GymExerciseInput> day = List.of(ex("triceps-long", GymExerciseInput.TypeEnum.ISOLATION),
            ex("triceps-lateral", GymExerciseInput.TypeEnum.COMPOUND), ex("triceps-long", GymExerciseInput.TypeEnum.COMPOUND));

        WarmupRule.apply(day, 2, 1);

        assertThat(day).extracting(GymExerciseInput::getWarmupSets).containsExactly(0, 2, 0);
    }

    @Test
    void nullMuscleIsItsOwnGroup() {
        List<GymExerciseInput> day = List.of(ex(null, GymExerciseInput.TypeEnum.ISOLATION),
            ex(null, GymExerciseInput.TypeEnum.ISOLATION), ex("chest-mid", GymExerciseInput.TypeEnum.COMPOUND));

        WarmupRule.apply(day, 2, 1);

        assertThat(day).extracting(GymExerciseInput::getWarmupSets).containsExactly(0, 0, 2);
    }
}
