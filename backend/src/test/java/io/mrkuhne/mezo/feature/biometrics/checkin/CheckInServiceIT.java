package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.CravingKind;
import io.mrkuhne.mezo.api.dto.PainRegion;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class CheckInServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.parse("2026-06-01");

    @Autowired private CheckInService service;
    @Autowired private CheckInRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;

    @Test
    void testSave_shouldUpsertSameSlot_whenSavedTwice() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.save(user, SaveCheckInRequest.builder().date(DAY).slotTime("09:00").state("done")
            .energy(7).stress(4).body(6).mental(8).build());
        service.save(user, SaveCheckInRequest.builder().date(DAY).slotTime("09:00").state("done")
            .energy(8).stress(3).body(7).mental(9).note("better").build());

        var rows = service.listForDay(user, DAY);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getEnergy()).isEqualTo(8);
        assertThat(rows.get(0).getNote()).isEqualTo("better");
    }

    @Test
    void testSave_shouldRoundTripEveryField_whenCheckIn2FieldsSent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        List<CheckInItemId> asked = List.of(CheckInItemId.ENERGY, CheckInItemId.MOOD, CheckInItemId.STRESS,
            CheckInItemId.BODY, CheckInItemId.MENTAL, CheckInItemId.SORENESS, CheckInItemId.PAIN,
            CheckInItemId.CRAVING, CheckInItemId.DIGESTION, CheckInItemId.CONNECTION, CheckInItemId.DAY,
            CheckInItemId.MOTIVATION);
        service.save(user, SaveCheckInRequest.builder().date(DAY).slotTime("20:00").state("done")
            .energy(6).mood(8).stress(3).body(5).mental(7)
            .rested(4).soreness(6)
            .pain(true).painRegions(List.of(PainRegion.TERD, PainRegion.DEREK)).painIntensity(5)
            .motivation(9).hunger(2)
            .craving(7).cravingKinds(List.of(CravingKind.EDES))
            .digestion(4).connection(8).dayRating(7)
            .askedItems(asked).adaptiveItem(CheckInItemId.MOTIVATION).adaptiveReason(AdaptiveReason.NEED)
            .quickExit(false).note("Jó nap")
            .build());
        entityManager.flush();
        entityManager.clear();

        CheckInResponse got = service.listForDay(user, DAY).getFirst();
        assertThat(got.getEnergy()).isEqualTo(6);
        assertThat(got.getMood()).isEqualTo(8);
        assertThat(got.getStress()).isEqualTo(3);
        assertThat(got.getBody()).isEqualTo(5);
        assertThat(got.getMental()).isEqualTo(7);
        assertThat(got.getRested()).isEqualTo(4);
        assertThat(got.getSoreness()).isEqualTo(6);
        assertThat(got.getPain()).isTrue();
        assertThat(got.getPainRegions()).containsExactly(PainRegion.TERD, PainRegion.DEREK);
        assertThat(got.getPainIntensity()).isEqualTo(5);
        assertThat(got.getMotivation()).isEqualTo(9);
        assertThat(got.getHunger()).isEqualTo(2);
        assertThat(got.getCraving()).isEqualTo(7);
        assertThat(got.getCravingKinds()).containsExactly(CravingKind.EDES);
        assertThat(got.getDigestion()).isEqualTo(4);
        assertThat(got.getConnection()).isEqualTo(8);
        assertThat(got.getDayRating()).isEqualTo(7);
        assertThat(got.getAskedItems()).containsExactlyElementsOf(asked);
        assertThat(got.getAdaptiveItem()).isEqualTo(CheckInItemId.MOTIVATION);
        assertThat(got.getAdaptiveReason()).isEqualTo(AdaptiveReason.NEED);
        assertThat(got.getQuickExit()).isFalse();
        assertThat(got.getNote()).isEqualTo("Jó nap");

        // Stored values are the wire ids / enum names (the DB CHECKs rely on that).
        CheckInEntity row = repository.findByCreatedByAndDateAndSlotTime(user, DAY, "20:00").orElseThrow();
        assertThat(row.getAskedItems()).startsWith("energy", "mood").contains("day");
        assertThat(row.getAdaptiveItem()).isEqualTo("motivation");
        assertThat(row.getAdaptiveReason()).isEqualTo("NEED");
    }

    @Test
    void testSave_shouldKeepEverythingElseNull_whenQuickExitAfterCoreFive() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.save(user, SaveCheckInRequest.builder().date(DAY).slotTime("06:30").state("done")
            .energy(7).mood(6).stress(4).body(5).mental(8)
            .askedItems(List.of(CheckInItemId.ENERGY, CheckInItemId.MOOD, CheckInItemId.STRESS,
                CheckInItemId.BODY, CheckInItemId.MENTAL))
            .quickExit(true)
            .build());
        entityManager.flush();
        entityManager.clear();

        CheckInResponse got = service.listForDay(user, DAY).getFirst();
        assertThat(got.getQuickExit()).isTrue();
        assertThat(got.getMood()).isEqualTo(6);
        assertThat(got).extracting(CheckInResponse::getRested, CheckInResponse::getSoreness,
                CheckInResponse::getPain, CheckInResponse::getPainRegions, CheckInResponse::getPainIntensity,
                CheckInResponse::getMotivation, CheckInResponse::getHunger, CheckInResponse::getCraving,
                CheckInResponse::getCravingKinds, CheckInResponse::getDigestion, CheckInResponse::getConnection,
                CheckInResponse::getDayRating, CheckInResponse::getAdaptiveItem, CheckInResponse::getAdaptiveReason,
                CheckInResponse::getNote)
            .containsOnlyNulls();
    }

    @Test
    void testSave_shouldStoreNullsAndNoQuickExit_whenLegacyFourFieldPayload() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.save(user, SaveCheckInRequest.builder().date(DAY).slotTime("10:00").state("done")
            .energy(5).stress(5).body(5).mental(5).build());
        entityManager.flush();
        entityManager.clear();

        CheckInEntity row = repository.findByCreatedByAndDateAndSlotTime(user, DAY, "10:00").orElseThrow();
        assertThat(row.getMood()).isNull();
        assertThat(row.getAskedItems()).isNull();
        assertThat(row.getPainRegions()).isNull();
        assertThat(row.isQuickExit()).isFalse();
    }
}
