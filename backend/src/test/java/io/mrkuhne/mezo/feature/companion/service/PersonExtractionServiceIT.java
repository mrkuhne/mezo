package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
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
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
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
 *  and candidate proposal for an unknown name — never a graph write here, and never a name the
 *  day's own text does not actually contain (mezo-06o0.9 turned that gate from "must recur" into
 *  "must be grounded"; mezo-06o0.10 widened which texts count as the day's own). */
@ActiveProfiles("companion-fake")
class PersonExtractionServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 21);

    @Autowired private PersonExtractionService extractionService;
    @Autowired private PersonRepository personRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SportSessionRepository sportSessionRepository;
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
        // mezo-0cbh: a jelölt a DÖNTÉSEDRE vár, és eddig csak az tudott róla, aki magától
        // benyitott az Emberek hubra. A sor megnevezi, kiről kell dönteni.
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
            .filteredOn(n -> "person_candidate".equals(n.getKind()))
            .singleElement()
            .satisfies(n -> {
                assertThat(n.getTitle()).isEqualTo("Új arc a szövegeidben");
                assertThat(n.getBody()).startsWith("Marci ·");
                assertThat(n.getDeeplink()).isEqualTo("/me/people/jeloltek");
            });
    }

    // A néma ág ugyanolyan fontos: egy jelölt nélküli éjszaka nem írhat sort, különben a csengő
    // minden reggel hazudna egy döntést, ami nem vár rád (mezo-0cbh).
    @Test
    void testExtractFor_shouldNotNotify_whenNoCandidateWasCreated() {
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Csendes nap volt, nem történt semmi különös. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[]}]");

        extractionService.extractFor(owner, DAY);

        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
            .filteredOn(n -> "person_candidate".equals(n.getKind()))
            .isEmpty();
    }

    @Test
    void testExtractFor_shouldDropCandidate_whenTheNameIsNowhereInTheDayText() {
        // The grounding gate (mezo-06o0.9): the threshold is one occurrence, not two, but a name
        // the day's own text never contains is still a model invention and must be dropped.
        //
        // Scripting that needs a trick, because the sentinel JSON travels INSIDE the narrative the
        // fake reads back — a plainly spelled "name" would ground itself. So the name is written
        // as a JSON unicode escape: the narrative literally carries `\u0150rs` (folds to "u0150rs",
        // which contains no "ors"), while Jackson hands the service the parsed name "Őrs".
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Csendes nap volt, nem történt semmi különös. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"\\u0150rs\","
            + "\"quotes\":[\"valaki régen erről mesélt\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result).isEqualTo(PersonExtractionResult.ZERO);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
    }

    @Test
    void testExtractFor_shouldSeeTrainingNoteText_whenTheNameLivesOnlyThere() {
        // mezo-06o0.13: the sport note is free text the user writes, so a face first named there
        // has to be able to become a candidate. Same seam proof as the gratitude case — the
        // sentinel's name is unicode-escaped, so only the sport row can ground "Nóri".
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Semmi különös a mai napban. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"\\u004E\\u00F3ri\","
            + "\"quotes\":[\"jó meccs volt\"]}]}]");
        SportSessionEntity sport = trainPopulator.createSportSession(owner, DAY);
        sport.setNotes("Nórival röpiztünk, jó meccs volt.");
        sportSessionRepository.saveAndFlush(sport);

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.candidates()).isEqualTo(1);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner))
            .extracting(PersonEntity::getName).containsExactly("Nóri");
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
    void testExtractFor_shouldCreateCandidate_whenTheNameIsNamedExactlyOnce() {
        // THE regression for mezo-06o0.9. The old gate wanted two occurrences in the day (or three
        // across the week), and real writing does not repeat a name — "eljöttünk strandröpizni
        // Ancsival" names her once and never again. Live, that gate returned zero candidates on
        // three consecutive nights while five real names sat in the reflections. One is enough now.
        //
        // The JSON unicode escape keeps the sentinel from grounding the name by itself (see the
        // nowhere-in-the-day test): "Ancsi" reaches the gate ONLY through the prose below.
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Ma eljöttünk strandröpizni Ancsival, semmi extra. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"\\u0041ncsi\","
            + "\"quotes\":[\"eljöttünk strandröpizni\"]}]}]");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.candidates()).isEqualTo(1);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner))
            .extracting(PersonEntity::getName).containsExactly("Ancsi");
    }

    @Test
    void testExtractFor_shouldSeeGratitudeText_whenTheNameLivesOnlyThere() {
        // mezo-06o0.10: the day's narrative used to be journal + evening reflection + daily
        // summary only, so a face first named in a gratitude entry could never become a candidate.
        // The name is unicode-escaped in the sentinel, so the ONLY thing that can ground "Kriszti" is
        // the gratitude row — if gratitude dropped out of the narrative, this test fails.
        UUID owner = ownerId();
        plantEntry(owner, DAY, "Semmi különös a mai napban. "
            + "[fake-people:{\"mentions\":[],\"candidates\":[{\"name\":\"\\u004Briszti\","
            + "\"quotes\":[\"hálás vagyok a délutánért\"]}]}]");
        journalPopulator.createGratitude(owner, DAY, "Hálás vagyok, hogy Krisztivel beszélgettünk.", "connection");

        PersonExtractionResult result = extractionService.extractFor(owner, DAY);

        assertThat(result.candidates()).isEqualTo(1);
        assertThat(personRepository.findAllByCreatedByAndDeletedFalseOrderByNameAsc(owner))
            .extracting(PersonEntity::getName).containsExactly("Kriszti");
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
