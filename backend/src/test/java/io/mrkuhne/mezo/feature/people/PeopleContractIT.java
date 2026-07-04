package io.mrkuhne.mezo.feature.people;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogMentionRequest;
import io.mrkuhne.mezo.api.dto.MentionResponse;
import io.mrkuhne.mezo.api.dto.PeopleResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
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
            new LogMentionRequest("positive", "Röpi után sör."),
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
            new LogMentionRequest("positive", null),
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
    void testGetPeopleBootstrap_shouldReturn401_whenNoToken() {
        getForBody("/api/people", null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
