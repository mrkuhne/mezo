package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.api.dto.PersonFactResponse;
import io.mrkuhne.mezo.api.dto.UpdatePersonFactRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** S3 (mezo-d6ivw.3): HTTP round-trip a person-fact végpontokon a generált kontrakton át. */
class PersonFactControllerIT extends ApiIntegrationTest {

    @Autowired private PersonPopulator personPopulator;
    @Autowired private PersonFactService personFactService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private PersonFactEntity seedFact(UUID owner, PersonEntity person, String text) {
        return personFactService.capture(owner, PersonFactEntity.SOURCE_CHAT_TURN, "msg-ct",
            List.of(new PersonFactService.PersonFactCapture(
                person.getId(), PersonFactEntity.KIND_PREFERENCE, text, "high"))).get(0);
    }

    @Test
    void testGetFactsBySource_shouldReturnCapturedFacts() {
        UUID owner = ownerId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        seedFact(owner, anna, "Nem szereti a meglepetéseket");

        List<PersonFactResponse> res = getForList(
            "/api/people/facts?sourceRefKind=chat_turn&sourceRefId=msg-ct",
            ownerAuthHeaders(), HttpStatus.OK, PersonFactResponse.class);

        assertThat(res).hasSize(1);
        assertThat(res.getFirst().getFactText()).isEqualTo("Nem szereti a meglepetéseket");
        assertThat(res.getFirst().getKind()).isEqualTo(PersonFactResponse.KindEnum.PREFERENCE);
        assertThat(res.getFirst().getPersonId()).isEqualTo(anna.getId());
        assertThat(res.getFirst().getSeen()).isFalse();
    }

    @Test
    void testUndoPersonFact_shouldDeactivate_andDisappearFromSourceFetch() {
        UUID owner = ownerId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        PersonFactEntity fact = seedFact(owner, anna, "Kávé nélkül nem ember");

        deleteAndExpect("/api/people/" + anna.getId() + "/facts/" + fact.getId(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        List<PersonFactResponse> res = getForList(
            "/api/people/facts?sourceRefKind=chat_turn&sourceRefId=msg-ct",
            ownerAuthHeaders(), HttpStatus.OK, PersonFactResponse.class);
        assertThat(res).isEmpty();
    }

    @Test
    void testUndoPersonFact_shouldReturn404_onForeignOrMismatchedPerson() {
        UUID owner = ownerId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        PersonEntity beni = personPopulator.createPerson(owner, "Beni");
        PersonFactEntity fact = seedFact(owner, anna, "Szereti a túrázást");

        deleteAndExpect("/api/people/" + beni.getId() + "/facts/" + fact.getId(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND);
        deleteAndExpect("/api/people/" + anna.getId() + "/facts/" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }

    @Test
    void testUpdatePersonFact_shouldToggleIncludeInPrompt() {
        UUID owner = ownerId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        PersonFactEntity fact = seedFact(owner, anna, "Éjszakai bagoly");

        PersonFactResponse res = patchForBody(
            "/api/people/" + anna.getId() + "/facts/" + fact.getId(),
            new UpdatePersonFactRequest(false),
            ownerAuthHeaders(), HttpStatus.OK, PersonFactResponse.class);

        assertThat(res.getIncludeInPrompt()).isFalse();
        assertThat(res.getActive()).isTrue();
    }

    @Test
    void testMarkSeenAndBootstrapFacts() {
        UUID owner = ownerId();
        PersonEntity anna = personPopulator.createPerson(owner, "Anna");
        PersonFactEntity fact = seedFact(owner, anna, "Születésnap: október 12.");

        PeopleResponse before = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(before.getPersons().getFirst().getFacts())
            .extracting(PersonFactResponse::getId).contains(fact.getId());
        assertThat(before.getPersons().getFirst().getFacts().getFirst().getSeen()).isFalse();

        postForBody("/api/people/" + anna.getId() + "/facts/seen", null,
            ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        PeopleResponse after = getForBody("/api/people", ownerAuthHeaders(), HttpStatus.OK, PeopleResponse.class);
        assertThat(after.getPersons().getFirst().getFacts().getFirst().getSeen()).isTrue();
    }
}
