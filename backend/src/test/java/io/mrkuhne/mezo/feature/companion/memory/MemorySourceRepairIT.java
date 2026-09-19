package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.companion.embedding.NoteEmbeddingCatchUp;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.LexicalMemoryQuery;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class MemorySourceRepairIT extends AbstractIntegrationTest {
    @Autowired private NoteEmbeddingCatchUp catchUp;
    @Autowired private io.mrkuhne.mezo.support.populator.AiConversationPopulator conversations;
    @Autowired private io.mrkuhne.mezo.support.populator.AiMessagePopulator messages;
    @Autowired private io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository conversationRepository;
    @Autowired private UserPopulator users;
    @Autowired private JournalPopulator journals;
    @Autowired private JournalEntryRepository journalRepository;
    @Autowired private MemoryItemRepository items;
    @Autowired private LexicalMemoryQuery lexical;
    @Autowired private io.mrkuhne.mezo.feature.companion.memory.repository.MemorySourceRepairQuery repairQuery;
    @Autowired private io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository vectors;

    @Test
    void testCatchUp_shouldNotRecallOrRestoreDeletedConversation_whenMessagesRemainStored() {
        var owner = users.createUser().getId();
        var conversation = conversations.conversation(owner);
        messages.message(conversation, "assistant", "Kajakoztunk a folyón.");
        catchUp.run(owner, LocalDate.now());
        assertThat(lexical.search(owner, "Kajakoztunk", LocalDate.now(), null, 30, null)).isNotEmpty();
        conversationRepository.delete(conversation);
        assertThat(lexical.search(owner, "Kajakoztunk", LocalDate.now(), null, 30, null)).isEmpty();
        catchUp.run(owner, LocalDate.now());
        assertThat(items.findAll()).allSatisfy(item -> assertThat(item.getState()).isEqualTo("suppressed"));
    }

    @Test
    void testCatchUp_shouldRepairWholeHistoricalSourceAndReapDeletion_whenOriginalListenerWasMissed() {
        var owner = users.createUser().getId();
        var other = users.createUser().getId();
        var date = LocalDate.of(2020, 1, 2);
        var entry = journals.createEntry(owner, date, "rutin ".repeat(450) + "ultramaraton", JournalEntryEntity.SOURCE_QUICKINPUT);
        journals.createEntry(other, date, "titkos ultramaraton", JournalEntryEntity.SOURCE_QUICKINPUT);
        catchUp.run(owner, LocalDate.now());
        assertThat(lexical.search(owner, "ultramaraton", LocalDate.now(), null, 30, null))
                .anySatisfy(hit -> assertThat(hit.sourceId()).isEqualTo(entry.getId()));
        assertThat(items.findAll()).allSatisfy(item -> assertThat(item.getCreatedBy()).isEqualTo(owner));
        assertThat(vectors.findAll()).hasSameSizeAs(items.findAll());
        assertThat(repairQuery.changed(owner, LocalDate.now(), "gemini-embedding-001-768-v1", 200)).isEmpty();
        entry.setText("rutin ".repeat(450) + "kajaktúra");
        journalRepository.saveAndFlush(entry);
        catchUp.run(owner, LocalDate.now());
        assertThat(lexical.search(owner, "kajaktúra", LocalDate.now(), null, 30, null))
                .anySatisfy(hit -> assertThat(hit.sourceId()).isEqualTo(entry.getId()));
        assertThat(items.findAll().stream().filter(item -> "active".equals(item.getState())))
                .noneSatisfy(item -> assertThat(item.getContent()).contains("ultramaraton"));
        journalRepository.delete(entry);
        assertThat(lexical.search(owner, "kajaktúra", LocalDate.now(), null, 30, null)).isEmpty();
        catchUp.run(owner, LocalDate.now());
        assertThat(lexical.search(owner, "kajaktúra", LocalDate.now(), null, 30, null)).isEmpty();
    }
}
