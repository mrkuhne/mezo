package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
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

/** journal_entry DDL + owner-scoped finders + source CHECK round-trip (bd mezo-b3pp.1). */
@Transactional
class JournalEntryPersistenceIT extends AbstractIntegrationTest {

    @Autowired
    private JournalEntryRepository repository;

    @Autowired
    private JournalPopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testCreateEntry_shouldRoundTrip_whenValid() {
        UUID owner = userPopulator.createUser("journal-rt@test.local").getId();
        LocalDate occurredOn = LocalDate.parse("2026-08-17");
        JournalEntryEntity saved = populator.createEntry(
            owner, occurredOn, "Nyugtalan éjszaka volt, de reggelre helyrejött a fejem.",
            JournalEntryEntity.SOURCE_QUICKINPUT);

        JournalEntryEntity found = repository
            .findByIdAndCreatedByAndDeletedFalse(saved.getId(), owner)
            .orElseThrow();

        assertThat(found.getOccurredOn()).isEqualTo(occurredOn);
        assertThat(found.getText()).isEqualTo("Nyugtalan éjszaka volt, de reggelre helyrejött a fejem.");
        assertThat(found.getSource()).isEqualTo(JournalEntryEntity.SOURCE_QUICKINPUT);
        assertThat(found.getCreatedBy()).isEqualTo(owner);
        assertThat(found.isDeleted()).isFalse();
    }

    @Test
    void testFindByRange_shouldOrderNewestFirst_whenMultipleDays() {
        UUID owner = userPopulator.createUser("journal-range@test.local").getId();
        populator.createEntry(owner, LocalDate.parse("2026-08-15"), "Első nap.", JournalEntryEntity.SOURCE_QUICKINPUT);
        populator.createEntry(owner, LocalDate.parse("2026-08-17"), "Harmadik nap.", JournalEntryEntity.SOURCE_RITUAL);
        populator.createEntry(owner, LocalDate.parse("2026-08-16"), "Második nap.", JournalEntryEntity.SOURCE_QUICKINPUT);

        List<JournalEntryEntity> found = repository
            .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                owner, LocalDate.parse("2026-08-15"), LocalDate.parse("2026-08-17"));

        assertThat(found).hasSize(3);
        assertThat(found).extracting(JournalEntryEntity::getOccurredOn).containsExactly(
            LocalDate.parse("2026-08-17"), LocalDate.parse("2026-08-16"), LocalDate.parse("2026-08-15"));
    }

    @Test
    void testSource_shouldRejectUnknownValue_whenViolatingCheck() {
        UUID owner = userPopulator.createUser("journal-ck@test.local").getId();

        // the entity's @Pattern guard fires before the DB CHECK
        assertThatThrownBy(() -> populator.createEntry(owner, LocalDate.now(), "x", "bogus"))
            .isInstanceOf(ConstraintViolationException.class);
    }
}
