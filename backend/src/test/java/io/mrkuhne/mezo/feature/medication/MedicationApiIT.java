package io.mrkuhne.mezo.feature.medication;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MedicationCycleConfig;
import io.mrkuhne.mezo.api.dto.MedicationDayResponse;
import io.mrkuhne.mezo.api.dto.MedicationPhase;
import io.mrkuhne.mezo.api.dto.MedicationRequest;
import io.mrkuhne.mezo.api.dto.MedicationResponse;
import io.mrkuhne.mezo.api.dto.MedicationDoseRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * HTTP-level contract IT for the Fuel "Gyógyszer" slice (drives the generated {@code MedicationApi}
 * over the real stack). Logging today's first dose against the owner's test medication row returns
 * 201, and the day read then reports {@code cycleDay 1} — the day-of-dose is the first cycle day.
 */
class MedicationApiIT extends ApiIntegrationTest {

    @Autowired private MedicationPopulator medPop;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /**
     * mezo-5cmq: having NO active medication is a normal state, not an error. The day read answers
     * 200 with an empty payload (no medication, no cycle, no doses) instead of the old 404, which
     * pushed the client onto its error branch on every plain page mount.
     */
    @Test
    void testGetDay_shouldReturn200AndEmptyPayload_whenOwnerHasNoActiveMedication() {
        ResponseEntity<String> res = exchangeForResponse(
            HttpMethod.GET, "/api/medication", null, ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(200);

        // The RAW wire shape is the contract the FE normalizer keys off: the keys are PRESENT and
        // null (Jackson's Include.ALWAYS), not omitted — a DTO round-trip could not tell those apart.
        assertThat(res.getBody())
            .contains("\"medication\":null")
            .contains("\"cycle\":null")
            .contains("\"recentDoses\":[]");

        MedicationDayResponse day = getForBody(
            "/api/medication", ownerAuthHeaders(), HttpStatus.OK, MedicationDayResponse.class);
        assertThat(day.getMedication()).isNull();
        assertThat(day.getCycle()).isNull();
        assertThat(day.getRecentDoses()).isEmpty();
    }

    @Test
    void testLogDose_shouldReturn201AndStartCycle_whenPostedToday() {
        MedicationEntity med = medPop.createMedication(ownerId());
        // Dose administered TODAY at start-of-day UTC: never in the future regardless of when the
        // suite runs (mezo-yc9z), and the cycle is derived for today, so days-since-last-dose is 0
        // -> cycleDay 1 (the first cycle day).
        MedicationDoseRequest req = new MedicationDoseRequest();
        req.setDose(new BigDecimal("6"));
        req.setAdministeredAt(OffsetDateTime.of(
            LocalDate.now(ZoneOffset.UTC).atStartOfDay(), ZoneOffset.UTC));

        ResponseEntity<String> res = exchangeForResponse(
            HttpMethod.POST, "/api/medication/" + med.getId() + "/dose", req, ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(201);

        ResponseEntity<String> day = exchangeForResponse(
            HttpMethod.GET, "/api/medication", null, ownerAuthHeaders());
        assertThat(day.getStatusCode().value()).isEqualTo(200);
        assertThat(day.getBody()).contains("\"cycleDay\":1");
    }

    /**
     * Guard for mezo-d94: a ZONE-LESS administeredAt is REJECTED (never persisted). Jackson's
     * OffsetDateTime deserializer requires a zone offset, so {@code "2026-06-26T00:00:00"} blows up
     * during body binding and never reaches {@code MedicationService} — proving the FE must send an
     * offset-bearing string (the LogDoseSheet fix). NOTE: the status is currently 500, not 400 — the
     * unparseable-body path (HttpMessageNotReadableException) isn't mapped in GlobalExceptionHandler
     * yet, so it falls through to the catch-all INTERNAL_ERROR. That 4xx-vs-5xx mapping is a separate,
     * pre-existing API-hygiene gap (out of scope here); this test only asserts the request is rejected
     * and the cycle is untouched, which is what matters for the dose-date-corruption bug.
     */
    @Test
    void testLogDose_shouldRejectAndNotPersist_whenAdministeredAtHasNoZoneOffset() {
        MedicationEntity med = medPop.createMedication(ownerId());
        // Raw JSON with a zone-LESS administeredAt (no trailing offset / Z).
        String zonelessJson = "{\"dose\":6,\"administeredAt\":\"2026-06-26T00:00:00\"}";
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> res = exchangeForResponse(
            HttpMethod.POST, "/api/medication/" + med.getId() + "/dose", zonelessJson, headers);
        // rejected (4xx/5xx) — never silently accepted
        assertThat(res.getStatusCode().is2xxSuccessful()).isFalse();
        assertThat(res.getStatusCode().value()).isGreaterThanOrEqualTo(400);

        // and nothing was persisted: no doses, so the cycle has no anchor (cycleDay 0).
        ResponseEntity<String> day = exchangeForResponse(
            HttpMethod.GET, "/api/medication", null, ownerAuthHeaders());
        assertThat(day.getStatusCode().value()).isEqualTo(200);
        assertThat(day.getBody()).contains("\"cycleDay\":0");
    }

    /** A contract-complete create body — the same shape the MedicationFormSheet sends. */
    private static MedicationRequest createBody(boolean active) {
        MedicationRequest req = new MedicationRequest();
        req.setName("Retatrutid");
        req.setActiveIngredient("retatrutid");
        req.setRoute("subQ");
        req.setCadence("weekly-monday");
        req.setDefaultDose(new BigDecimal("4"));
        req.setDoseUnit("mg");
        req.setActive(active);
        MedicationCycleConfig cycle = new MedicationCycleConfig();
        cycle.setCycleLengthDays(7);
        MedicationPhase peak = new MedicationPhase();
        peak.setKey(MedicationPhase.KeyEnum.PEAK); peak.setFromDay(1); peak.setToDay(2); peak.setLabel("Csúcs");
        MedicationPhase stable = new MedicationPhase();
        stable.setKey(MedicationPhase.KeyEnum.STABLE); stable.setFromDay(3); stable.setToDay(5); stable.setLabel("Stabil");
        MedicationPhase trough = new MedicationPhase();
        trough.setKey(MedicationPhase.KeyEnum.TROUGH); trough.setFromDay(6); trough.setToDay(7); trough.setLabel("Mélypont");
        cycle.setPhases(List.of(peak, stable, trough));
        req.setCycle(cycle);
        return req;
    }

    /** mezo-d20.8.3: the create path — 201, and the day read then serves the new medication. */
    @Test
    void testCreateMedication_shouldReturn201AndAppearOnDayRead() {
        ownerId(); // ensure the principal row exists
        MedicationResponse created = exchangeForBody(
            HttpMethod.POST, "/api/medication", createBody(true), ownerAuthHeaders(),
            HttpStatus.CREATED, MedicationResponse.class);
        assertThat(created.getId()).isNotNull();
        assertThat(created.getName()).isEqualTo("Retatrutid");
        assertThat(created.getActive()).isTrue();

        MedicationDayResponse day = getForBody(
            "/api/medication", ownerAuthHeaders(), HttpStatus.OK, MedicationDayResponse.class);
        assertThat(day.getMedication()).isNotNull();
        assertThat(day.getMedication().getId()).isEqualTo(created.getId());
        // No dose yet: the cycle is the honest zero, not a fabricated day.
        assertThat(day.getCycle().getCycleDay()).isZero();
    }

    /** One active medication at a time: creating over an existing active row is a 400. */
    @Test
    void testCreateMedication_shouldReturn400_whenActiveMedicationExists() {
        medPop.createMedication(ownerId());
        ResponseEntity<String> res = exchangeForResponse(
            HttpMethod.POST, "/api/medication", createBody(true), ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertThat(res.getBody()).contains("MEDICATION_ACTIVE_EXISTS");
    }

    /** Stop (PUT active:false) then re-create — the normal medication-change path. */
    @Test
    void testCreateMedication_shouldSucceed_afterStoppingTheActiveOne() {
        MedicationEntity old = medPop.createMedication(ownerId());
        MedicationRequest stop = createBody(false);
        exchangeForBody(HttpMethod.PUT, "/api/medication/" + old.getId(), stop, ownerAuthHeaders(),
            HttpStatus.OK, MedicationResponse.class);

        MedicationResponse created = exchangeForBody(
            HttpMethod.POST, "/api/medication", createBody(true), ownerAuthHeaders(),
            HttpStatus.CREATED, MedicationResponse.class);
        assertThat(created.getActive()).isTrue();

        MedicationDayResponse day = getForBody(
            "/api/medication", ownerAuthHeaders(), HttpStatus.OK, MedicationDayResponse.class);
        assertThat(day.getMedication().getId()).isEqualTo(created.getId());
    }
}
