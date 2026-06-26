package io.mrkuhne.mezo.feature.medication;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class MedicationCycleServiceIT extends AbstractIntegrationTest {

    @Autowired MedicationCycleService service;
    @Autowired MedicationPopulator medPop;
    @Autowired MedicationDosePopulator dosePop;
    @Autowired DatabasePopulator databasePopulator;
    UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("a@test.local");
    }

    @Test
    void testDerive_shouldReturnStablePhaseDay3_whenLastDose2DaysAgo() {
        var med = medPop.createReta(owner);
        dosePop.createDose(
            owner, med.getId(), LocalDate.of(2026, 6, 22), new java.math.BigDecimal("6")); // Mon
        var cycle = service.derive(owner, med, LocalDate.of(2026, 6, 24)); // +2 days
        assertThat(cycle.retaDay()).isEqualTo(3);
        assertThat(cycle.phaseKey()).isEqualTo("stable");
        assertThat(cycle.week()).hasSize(7);
        assertThat(cycle.week().get(2).current()).isTrue(); // day 3 is "now"
    }

    @Test
    void testDerive_shouldReturnNoDoseGhost_whenNoDoses() {
        var med = medPop.createReta(owner);
        var cycle = service.derive(owner, med, LocalDate.of(2026, 6, 24));
        assertThat(cycle.retaDay()).isZero(); // honest-zero, no fabricated day
        assertThat(cycle.lastDoseAt()).isNull();
    }
}
