package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AboutMeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/** „Rólam is" (mezo-d6ivw.13) over HTTP: add / remove round-trip, auth, and the B-user 404. */
class CompanionAboutMeApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PersonFactService personFactService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private PersonPopulator persons;

    private static String url(UUID personFactId) {
        return "/api/companion/turn-memory/person-fact/" + personFactId + "/about-me";
    }

    private UUID ownerPersonFact() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        AiConversationEntity conversation = conversations.conversation(owner);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival jól vagyunk");
        PersonEntity dori = persons.createPerson(owner, "Dóri");
        return personFactService.capture(owner, PersonFactEntity.SOURCE_CHAT_TURN, turn.getId().toString(),
                List.of(new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_PREFERENCE,
                        "Dóri mellett nem kell megjátszanom magam.", "high"))).getFirst().getId();
    }

    @Test
    void addAndRemove_shouldRoundTrip_forTheOwner() {
        UUID personFactId = ownerPersonFact();

        AboutMeResponse added = postForBody(url(personFactId), null, ownerAuthHeaders(), HttpStatus.OK, AboutMeResponse.class);

        assertThat(added.getPersonFactId()).isEqualTo(personFactId);
        assertThat(added.getAboutMeFactId()).isNotNull();
        assertThat(knowledgeFactRepository.findById(added.getAboutMeFactId())).isPresent();

        AboutMeResponse removed = exchangeForBody(HttpMethod.DELETE, url(personFactId), null, ownerAuthHeaders(),
                HttpStatus.OK, AboutMeResponse.class);

        assertThat(removed.getAboutMeFactId()).isNull();
        assertThat(knowledgeFactRepository.findById(added.getAboutMeFactId())).isEmpty();
    }

    @Test
    void add_shouldReturn404_forAnotherUsersPersonFact() {
        UUID personFactId = ownerPersonFact();
        RegisteredUser stranger = registerUser("aboutme-b");

        postForBody(url(personFactId), null, stranger.headers(), HttpStatus.NOT_FOUND, String.class);
        AboutMeResponse removed = exchangeForBody(HttpMethod.DELETE, url(personFactId), null, stranger.headers(),
                HttpStatus.OK, AboutMeResponse.class);

        assertThat(removed.getAboutMeFactId()).isNull();
    }

    @Test
    void add_shouldReturn401_withoutToken() {
        postForBody(url(UUID.randomUUID()), null, null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
