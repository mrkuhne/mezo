package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the JournalEntry aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class JournalPopulator {

    private final JournalEntryRepository repository;

    public JournalEntryEntity createEntry(UUID owner, LocalDate occurredOn, String text, String source) {
        JournalEntryEntity e = new JournalEntryEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(occurredOn);
        e.setText(text);
        e.setSource(source);
        return repository.saveAndFlush(e);
    }
}
