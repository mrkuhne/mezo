package io.mrkuhne.mezo.feature.medication;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.medication.mapper.MedicationMapper;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import org.junit.jupiter.api.Test;

/**
 * Plain JUnit unit test for {@link MedicationMapper} (no Spring) — built via the MapStruct
 * factory exactly like {@code MealMapperTest}. Asserts the derived {@link MedicationCycle} →
 * {@code MedicationCycleResponse} projection: the {@code retaDay} passes through and the cell
 * carrying the {@code current} flag survives the week mapping.
 */
class MedicationMapperTest {

    final MedicationMapper m = org.mapstruct.factory.Mappers.getMapper(MedicationMapper.class);

    @Test
    void testToCycleResponse_shouldMapWeekAndCurrent_whenCycleActive() {
        var cycle = new MedicationCycle(3, "stable", "Stabil",
            java.time.Instant.parse("2026-06-22T00:00:00Z"),
            java.util.List.of(new MedicationCycle.Cell(1, "peak", "Peak", false),
                              new MedicationCycle.Cell(3, "stable", "Stabil", true)));
        var resp = m.toCycleResponse(cycle);
        assertThat(resp.getRetaDay()).isEqualTo(3);
        assertThat(resp.getWeek()).anySatisfy(c -> {
            assertThat(c.getCurrent()).isTrue();
        });
    }
}
