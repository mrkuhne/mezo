package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.IntakeListResponse;
import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class IntakeServiceIT extends AbstractIntegrationTest {

    @Autowired IntakeService service;
    @Autowired PantryItemPopulator pantryPop;
    @Autowired SupplementIntakePopulator intakePop;
    @Autowired DatabasePopulator databasePopulator;

    UUID owner;
    UUID other;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    @Test
    void testLogIntake_shouldSnapshotPantryDose_whenDoseOmitted() {
        PantryItemEntity supp = pantryPop.createSupplement(owner, "Kreatin"); // dose "5g"
        OffsetDateTime takenAt = OffsetDateTime.of(2026, 6, 15, 8, 30, 0, 0, ZoneOffset.UTC);

        IntakeResponse res = service.logIntake(owner,
            new IntakeRequest().pantryItemId(supp.getId()).takenAt(takenAt));

        assertThat(res.getId()).isNotNull();
        assertThat(res.getPantryItemId()).isEqualTo(supp.getId());
        assertThat(res.getDose()).isEqualTo("5g"); // snapshotted from the pantry item
        assertThat(res.getTakenDate()).isEqualTo(LocalDate.of(2026, 6, 15)); // wall-clock date of takenAt
    }

    @Test
    void testLogIntake_shouldDefaultTakenAtToNow_whenOmitted() {
        PantryItemEntity supp = pantryPop.createSupplement(owner, "Kreatin");
        OffsetDateTime before = OffsetDateTime.now();

        IntakeResponse res = service.logIntake(owner, new IntakeRequest().pantryItemId(supp.getId()));

        assertThat(res.getTakenAt()).isNotNull();
        assertThat(res.getTakenAt()).isAfterOrEqualTo(before.minusMinutes(1));
        assertThat(res.getTakenAt()).isBeforeOrEqualTo(OffsetDateTime.now().plusMinutes(1));
        assertThat(res.getTakenDate()).isEqualTo(LocalDate.now());
    }

    @Test
    void testLogIntake_shouldReject_whenPantryItemIsFood() {
        PantryItemEntity food = pantryPop.createFood(owner, "Csirkemell", LocalDate.now().plusDays(3));

        assertThatThrownBy(() -> service.logIntake(owner, new IntakeRequest().pantryItemId(food.getId())))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex -> {
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(ex.getMessages()).singleElement().satisfies(m -> {
                    assertThat(m.getCode()).isEqualTo("VALIDATION_INVALID_VALUE");
                    assertThat(m.getFieldName()).isEqualTo("pantryItemId");
                });
            });
    }

    @Test
    void testListForDay_shouldReturnOnlyThatDaysRows_orderedByTakenAt() {
        PantryItemEntity supp = pantryPop.createSupplement(owner, "Kreatin");
        Instant morning = Instant.parse("2026-06-15T06:00:00Z");
        Instant evening = Instant.parse("2026-06-15T20:00:00Z");
        Instant nextDay = Instant.parse("2026-06-16T09:00:00Z");
        // insert out of chronological order to prove the ORDER BY takenAt
        intakePop.createIntake(owner, supp.getId(), evening);
        intakePop.createIntake(owner, supp.getId(), morning);
        intakePop.createIntake(owner, supp.getId(), nextDay);

        IntakeListResponse list = service.listForDay(owner, LocalDate.of(2026, 6, 15));

        assertThat(list.getIntakes())
            .extracting(IntakeResponse::getTakenAt)
            .containsExactly(morning.atOffset(ZoneOffset.UTC), evening.atOffset(ZoneOffset.UTC));
    }

    @Test
    void testDeleteIntake_shouldSoftDeleteOwnRow_and404OnForeign() {
        PantryItemEntity supp = pantryPop.createSupplement(owner, "Kreatin");
        SupplementIntakeEntity intake =
            intakePop.createIntake(owner, supp.getId(), Instant.parse("2026-06-15T06:00:00Z"));

        // foreign caller cannot delete the owner's row → 404
        assertThatThrownBy(() -> service.deleteIntake(other, intake.getId()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class, ex ->
                assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));

        // owner deletes own row → soft-deleted, no longer listed
        service.deleteIntake(owner, intake.getId());
        assertThat(service.listForDay(owner, LocalDate.of(2026, 6, 15)).getIntakes()).isEmpty();
    }
}
