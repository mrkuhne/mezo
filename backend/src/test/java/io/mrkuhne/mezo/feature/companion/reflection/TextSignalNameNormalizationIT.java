package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalCatchUpService;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * bd mezo-xih1: a {@code text_signal.people} ÍRÁSI IDEJŰ név-normalizálása. A modell magyarul
 * ragozott alakot adhat vissza még alanyesetet kérő prompt mellett is, és a ragozott név külön
 * {@code people:<név>} sorozatra esne — ugyanaz az ember naponta más kulcsra, mindegyik sorozat
 * hézagos. A jelet a scriptelt fake-LLM ({@code [[SIGNAL:{…}]]}) adja, hogy a teszt pontosan a
 * normalizálást mérje, ne a modell nyelvtani képességét.
 */
@ActiveProfiles("companion-fake")
class TextSignalNameNormalizationIT extends AbstractIntegrationTest {

    @Autowired private JournalService journalService;
    @Autowired private TextSignalRepository textSignalRepository;
    @Autowired private MemoryItemRepository memoryItemRepository;
    @Autowired private TextSignalCatchUpService catchUpService;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private PersonRepository personRepository;
    @Autowired private UserPopulator userPopulator;

    private static String scripted(String... people) {
        String names = String.join("\",\"", people);
        return "[[SIGNAL:{\"mood\":4,\"energy\":3,\"stress\":2,\"confidence\":\"sure\","
                + "\"people\":[\"" + names + "\"],\"topics\":[\"kapcsolatok\"],\"keywords\":[]}]]";
    }

    private List<String> peopleOf(UUID owner, UUID entryId) {
        return textSignalRepository
                .findFirstByCreatedByAndSourceKindAndSourceIdAndDeletedFalseOrderByVersionDesc(
                        owner, TextSignalEntity.SOURCE_JOURNAL, entryId)
                .orElseThrow()
                .getPeople();
    }

    private UUID journal(UUID owner, String text) {
        CreateJournalEntryRequest request = new CreateJournalEntryRequest();
        request.setOccurredOn(LocalDate.now().minusDays(1));
        request.setText(text);
        request.setSource(JournalEntryEntity.SOURCE_QUICKINPUT);
        return journalService.create(owner, request).getId();
    }

    @Test
    void testRecord_shouldStoreCanonicalPersonName_forInflectedName() {
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Liza");
        UUID entryId = journal(owner, "Jó nap volt. " + scripted("Lizával"));

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(peopleOf(owner, entryId)).containsExactly("Liza"));
        // A memory_item gazdagítás UGYANAZT a normalizált listát kapja, nem a nyers LLM-választ.
        // A catch-upon át mérjük (TextSignalListenerIT idióma): az embedding-varrat projekciója
        // versenyben van az enrichmenttel, és a nyertes írás eldobhatja a people-t — a self-heal
        // pont ez a re-offer, és mindent az awaitelt blokkba téve egy késői projekció a következő
        // pollba csúszik, nem hasítja el a tesztet.
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(memoryItemRepository.findByCreatedByAndSourceKindAndSourceId(
                        owner, TextSignalEntity.SOURCE_JOURNAL, entryId)).isPresent());
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(catchUpService.catchUp(owner, LocalDate.now())).isZero(); // nincs új verzió
            assertThat(memoryItemRepository
                    .findByCreatedByAndSourceKindAndSourceId(
                            owner, TextSignalEntity.SOURCE_JOURNAL, entryId)
                    .orElseThrow().getPeople()).containsExactly("Liza");
        });
    }

    @Test
    void testRecord_shouldCanonicalizeThroughAlias_andCollapseVariantsOfOnePerson() {
        UUID owner = userPopulator.createUser().getId();
        // a populátor alapból a "Marcika" aliast adja
        PersonEntity reka = personPopulator.createPerson(owner, "Réka");
        assertThat(reka.getAliases()).contains("Marcika");
        UUID entryId = journal(owner, "Kávé. " + scripted("Marcikával", "RÉKÁNAK", "Réka"));

        // három nyers alak, EGY ember: a kanonikus név egyszer szerepel
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(peopleOf(owner, entryId)).containsExactly("Réka"));
    }

    @Test
    void testRecord_shouldLeaveUnknownNameAlone_butDedupeItFolded() {
        UUID owner = userPopulator.createUser().getId();
        UUID entryId = journal(owner, "Este. " + scripted("Bence", "bence", "Dóra"));

        // ismeretlen névnek nincs kanonikus alakja — kitalálni nem szabad, csak dedupolni
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(peopleOf(owner, entryId)).containsExactly("Bence", "Dóra"));
    }

    @Test
    void testRecord_shouldNotCanonicalizeToCandidateOrArchivedPerson() {
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createCandidate(owner, "Zoli", "jelölt");
        PersonEntity archived = personPopulator.createPerson(owner, "Gabi");
        archived.setStatus("archived");
        personRepository.saveAndFlush(archived);
        UUID entryId = journal(owner, "Meló. " + scripted("Zolival", "Gabival"));

        // csak az AKTÍV kör kap sorozatot — ugyanaz a szabály, mint a mention-detektálásban
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(peopleOf(owner, entryId)).containsExactly("Zolival", "Gabival"));
    }
}
