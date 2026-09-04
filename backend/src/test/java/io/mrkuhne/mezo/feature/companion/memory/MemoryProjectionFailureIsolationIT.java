package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** Proves that a failed NEW projection cannot roll back the already-durable OLD memory row. */
@ActiveProfiles("companion-fake")
class MemoryProjectionFailureIsolationIT extends AbstractIntegrationTest {

    @Autowired private MemoryEmbeddingWriter memoryEmbeddingWriter;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @MockitoSpyBean private MemoryItemRepository memoryItemRepository;

    @Test
    void testWriteJournal_shouldKeepOldEmbedding_whenCanonicalProjectionFails() {
        var owner = userPopulator.createUser().getId();
        var entry = journalPopulator.createEntry(
                owner, LocalDate.of(2026, 9, 4), "Az OLD memória maradjon elérhető.",
                JournalEntryEntity.SOURCE_QUICKINPUT);
        doThrow(new DataIntegrityViolationException("simulated projection failure"))
                .when(memoryItemRepository).saveAndFlush(any(MemoryItemEntity.class));

        assertThatCode(() -> memoryEmbeddingWriter.writeJournal(entry)).doesNotThrowAnyException();

        assertThat(memoryEmbeddingRepository.findByKindAndRefId(
                MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entry.getId()))
                .isPresent();
    }
}
