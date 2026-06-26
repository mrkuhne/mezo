package io.mrkuhne.mezo.feature.medication;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MedicationDoseRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

/**
 * HTTP-level contract IT for the Fuel "Gyógyszer" slice (drives the generated {@code MedicationApi}
 * over the real stack). Logging today's first dose against the owner's Retatrutide row returns 201,
 * and the day read then reports {@code retaDay 1} — the day-of-dose is the first cycle day.
 */
class MedicationApiIT extends ApiIntegrationTest {

    @Autowired private MedicationPopulator medPop;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testLogDose_shouldReturn201AndStartCycle_whenPostedToday() {
        MedicationEntity med = medPop.createReta(ownerId());
        // Dose administered TODAY (07:00 UTC): not in the future, and the cycle is derived for
        // today, so days-since-last-dose is 0 -> retaDay 1 (the first cycle day).
        MedicationDoseRequest req = new MedicationDoseRequest();
        req.setDose(new BigDecimal("6"));
        req.setAdministeredAt(OffsetDateTime.of(
            LocalDate.now(ZoneOffset.UTC).atTime(7, 0), ZoneOffset.UTC));

        ResponseEntity<String> res = exchangeForResponse(
            HttpMethod.POST, "/api/medication/" + med.getId() + "/dose", req, ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(201);

        ResponseEntity<String> day = exchangeForResponse(
            HttpMethod.GET, "/api/medication", null, ownerAuthHeaders());
        assertThat(day.getStatusCode().value()).isEqualTo(200);
        assertThat(day.getBody()).contains("\"retaDay\":1");
    }
}
