package io.mrkuhne.mezo.feature.capacity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CapacityAdjustment;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentDraft;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload;
import io.mrkuhne.mezo.feature.capacity.service.DayAdjustmentService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Boop B7 K3 (mezo-r36n9.17): the ledger's HTTP surface — {@code GET /api/capacity/adjustments} lists the rows that
 * change a day of the range (any state), {@code DELETE /api/capacity/adjustments/{id}} undoes the bundle (204, then
 * 409 once settled, 404 for a foreign or missing row). Real clock: the step sits on today in the owner zone.
 */
class CapacityAdjustmentApiIT extends ApiIntegrationTest {

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @Autowired private CapacityProposalRepository proposals;
    @Autowired private DayAdjustmentService ledger;

    @Test
    void listThenUndo() {
        RegisteredUser user = registerUser("cap-adj-api");
        LocalDate today = LocalDate.now(BUD);
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setCreatedBy(user.id());
        p.setWeekStart(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        p.setKind("SHIFT_BEDTIME");
        p.setBundle(AdjustmentDraft.toBundle(List.of(AdjustmentDraft.of(
            new AdjustmentPayload.ShiftBedtime(today, LocalTime.of(23, 30))))));
        p.setTitle("például: később fekszel");
        p.setGeneratorVersion((short) 1);
        p.setStatus("open");
        UUID id = ledger.applyBundle(user.id(), proposals.saveAndFlush(p).getId(), UUID.randomUUID()).get(0).id();
        String range = "/api/capacity/adjustments?from=" + today + "&to=" + today;

        List<CapacityAdjustment> rows = getForList(range, user.headers(), HttpStatus.OK, CapacityAdjustment.class);
        assertThat(rows).singleElement().satisfies(r -> {
            assertThat(r.getId()).isEqualTo(id);
            assertThat(r.getKind()).isEqualTo(CapacityAdjustment.KindEnum.SHIFT_BEDTIME);
            assertThat(r.getState()).isEqualTo(CapacityAdjustment.StateEnum.ACTIVE);
            assertThat(r.getPayload()).containsEntry("bedtime", "23:30").containsEntry("night", today.toString());
        });
        RegisteredUser stranger = registerUser("cap-adj-api-other");
        assertThat(getForList(range, stranger.headers(), HttpStatus.OK, CapacityAdjustment.class)).isEmpty();
        deleteAndExpect("/api/capacity/adjustments/" + id, stranger.headers(), HttpStatus.NOT_FOUND);

        deleteAndExpect("/api/capacity/adjustments/" + id, user.headers(), HttpStatus.NO_CONTENT);
        deleteAndExpect("/api/capacity/adjustments/" + id, user.headers(), HttpStatus.CONFLICT);
        assertThat(getForList(range, user.headers(), HttpStatus.OK, CapacityAdjustment.class)).singleElement()
            .satisfies(r -> assertThat(r.getState()).isEqualTo(CapacityAdjustment.StateEnum.UNDONE));

        String body = getForBody("/api/capacity/adjustments?from=" + today + "&to=" + today.minusDays(1),
            user.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "to", "VALIDATION_INVALID_VALUE");
    }
}
