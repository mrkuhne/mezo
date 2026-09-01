package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonDecisionRequest;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.api.dto.UpdatePersonRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MentionPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP round-trip through the generated {@code PeopleApi} contract. */
class PeopleContractIT extends ApiIntegrationTest {

    @Autowired private PersonPopulator personPopulator;
    @Autowired private MentionPopulator mentionPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MentionRepository mentionRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetPeopleBootstrap_shouldReturnPersonsAndFeed_whenDataExists() {
        UUID owner = ownerId();
        PersonEntity petra = personPopulator.createPerson(owner, "Petra", "partner", "positive");
        mentionPopulator.createMention(owner, petra.getId(), Instant.now(), "positive");

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);

        assertThat(res.getPersons()).hasSize(1);
        assertThat(res.getPersons().getFirst().getName()).isEqualTo("Petra");
        assertThat(res.getPersons().getFirst().getMentionCount()).isEqualTo(1);
        assertThat(res.getPersons().getFirst().getKnownFacts()).isNotEmpty();
        assertThat(res.getMentions()).hasSize(1);
        assertThat(res.getMentions().getFirst().getPersonName()).isEqualTo("Petra");
    }

    @Test
    void testLogMention_shouldCreateAndAppearInBootstrap_whenPersonOwned() {
        UUID owner = ownerId();
        PersonEntity bence = personPopulator.createPerson(owner, "Bence", "teammate", "positive");

        MentionResponse created = postForBody("/api/people/" + bence.getId() + "/mentions",
            new LogMentionRequest("positive", "Röpi után sör.", null),
            ownerAuthHeaders(), HttpStatus.CREATED, MentionResponse.class);

        assertThat(created.getPersonId()).isEqualTo(bence.getId());
        assertThat(created.getSource()).isEqualTo(MentionResponse.SourceEnum.CHIP);
        assertThat(created.getExcerpt()).isEqualTo("Röpi után sör.");

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(res.getMentions()).extracting(MentionResponse::getId).contains(created.getId());
        assertThat(res.getPersons().getFirst().getMentionsThisWeek()).isEqualTo(1);
    }

    @Test
    void testLogMention_shouldReturn404_whenPersonBelongsToAnotherUser() {
        UUID other = userPopulator.createUser("stranger-people@test.hu").getId();
        PersonEntity foreign = personPopulator.createPerson(other, "Idegen");

        postForBody("/api/people/" + foreign.getId() + "/mentions",
            new LogMentionRequest("positive", null, null),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testLogMention_shouldReturn400_whenToneInvalid() {
        UUID owner = ownerId();
        PersonEntity p = personPopulator.createPerson(owner, "Anna");

        String body = postForBody("/api/people/" + p.getId() + "/mentions",
            java.util.Map.of("tone", "ecstatic"),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "tone", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testLogMention_shouldPersistContextLabel_whenProvided() {
        UUID owner = ownerId();
        PersonEntity p = personPopulator.createPerson(owner, "Petra", "partner", "positive");

        LogMentionRequest req = new LogMentionRequest("positive", "Közös vacsora.", LogMentionRequest.ContextLabelEnum.KOZOS_PROGRAM);

        MentionResponse created = postForBody("/api/people/" + p.getId() + "/mentions", req,
            ownerAuthHeaders(), HttpStatus.CREATED, MentionResponse.class);

        assertThat(created.getContextLabel()).isEqualTo(MentionResponse.ContextLabelEnum.KOZOS_PROGRAM);
    }

    @Test
    void testGetPeopleBootstrap_shouldReturnEmptyGraphEdges_notNull_whenNoGraph() {
        // Task 5 (mezo-06o0.4): a required `graphEdges` mező sosem hiányozhat a wire-ról — gráf
        // nélküli/tétlen tesztprofilban ez üres tömb, nem null.
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Nóra", "friend", "positive");

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);

        assertThat(res.getPersons().getFirst().getGraphEdges()).isNotNull().isEmpty();
    }

    @Test
    void testGetPeopleBootstrap_shouldReturn401_whenNoToken() {
        getForBody("/api/people", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetPeopleBootstrap_shouldCarryAliasesStatusAndSourceKind() {
        UUID owner = ownerId();
        personPopulator.createPerson(owner, "Marci", "friend", "positive");

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);

        assertThat(res.getPersons().getFirst().getAliases()).containsExactly("Marcika");
        assertThat(res.getPersons().getFirst().getStatus()).isEqualTo(PersonResponse.StatusEnum.ACTIVE);
        assertThat(res.getPersons().getFirst().getSourceKind()).isEqualTo(PersonResponse.SourceKindEnum.MANUAL);
        assertThat(res.getPersons().getFirst().getRelationship()).isEqualTo(PersonResponse.RelationshipEnum.FRIEND);
    }

    @Test
    void testCreatePerson_shouldPersistWithDerivedInitialAndDefaults() {
        CreatePersonRequest req = new CreatePersonRequest();
        req.setName("Ádám");
        req.setRelationship(CreatePersonRequest.RelationshipEnum.FRIEND);
        req.setRelationshipHu("Barát");
        req.setAliases(java.util.List.of("Adi", "Ádámka"));

        PersonResponse created = postForBody("/api/people", req, ownerAuthHeaders(),
            HttpStatus.CREATED, PersonResponse.class);

        assertThat(created.getInitial()).isEqualTo("Á");
        assertThat(created.getAliases()).containsExactly("Adi", "Ádámka");
        assertThat(created.getAffectBaseline()).isEqualTo(PersonResponse.AffectBaselineEnum.NEUTRAL);
        assertThat(created.getStatus()).isEqualTo(PersonResponse.StatusEnum.ACTIVE);
        assertThat(created.getSourceKind()).isEqualTo(PersonResponse.SourceKindEnum.MANUAL);
        assertThat(created.getMentionCount()).isZero();

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(res.getPersons()).extracting(PersonResponse::getName).contains("Ádám");
    }

    @Test
    void testCreatePerson_shouldReturn400_whenNameBlank() {
        String body = postForBody("/api/people",
            java.util.Map.of("name", "", "relationship", "friend", "relationshipHu", "Barát"),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "name", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreatePerson_shouldReturn400_whenNameWhitespaceOnly() {
        String body = postForBody("/api/people",
            java.util.Map.of("name", "   ", "relationship", "friend", "relationshipHu", "Barát"),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "name", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdatePerson_shouldReplaceEditableFields_andKeepCuratedOnes() {
        UUID owner = ownerId();
        PersonEntity p = personPopulator.createPerson(owner, "Réka", "colleague", "neutral");

        UpdatePersonRequest req = UpdatePersonRequest.builder()
            .name("Réka B.")
            .relationship(UpdatePersonRequest.RelationshipEnum.COLLEAGUE)
            .relationshipHu("Kolléga · Q3")
            .build();
        req.setAliases(java.util.List.of("Réki"));
        req.setNotes("Projekt lezárva.");

        PersonResponse updated = putForBody("/api/people/" + p.getId(), req, ownerAuthHeaders(),
            HttpStatus.OK, PersonResponse.class);

        assertThat(updated.getName()).isEqualTo("Réka B.");
        assertThat(updated.getAliases()).containsExactly("Réki");
        assertThat(updated.getKnownFacts()).isNotEmpty(); // AI-kurálta mező érintetlen
    }

    @Test
    void testUpdatePerson_shouldReturn404_whenForeign() {
        UUID other = userPopulator.createUser("stranger-people-upd@test.hu").getId();
        PersonEntity foreign = personPopulator.createPerson(other, "Idegen");

        UpdatePersonRequest req = UpdatePersonRequest.builder()
            .name("X")
            .relationship(UpdatePersonRequest.RelationshipEnum.FRIEND)
            .relationshipHu("Barát")
            .build();

        putForBody("/api/people/" + foreign.getId(), req,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDeletePerson_shouldSoftDelete_andDropFromBootstrapWithMentions() {
        UUID owner = ownerId();
        PersonEntity p = personPopulator.createPerson(owner, "Törlendő");
        mentionPopulator.createMention(owner, p.getId(), Instant.now(), "positive");

        deleteAndExpect("/api/people/" + p.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(res.getPersons()).extracting(PersonResponse::getName).doesNotContain("Törlendő");
        assertThat(res.getMentions()).extracting(MentionResponse::getPersonId).doesNotContain(p.getId());
    }

    @Test
    void testDeleteMention_shouldSoftDeleteAndVanishFromBootstrap() {
        UUID owner = ownerId();
        PersonEntity p = personPopulator.createPerson(owner, "Emese", "friend", "positive");
        MentionEntity mention = mentionPopulator.createMention(owner, p.getId(), Instant.now(), "positive");

        deleteAndExpect("/api/people/" + p.getId() + "/mentions/" + mention.getId(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(res.getMentions()).extracting(MentionResponse::getId).doesNotContain(mention.getId());
        assertThat(res.getPersons().getFirst().getMentionCount()).isZero();
    }

    @Test
    void testDeleteMention_shouldReturn404_whenMentionBelongsToOtherPerson() {
        UUID owner = ownerId();
        PersonEntity p1 = personPopulator.createPerson(owner, "Gergő", "friend", "positive");
        PersonEntity p2 = personPopulator.createPerson(owner, "Hanna", "friend", "positive");
        MentionEntity mention = mentionPopulator.createMention(owner, p1.getId(), Instant.now(), "positive");

        deleteAndExpect("/api/people/" + p2.getId() + "/mentions/" + mention.getId(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }

    @Test
    void testBootstrap_shouldServeToneLessMention() {
        UUID owner = ownerId();
        PersonEntity p = personPopulator.createPerson(owner, "Ilona", "friend", "positive");
        MentionEntity m = new MentionEntity();
        m.setCreatedBy(owner);
        m.setPersonId(p.getId());
        m.setSource("text");
        m.setTone(null);
        m.setSourceRefKind("journal_entry");
        m.setSourceRefId(UUID.randomUUID());
        m.setExcerpt("Ádámmal futottam");
        m.setTs(Instant.now());
        m.setFlagged(false);
        mentionRepository.saveAndFlush(m);

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);

        MentionResponse found = res.getMentions().stream()
            .filter(mr -> mr.getPersonId().equals(p.getId()))
            .findFirst().orElseThrow();
        assertThat(found.getTone()).isNull();
        assertThat(found.getSource()).isEqualTo(MentionResponse.SourceEnum.TEXT);
    }

    @Test
    void testDecidePerson_shouldActivate_whenAccepted() {
        UUID owner = ownerId();
        PersonEntity candidate = personPopulator.createCandidate(owner, "Jelölt", "Kivonatolva egy naplóból.");

        PersonResponse decided = postForBody("/api/people/" + candidate.getId() + "/decision",
            new PersonDecisionRequest("accept"),
            ownerAuthHeaders(), HttpStatus.OK, PersonResponse.class);

        assertThat(decided.getStatus()).isEqualTo(PersonResponse.StatusEnum.ACTIVE);
        assertThat(decided.getSourceKind()).isEqualTo(PersonResponse.SourceKindEnum.EXTRACTOR);

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        PersonResponse fromBootstrap = res.getPersons().stream()
            .filter(p -> p.getId().equals(candidate.getId())).findFirst().orElseThrow();
        assertThat(fromBootstrap.getStatus()).isEqualTo(PersonResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testDecidePerson_shouldSoftDeleteAndKeepRow_whenRejected() {
        UUID owner = ownerId();
        PersonEntity candidate = personPopulator.createCandidate(owner, "Elvetett", "Kivonatolva egy naplóból.");

        PersonResponse decided = postForBody("/api/people/" + candidate.getId() + "/decision",
            new PersonDecisionRequest("reject"),
            ownerAuthHeaders(), HttpStatus.OK, PersonResponse.class);
        assertThat(decided.getId()).isEqualTo(candidate.getId());

        PeopleResponse res = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(res.getPersons()).extracting(PersonResponse::getId).doesNotContain(candidate.getId());

        // A sor fizikailag megvan (soft-delete), de findByIdAndCreatedByAndDeletedFalse már nem
        // látja — egy második döntés a candidate-en ezért 404-et ad, ez bizonyítja a soft-delete-et.
        postForBody("/api/people/" + candidate.getId() + "/decision",
            new PersonDecisionRequest("accept"),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDecidePerson_shouldReturn400_whenPersonIsNotCandidate() {
        UUID owner = ownerId();
        PersonEntity active = personPopulator.createPerson(owner, "Aktív");

        String body = postForBody("/api/people/" + active.getId() + "/decision",
            new PersonDecisionRequest("accept"),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "PEOPLE_CANDIDATE_ALREADY_DECIDED");
    }

    @Test
    void testDecidePerson_shouldReturn404_whenPersonIsForeignOrMissing() {
        postForBody("/api/people/" + UUID.randomUUID() + "/decision",
            new PersonDecisionRequest("accept"),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
