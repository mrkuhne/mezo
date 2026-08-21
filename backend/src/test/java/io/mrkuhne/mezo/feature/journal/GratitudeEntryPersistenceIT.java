package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.validation.ConstraintViolationException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** gratitude_entry DDL + owner-scoped finders + life_area CHECK round-trip (bd mezo-b3pp.3). */
@Transactional
class GratitudeEntryPersistenceIT extends AbstractIntegrationTest {

    @Autowired
    private GratitudeEntryRepository repository;

    @Autowired
    private JournalPopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testCreateGratitude_shouldRoundTrip_whenLifeAreaGiven() {
        UUID owner = userPopulator.createUser("gratitude-rt@test.local").getId();
        var saved = populator.createGratitude(owner, LocalDate.of(2026, 8, 20), "Reggeli futás a hűvösben", "recovery");

        var found = repository.findByIdAndCreatedByAndDeletedFalse(saved.getId(), owner);

        assertThat(found).isPresent();
        assertThat(found.get().getLifeArea()).isEqualTo("recovery");
        assertThat(found.get().getText()).isEqualTo("Reggeli futás a hűvösben");
    }

    @Test
    void testCreateGratitude_shouldRoundTrip_whenLifeAreaNull() {
        UUID owner = userPopulator.createUser("gratitude-null@test.local").getId();
        var saved = populator.createGratitude(owner, LocalDate.of(2026, 8, 20), "Jó kávé", null);

        var found = repository.findByIdAndCreatedByAndDeletedFalse(saved.getId(), owner);

        assertThat(found).isPresent();
        assertThat(found.get().getLifeArea()).isNull();
        assertThat(found.get().getText()).isEqualTo("Jó kávé");
    }

    @Test
    void testFindByRange_shouldOrderNewestFirst_whenMultipleDays() {
        UUID owner = userPopulator.createUser("gratitude-range@test.local").getId();
        populator.createGratitude(owner, LocalDate.of(2026, 8, 18), "a", null);
        populator.createGratitude(owner, LocalDate.of(2026, 8, 20), "b", "connection");

        var rows = repository.findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                owner, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 31));

        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(GratitudeEntryEntity::getText).containsExactly("b", "a");
    }

    @Test
    void testLifeArea_shouldRejectUnknownValue_whenViolatingCheck() {
        UUID owner = userPopulator.createUser("gratitude-ck@test.local").getId();

        // the entity's @Pattern guard fires before the DB CHECK
        assertThatThrownBy(() -> populator.createGratitude(owner, LocalDate.of(2026, 8, 20), "x", "gardening"))
                .isInstanceOf(ConstraintViolationException.class);
    }
}
