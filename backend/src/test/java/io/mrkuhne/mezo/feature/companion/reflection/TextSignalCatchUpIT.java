package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.ChatDaySignalService;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalCatchUpService;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S1 (mezo-eq85.1): the nightly catch-up itself — the seam Task 2's job calls. Every case
 * here drives {@link TextSignalCatchUpService#catchUp} rather than {@code TextSignalService.record},
 * because the catch-up's own gates (staleness, the chat-day loop, per-source failure isolation) are
 * exactly what a direct {@code record} call bypasses.
 *
 * <p>Sources are created through the POPULATORS, not the journal service: the populator does not
 * publish the saved event, so no listener has already written the signal and the catch-up is the
 * only writer in the picture.
 */
@ActiveProfiles("companion-fake")
class TextSignalCatchUpIT extends AbstractIntegrationTest {

    private static final String SIGNAL_MOOD_5 = " [[SIGNAL:{\"mood\":5,\"energy\":3,\"stress\":1,"
            + "\"confidence\":\"sure\",\"people\":[],\"topics\":[],\"keywords\":[]}]]";

    @Autowired private TextSignalCatchUpService catchUpService;
    @Autowired private TextSignalRepository textSignalRepository;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private JournalEntryRepository journalEntryRepository;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryItemRepository memoryItemRepository;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;
    @Autowired private CreatedAtBackdater createdAtBackdater;
    @Autowired private UserPopulator userPopulator;

    private static final LocalDate TODAY = LocalDate.now();
    private static final LocalDate YESTERDAY = TODAY.minusDays(1);

    @Test
    void testMissingSignal_shouldBeExtracted_andStaleHashReVersioned() {
        UUID owner = userPopulator.createUser().getId();
        JournalEntryEntity entry = journalPopulator.createEntry(owner, YESTERDAY,
                "Annával sétáltunk, jó nap volt.", JournalEntryEntity.SOURCE_QUICKINPUT);

        assertThat(catchUpService.catchUp(owner, TODAY)).isEqualTo(1);
        TextSignalEntity first = newestJournalSignal(owner, entry.getId());
        assertThat(first.getVersion()).isEqualTo(1);
        assertThat(first.getMood()).isEqualTo(4);

        // the entry is edited while the listener is off — the stored hash no longer matches
        entry.setText("Mégis szuper nap volt." + SIGNAL_MOOD_5);
        journalEntryRepository.saveAndFlush(entry);

        assertThat(catchUpService.catchUp(owner, TODAY)).isEqualTo(1);
        assertThat(textSignalRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, TextSignalEntity.SOURCE_JOURNAL, entry.getId()))
                .extracting(TextSignalEntity::getVersion).containsExactlyInAnyOrder(1, 2);
        assertThat(newestJournalSignal(owner, entry.getId()).getMood()).isEqualTo(5);
    }

    @Test
    void testUnchangedHash_shouldRestoreWipedEnrichment_withoutWritingANewVersion() {
        UUID owner = userPopulator.createUser().getId();
        String text = "Annával sétáltunk, jó nap volt.";
        JournalEntryEntity entry = journalPopulator.createEntry(owner, YESTERDAY, text,
                JournalEntryEntity.SOURCE_QUICKINPUT);
        memoryItemPopulator.item(owner, TextSignalEntity.SOURCE_JOURNAL, entry.getId(), text, YESTERDAY);

        assertThat(catchUpService.catchUp(owner, TODAY)).isEqualTo(1);
        assertThat(item(owner, entry.getId()).getPeople()).containsExactly("Anna");

        // the exact race MemoryProjectionWriter loses: a later projection resets people/topics
        MemoryItemEntity wiped = item(owner, entry.getId());
        wiped.setPeople(new ArrayList<>(List.of()));
        wiped.setTopics(new ArrayList<>(List.of()));
        memoryItemRepository.saveAndFlush(wiped);

        // the next night re-offers the source: unchanged hash ⇒ no LLM call, no new row, but the
        // enrichment MUST come back — that is the whole point of the "eventually correct" design
        assertThat(catchUpService.catchUp(owner, TODAY)).isZero();
        assertThat(textSignalRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, TextSignalEntity.SOURCE_JOURNAL, entry.getId())).hasSize(1);
        assertThat(item(owner, entry.getId()).getPeople()).containsExactly("Anna");
        assertThat(item(owner, entry.getId()).getTopics()).containsExactly("kapcsolatok");
    }

    @Test
    void testMissingChatDaySignal_shouldBeWritten_andLaterTurnsReVersionIt() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        userTurn(conversation, "Annával sétáltunk, jó nap volt.");

        assertThat(catchUpService.catchUp(owner, TODAY)).isEqualTo(1);
        TextSignalEntity day1 = newestChatDaySignal(owner);
        assertThat(day1.getVersion()).isEqualTo(1);
        assertThat(day1.getMood()).isEqualTo(4);
        assertThat(day1.getSourceId())
                .isEqualTo(ChatDaySignalService.chatDaySourceId(owner, YESTERDAY));

        // the conversation continued after the first extraction — the day's text changed
        userTurn(conversation, "Este még edzettem is." + SIGNAL_MOOD_5);

        assertThat(catchUpService.catchUp(owner, TODAY)).isEqualTo(1);
        TextSignalEntity day2 = newestChatDaySignal(owner);
        assertThat(day2.getVersion()).isEqualTo(2);
        assertThat(day2.getMood()).isEqualTo(5);

        // and a third run on an unchanged day writes nothing
        assertThat(catchUpService.catchUp(owner, TODAY)).isZero();
        assertThat(newestChatDaySignal(owner).getVersion()).isEqualTo(2);
    }

    @Test
    void testFailingSource_shouldNotAbortTheRemainingSources() {
        UUID owner = userPopulator.createUser().getId();
        journalPopulator.createEntry(owner, YESTERDAY, "Nehéz nap. " + FakeCompanionLlm.SIGNAL_FAIL,
                JournalEntryEntity.SOURCE_QUICKINPUT);
        journalPopulator.createGratitude(owner, YESTERDAY, "Hálás vagyok Annáért.", null);

        assertThat(catchUpService.catchUp(owner, TODAY)).isEqualTo(1);
        assertThat(textSignalRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(
                        owner, YESTERDAY, YESTERDAY))
                .extracting(TextSignalEntity::getSourceKind)
                .containsExactly(TextSignalEntity.SOURCE_GRATITUDE);
    }

    private void userTurn(AiConversationEntity conversation, String content) {
        AiMessageEntity message = aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, content);
        Instant noon = YESTERDAY.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant();
        createdAtBackdater.backdate("ai_message", message.getId(), noon);
    }

    private TextSignalEntity newestJournalSignal(UUID owner, UUID sourceId) {
        return textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_JOURNAL, sourceId)
                .orElseThrow();
    }

    private TextSignalEntity newestChatDaySignal(UUID owner) {
        return textSignalRepository
                .findFirstByCreatedByAndSourceKindAndOccurredOnAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_CHAT_DAY, YESTERDAY)
                .orElseThrow();
    }

    private MemoryItemEntity item(UUID owner, UUID sourceId) {
        return memoryItemRepository
                .findByCreatedByAndSourceKindAndSourceId(owner, TextSignalEntity.SOURCE_JOURNAL, sourceId)
                .orElseThrow();
    }
}
