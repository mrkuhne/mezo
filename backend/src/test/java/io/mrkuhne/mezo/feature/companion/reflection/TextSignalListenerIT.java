package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateGratitudeEntryRequest;
import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalCatchUpService;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.GratitudeService;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S1 (mezo-eq85.1): the AFTER_COMMIT text-signal listener, driven through the REAL journal
 * / gratitude write services so the domain events actually fire (a populator would bypass them).
 */
@ActiveProfiles("companion-fake")
class TextSignalListenerIT extends AbstractIntegrationTest {

    @Autowired private JournalService journalService;
    @Autowired private GratitudeService gratitudeService;
    @Autowired private JournalEntryRepository journalEntryRepository;
    @Autowired private TextSignalRepository textSignalRepository;
    @Autowired private TextSignalCatchUpService catchUpService;
    @Autowired private MemoryItemRepository memoryItemRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID createJournalEntry(UUID owner, LocalDate day, String text) {
        CreateJournalEntryRequest request = new CreateJournalEntryRequest();
        request.setOccurredOn(day);
        request.setText(text);
        request.setSource(JournalEntryEntity.SOURCE_QUICKINPUT);
        return journalService.create(owner, request).getId();
    }

    @Test
    void testJournalSave_shouldWriteSignalAndEnrichMemoryItem() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        String text = "Annával sétáltunk, jó nap volt.";
        UUID entryId = createJournalEntry(owner, day, text);

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            TextSignalEntity signal = textSignalRepository
                    .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                            owner, TextSignalEntity.SOURCE_JOURNAL, entryId)
                    .orElseThrow();
            assertThat(signal.getMood()).isEqualTo(4);
            assertThat(signal.getEnergy()).isEqualTo(3);
            assertThat(signal.getStress()).isEqualTo(2);
            assertThat(signal.getConfidence()).isEqualTo(TextSignalEntity.CONFIDENCE_SURE);
            assertThat(signal.getOccurredOn()).isEqualTo(day);
            assertThat(signal.getVersion()).isEqualTo(1);
            assertThat(signal.getPeople()).containsExactly("Anna");
            assertThat(signal.getTopics()).containsExactly("kapcsolatok");
        });

        // The memory_item enrichment cannot be awaited off the same save: the embedding seam's
        // projection listener races this one and its writer RESETS people/topics
        // (MemoryProjectionWriter:75-76), so whichever lands last wins. What the design actually
        // guarantees is that the heal path restores it — a re-offer of an UNCHANGED text costs no
        // LLM call and re-applies the enrichment. The heal is driven here through the REAL
        // production seam, TextSignalCatchUpService.catchUp (Task 2's job calls exactly this) —
        // calling TextSignalService.record directly would assert the heal through a path production
        // never takes. Everything after the catch-up sits INSIDE the awaited block, so a projection
        // landing late re-wipes into the next poll instead of failing the test.
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(memoryItemRepository
                .findByCreatedByAndSourceKindAndSourceId(owner, TextSignalEntity.SOURCE_JOURNAL, entryId))
                .isPresent());
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(catchUpService.catchUp(owner, LocalDate.now())).isZero(); // no new version
            assertThat(textSignalRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                    owner, TextSignalEntity.SOURCE_JOURNAL, entryId)).hasSize(1);
            MemoryItemEntity item = memoryItemRepository
                    .findByCreatedByAndSourceKindAndSourceId(owner, TextSignalEntity.SOURCE_JOURNAL, entryId)
                    .orElseThrow();
            assertThat(item.getPeople()).containsExactly("Anna");
            assertThat(item.getTopics()).containsExactly("kapcsolatok");
        });
    }

    @Test
    void testGratitudeSave_shouldWriteSignal() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        CreateGratitudeEntryRequest request = new CreateGratitudeEntryRequest();
        request.setOccurredOn(day);
        request.setText("Hálás vagyok Annáért.");
        UUID entryId = gratitudeService.create(owner, request).getId();

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_GRATITUDE, entryId))
                .get()
                .satisfies(s -> {
                    assertThat(s.getMood()).isEqualTo(4);
                    assertThat(s.getPeople()).containsExactly("Anna");
                }));
    }

    @Test
    void testJournalEdit_shouldWriteNewVersion_notOverwrite() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        UUID entryId = createJournalEntry(owner, day,
                "Annával sétáltunk. [[SIGNAL:{\"mood\":2,\"confidence\":\"sure\",\"people\":[],"
                        + "\"topics\":[],\"keywords\":[]}]]");
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_JOURNAL, entryId))
                .get().extracting(TextSignalEntity::getVersion).isEqualTo(1));

        UpdateJournalEntryRequest update = new UpdateJournalEntryRequest();
        update.setText("Mégis szuper nap volt. [[SIGNAL:{\"mood\":5,\"confidence\":\"sure\","
                + "\"people\":[],\"topics\":[],\"keywords\":[]}]]");
        journalService.update(owner, entryId, update);

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            List<TextSignalEntity> all = textSignalRepository
                    .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                            owner, TextSignalEntity.SOURCE_JOURNAL, entryId);
            assertThat(all).hasSize(2);
            assertThat(all).extracting(TextSignalEntity::getVersion).containsExactlyInAnyOrder(1, 2);
            TextSignalEntity newest = textSignalRepository
                    .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                            owner, TextSignalEntity.SOURCE_JOURNAL, entryId)
                    .orElseThrow();
            assertThat(newest.getVersion()).isEqualTo(2);
            assertThat(newest.getMood()).isEqualTo(5);
        });
    }

    @Test
    void testJournalDelete_shouldSoftDeleteSignals() {
        UUID owner = userPopulator.createUser().getId();
        UUID entryId = createJournalEntry(owner, LocalDate.now().minusDays(1), "Annával sétáltunk.");
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_JOURNAL, entryId)).isPresent());

        journalService.delete(owner, entryId);

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_JOURNAL, entryId)).isEmpty());
    }

    @Test
    void testExtractionFailure_shouldLeaveEntryIntactAndWriteNoSignal() {
        UUID owner = userPopulator.createUser().getId();
        UUID entryId = createJournalEntry(owner, LocalDate.now().minusDays(1),
                "Nehéz nap. " + FakeCompanionLlm.SIGNAL_FAIL);

        // the write itself succeeded and stays readable — a failing extraction is invisible to it
        assertThat(journalEntryRepository.findByIdAndCreatedByAndDeletedFalse(entryId, owner)).isPresent();
        // and the async listener, once drained, has written nothing (the drain runs in @BeforeEach,
        // so a sleep here would only re-prove what the assertion below already pins after it)
        await().during(Duration.ofSeconds(2)).atMost(Duration.ofSeconds(5))
                .untilAsserted(() -> assertThat(textSignalRepository
                        .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                                owner, TextSignalEntity.SOURCE_JOURNAL, entryId)).isEmpty());
        assertThat(journalEntryRepository.findByIdAndCreatedByAndDeletedFalse(entryId, owner))
                .get().extracting(JournalEntryEntity::getText)
                .isEqualTo("Nehéz nap. " + FakeCompanionLlm.SIGNAL_FAIL);
    }
}
