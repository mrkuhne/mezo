package io.mrkuhne.mezo.feature.medication;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.MedicationDoseRequest;
import io.mrkuhne.mezo.feature.medication.service.MedicationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class MedicationServiceIT extends AbstractIntegrationTest {

    @Autowired MedicationService service;
    @Autowired MedicationPopulator medPop;
    @Autowired DatabasePopulator databasePopulator;
    UUID owner, other;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    @Test
    void testLogDose_shouldAppendDoseAndShiftCycle_whenValid() {
        var med = medPop.createReta(owner);
        var req = new MedicationDoseRequest().dose(new java.math.BigDecimal("6"))
            .administeredAt(java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC));
        var saved = service.logDose(owner, med.getId(), req);
        assertThat(saved.getId()).isNotNull();
        var day = service.getDay(owner);
        assertThat(day.getRecentDoses()).extracting("id").contains(saved.getId());
        assertThat(day.getCycle().getRetaDay()).isEqualTo(1); // dose today → day 1
    }

    @Test
    void testLogDose_shouldReject_whenForeignMedication() {
        var mine = medPop.createReta(owner);
        assertThatThrownBy(() -> service.logDose(other, mine.getId(),
            new MedicationDoseRequest().dose(new java.math.BigDecimal("6"))))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
    }
}
