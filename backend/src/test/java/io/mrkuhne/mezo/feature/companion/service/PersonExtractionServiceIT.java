package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.people.repository.PersonRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Emberek S4 (bd mezo-06o0.3): the nightly people-extraction round — the {@code
 *  LifeEventExtractionService} twin. Two write paths, both guarded: toneless-mention enrichment,
 *  and recurring-name candidate proposal — never a graph write here, and never a guess that only
 *  showed up once. */
@ActiveProfiles("companion-fake")
class PersonExtractionServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 21);

    @Autowired private PersonExtractionService extractionService;
    @Autowired private PersonRepository personRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** The scripted answer is planted in the narrative itself (the FakeCompanionLlm sentinel idiom). */
    private void plantEntry(UUID owner, LocalDate day, String text) {
        journalPopulator.createEntry(owner, day, text, JournalEntryEntity.SOURCE_QUICKINPUT);
    }

    @Test
    void testExtractFor_shouldMakeNoLlmCall_whenTheDayIsEmpty() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result).isEqualTo(PersonExtractionResult.ZERO);
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
    }

    @Test
    void testExtractFor_shouldEnrichTonelessMention_whenScripted() {
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Anna");
        MentionEntity mention = mentionPopulator.createMention(
            owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);
        plantEntry(owner, DAY, "Ma találkoztam Annával. [fake-people:"
            + "{\"mentions\":[{\"index\":0,\"tone\":\"positive\",\"intensity\":2,\"context\":\"munka\"}],"
            + "\"candidates\":[]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.enriched()).isEqualTo(1);
        assertThat(result.candidates()).isZero();
        MentionEntity updated = mentionRepository.findById(mention.getId()).orElseThrow();
        assertThat(updated.getTone()).isEqualTo("positive");
        assertThat(updated.getIntensity()).isEqualTo((short) 2);
        assertThat(updated.getContextLabel()).isEqualTo("munka");
    }

    @Test
    void testExtractFor_shouldDropInvalidEnrichment_neverClamp() {
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Anna");
        MentionEntity mention = mentionPopulator.createMention(
            owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);
        plantEntry(owner, DAY, "Ma találkoztam Annával. [fake-people:"
            + "{\"mentions\":[{\"index\":0,\"tone\":\"lelkes\",\"intensity\":2,\"context\":\"munka\"},"
            + "{\"index\":7,\"tone\":\"positive\",\"intensity\":2,\"context\":\"munka\"}],\"candidates\":[]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result).isEqualTo(PersonExtractionResult.ZERO);
        MentionEntity untouched = mentionRepository.findById(mention.getId()).orElseThrow();
        assertThat(untouched.getTone()).isNull();
    }

    @Test
    void testExtractFor_shouldCreateCandidate_whenUnknownNameRecursInTheDay() {
        UUID owner = ownerId();
        plantEntry(owner, DAY, "délben futottam Marcival a gáton, este megint Marci hívott. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"Marci\","
            + "\"quotes\":[\"délben futottam Marcival a gáton\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.candidates()).isEqualTo(1);
        PersonEntity created = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner)
            .stream().filter(p -> "Marci".equals(p.getName())).findFirst().orElseThrow();
        assertThat(created.getStatus()).isEqualTo("candidate");
        assertThat(created.getSourceKind()).isEqualTo(PersonExtractionService.SOURCE_EXTRACTOR);
        assertThat(created.getRelationship()).isEqualTo("friend");
        assertThat(created.getRelationshipHu()).isEqualTo("Ismerős");
        assertThat(created.getNotes()).contains("délben futottam Marcival a gáton");
    }

    @Test
    void testExtractFor_shouldDropCandidate_whenTheNameDoesNotRecur() {
        // The sentinel JSON itself lands in the narrative text (same channel the fake reads), so
        // its own "name" field already contributes one occurrence — the prose must add none, and
        // the quote must not repeat the name, so the day tally stays at 1 (below the ≥2 gate).
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Csendes nap volt, nem történt semmi különös. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"Ottó\","
            + "\"quotes\":[\"valaki régen erről mesélt\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result).isEqualTo(PersonExtractionResult.ZERO);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
    }

    @Test
    void testExtractFor_shouldNotReproposeKnownAliasOrRejectedName() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Marcell");   // aliases default to ["Marcika"]
        PersonEntity rejected = personPopulator.createCandidate(owner, "Dóri", "korábbi jegyzet");
        personRepository.delete(rejected);   // soft-deleted — the user rejected this candidate

        plantEntry(owner, DAY, "Marcika kétszer írt ma, Marcika este is hívott. Dóri megint felbukkant,"
            + " Dóri este írt. [fake-people:{\"mentions\":[],\"candidates\":["
            + "{\"name\":\"Marcika\",\"quotes\":[\"Marcika kétszer írt ma\"]},"
            + "{\"name\":\"Dóri\",\"quotes\":[\"Dóri megint felbukkant\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result).isEqualTo(PersonExtractionResult.ZERO);
        List<PersonEntity> people = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(people).extracting(PersonEntity::getName).doesNotContain("Marcika", "Dóri");
    }

    @Test
    void testExtractFor_shouldCountWeekWindow_whenDayIsBelowThreshold() {
        // The sentinel's own "name" field contributes 1 day-occurrence on its own (see the
        // does-not-recur test's note) — kept below the day gate (≥2) by naming Berci nowhere else
        // on DAY, so only the week tally (day's 1 + the two prior days' 2 = 3) clears the gate.
        UUID owner = ownerId();
        plantEntry(owner, DAY.minusDays(1), "Berci ma is beszólt, Berci este is írt.");
        plantEntry(owner, DAY, "Csendes nap volt, nem történt semmi különös. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"Berci\","
            + "\"quotes\":[\"valaki ma is beszólt\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.candidates()).isEqualTo(1);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner))
            .extracting(PersonEntity::getName).contains("Berci");
    }

    @Test
    void testExtractFor_shouldDegradeToZero_whenTheAnswerIsBroken() {
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Ma történt valami. " + FakeCompanionLlm.PEOPLE_BROKEN);

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result).isEqualTo(PersonExtractionResult.ZERO);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
    }

    @Test
    void testExtractorMarker_shouldStayInSyncWithTheFakeDispatch() {
        assertThat(PersonExtractionService.EXTRACTOR_MARKER).isEqualTo("[person-extractor]");
    }
}
