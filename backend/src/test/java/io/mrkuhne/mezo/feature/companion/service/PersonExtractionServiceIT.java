package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
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
    @Autowired private GraphService graphService;
    @Autowired private GraphPromotionService promotionService;

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
    void testExtractFor_shouldCapNotesAt500Chars_whenThreeMaxLengthQuotesJoinOverTheColumnLimit() {
        // person.notes is VARCHAR(500) (1.0.0_master.yml, 202607041030); three 200-char quotes
        // joined with "\n" is 3*200+2 = 602 chars — without a cap this throws on persistNight and
        // rolls back the WHOLE night (including the enrichment scripted in the very same answer).
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Anna");
        MentionEntity mention = mentionPopulator.createMention(
            owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);
        String quote = "a".repeat(200);
        plantEntry(owner, DAY, "Ma találkoztam Annával. Riko is beugrott délután, este Riko megint "
            + "írt. [fake-people:{\"mentions\":[{\"index\":0,\"tone\":\"positive\",\"intensity\":2,"
            + "\"context\":\"munka\"}],\"candidates\":[{\"name\":\"Riko\",\"quotes\":[\"" + quote
            + "\",\"" + quote + "\",\"" + quote + "\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        // The night must NOT roll back: both the candidate AND the enrichment scripted in the same
        // answer persist.
        assertThat(result.enriched()).isEqualTo(1);
        assertThat(result.candidates()).isEqualTo(1);
        MentionEntity updatedMention = mentionRepository.findById(mention.getId()).orElseThrow();
        assertThat(updatedMention.getTone()).isEqualTo("positive");
        PersonEntity created = personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner)
            .stream().filter(p -> "Riko".equals(p.getName())).findFirst().orElseThrow();
        assertThat(created.getNotes().length()).isLessThanOrEqualTo(500);
        assertThat(created.getNotes()).endsWith("…");
    }

    @Test
    void testExtractorMarker_shouldStayInSyncWithTheFakeDispatch() {
        assertThat(PersonExtractionService.EXTRACTOR_MARKER).isEqualTo("[person-extractor]");
    }

    @Test
    void extractFor_shouldStructureEdges_forEdgelessPersonNode() {
        // A GraphEdgeStructurer a node CÍMÉT és SUMMARY-ját küldi a modellnek; a fake a
        // user-üzenetben keresi a [fake-graph-edges:[...]] szentinelt, ezért a summary-ba
        // (relationshipHu) rejtjük.
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Petra");
        person.setRelationshipHu("Élettárs [fake-graph-edges:[{\"index\":0,\"kind\":\"SUPPORTS\",\"confidence\":0.8}]]");
        personRepository.save(person);
        // egy másik aktív node, hogy legyen mihez kötni (a strukturáló emptiness-gate-je)
        graphService.upsertNode(owner, GraphNodeEntity.KIND_LIFE_EVENT, "Nyári szabadság", null,
            "life_event_test", UUID.randomUUID(), null, Map.of());
        GraphNodeEntity personNode = promotionService.syncPerson(owner, person.getId()).orElseThrow();
        mentionPopulator.createMention(owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.edgeLinked()).isEqualTo(1);
        assertThat(graphService.edgesFrom(owner, personNode.getId())).hasSize(1);
    }

    @Test
    void extractFor_shouldSkipEdgeStructuring_whenPersonNodeAlreadyHasEdges() {
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Petra");
        person.setRelationshipHu("Élettárs [fake-graph-edges:[{\"index\":0,\"kind\":\"SUPPORTS\",\"confidence\":0.8}]]");
        personRepository.save(person);
        GraphNodeEntity other = graphService.upsertNode(owner, GraphNodeEntity.KIND_LIFE_EVENT,
            "Nyári szabadság", null, "life_event_test", UUID.randomUUID(), null, Map.of());
        GraphNodeEntity personNode = promotionService.syncPerson(owner, person.getId()).orElseThrow();
        // kézzel húzott él, mielőtt az extraktor futna — a passznak ezt kell tiszteletben tartania
        graphService.upsertEdge(owner, personNode.getId(), other.getId(),
            GraphEdgeEntity.KIND_RELATES_TO, new BigDecimal("0.500"), List.of());
        mentionPopulator.createMention(owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        // Ha a strukturáló futott volna, a szentinel egy MÁSODIK (SUPPORTS) élt hozott volna létre
        // a meglévő (RELATES_TO) mellé — a mérete tehát a hitelesebb bizonyíték, mint egy globális
        // LLM-hívásszámláló, mert a person-extraction saját (üres) modellhívása ETTŐL függetlenül
        // lefut, valahányszor van tone-nélküli mention.
        assertThat(result.edgeLinked()).isZero();
        assertThat(graphService.edgesFrom(owner, personNode.getId())).hasSize(1);
    }

    @Test
    void extractFor_shouldSkipEdgeStructuring_whenPersonHasNoGraphNode() {
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Petra");
        person.setRelationshipHu("Élettárs [fake-graph-edges:[{\"index\":0,\"kind\":\"SUPPORTS\",\"confidence\":0.8}]]");
        personRepository.save(person);
        // szándékosan NINCS syncPerson hívás — a személy sosem lett promótálva
        mentionPopulator.createMention(owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);

        // Ha a `found.isEmpty()` gate eltűnne, a `found.get()` NoSuchElementException-t dobna,
        // amit a node-onkénti catch(Exception) elnyelne — az edgeLinked()==0 assert önmagában NEM
        // tudná megkülönböztetni a tiszta skip-et az elnyelt kivételtől (code review fix: a
        // korábbi verzió ezért volt vak a gate törlésére). A WARN-log hiánya viszont igen: a gate
        // jelenlétében a folyamat csendben lép tovább, hiányában egy "Person edge structuring
        // failed" WARN íródna.
        Logger logger = (Logger) LoggerFactory.getLogger(PersonExtractionService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        PersonExtractionResult result;
        try {
            result = extractionService.extractFor(owner, DAY);
        } finally {
            logger.detachAppender(appender);
        }

        assertThat(result.edgeLinked()).isZero();
        assertThat(appender.list).noneMatch(
            event -> event.getFormattedMessage().contains("Person edge structuring failed"));
    }

    @Test
    void extractFor_shouldSkipEdgeStructuring_whenPersonNodeIsArchived() {
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Petra");
        person.setRelationshipHu("Élettárs [fake-graph-edges:[{\"index\":0,\"kind\":\"SUPPORTS\",\"confidence\":0.8}]]");
        personRepository.save(person);
        graphService.upsertNode(owner, GraphNodeEntity.KIND_LIFE_EVENT, "Nyári szabadság", null,
            "life_event_test", UUID.randomUUID(), null, Map.of());
        GraphNodeEntity personNode = promotionService.syncPerson(owner, person.getId()).orElseThrow();
        graphService.archive(owner, personNode.getId());
        mentionPopulator.createMention(owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.edgeLinked()).isZero();
        assertThat(graphService.edgesFrom(owner, personNode.getId())).isEmpty();
    }

    @Test
    void extractFor_shouldCapAttemptsAtMaxEdgeLinksPerNight_whenFourPersonsAreMentioned() {
        // MAX_EDGE_LINKS_PER_NIGHT == 3 (private const) — four edgeless, never-attempted person
        // nodes mentioned on the same night must yield exactly 3 attempts, not 4.
        UUID owner = ownerId();
        graphService.upsertNode(owner, GraphNodeEntity.KIND_LIFE_EVENT, "Nyári szabadság", null,
            "life_event_test", UUID.randomUUID(), null, Map.of());
        for (String name : List.of("Petra", "Réka", "Soma", "Tibi")) {
            PersonEntity person = personPopulator.createPerson(owner, name);
            person.setRelationshipHu("Ismerős [fake-graph-edges:[]]");
            personRepository.save(person);
            promotionService.syncPerson(owner, person.getId()).orElseThrow();
            mentionPopulator.createMention(owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);
        }

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.edgeLinked()).isEqualTo(3);
    }

    @Test
    void extractFor_shouldNeverRetry_whenAPriorAttemptYieldedNoEdges() {
        // Code review fix (Important 2): egy üres/konfidencia-küszöb-alatti strukturáló-válasz nem
        // hoz létre élt, de a node.meta "edgeStructuredOn" jelzője akkor is beíródik — a második
        // futásnak MÁR ezt kell látnia, és nem szabad újra megpróbálnia (sem a napi sapkát
        // fogyasztania, sem újabb LLM-hívást indítania).
        UUID owner = ownerId();
        PersonEntity person = personPopulator.createPerson(owner, "Petra");
        // a szentinel üres tömböt ad vissza — a strukturáló nem hoz létre élt, de LEFUT
        person.setRelationshipHu("Élettárs [fake-graph-edges:[]]");
        personRepository.save(person);
        graphService.upsertNode(owner, GraphNodeEntity.KIND_LIFE_EVENT, "Nyári szabadság", null,
            "life_event_test", UUID.randomUUID(), null, Map.of());
        GraphNodeEntity personNode = promotionService.syncPerson(owner, person.getId()).orElseThrow();
        mentionPopulator.createMention(owner, person.getId(), DAY.atStartOfDay(ZoneOffset.UTC).toInstant(), null);

        PersonExtractionResult first = extractionService.extractFor(owner, DAY);
        assertThat(first.edgeLinked()).isEqualTo(1);   // megpróbálta, de nem hozott létre élt
        assertThat(graphService.edgesFrom(owner, personNode.getId())).isEmpty();

        LocalDate nextDay = DAY.plusDays(1);
        mentionPopulator.createMention(owner, person.getId(), nextDay.atStartOfDay(ZoneOffset.UTC).toInstant(), null);
        PersonExtractionResult second = extractionService.extractFor(owner, nextDay);

        assertThat(second.edgeLinked()).isZero();   // a marker miatt nem próbálja meg újra
        assertThat(graphService.edgesFrom(owner, personNode.getId())).isEmpty();
    }
}
