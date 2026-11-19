package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.service.GymAvailability;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GymAvailabilityTest {

    private static ExerciseCatalogEntity exercise(UUID id, List<String> gear) {
        ExerciseCatalogEntity e = new ExerciseCatalogEntity();
        e.setId(id);
        e.setGear(gear);
        return e;
    }

    private final UUID id = UUID.randomUUID();

    @Test
    void testAvailable_shouldBeFalse_whenIdMissing() {
        assertThat(new GymAvailability(Set.of(), Set.of(id)).available(exercise(id, List.of("machine")))).isFalse();
    }

    @Test
    void testAvailable_shouldBeFalse_whenAKindIsOff() {
        assertThat(new GymAvailability(Set.of("cable"), Set.of())
            .available(exercise(UUID.randomUUID(), List.of("cable")))).isFalse();
    }

    @Test
    void testAvailable_shouldBeFalse_whenOneOfTwoKindsIsOff() {
        assertThat(new GymAvailability(Set.of("bench"), Set.of())
            .available(exercise(UUID.randomUUID(), List.of("barbell", "bench")))).isFalse();
    }

    @Test
    void testAvailable_shouldBeTrue_whenGearNullOrBodyweightOnly() {
        GymAvailability a = new GymAvailability(Set.of("cable", "machine"), Set.of());
        assertThat(a.available(exercise(UUID.randomUUID(), null))).isTrue();
        assertThat(a.available(exercise(UUID.randomUUID(), List.of("bodyweight")))).isTrue();
    }

    @Test
    void testAvailable_shouldBeTrue_whenNothingOffAndNotMissing() {
        assertThat(new GymAvailability(Set.of("cable"), Set.of(UUID.randomUUID()))
            .available(exercise(UUID.randomUUID(), List.of("barbell")))).isTrue();
    }
}
