package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.api.dto.CharacterCouncilStatusResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class CharacterCouncilApiIT extends ApiIntegrationTest {
    @Autowired private CharacterReplyPopulator data;
    @Autowired private AppUserRepository users;
    @Autowired private io.mrkuhne.mezo.support.populator.CharacterClaimRevisionPopulator revisionData;

    @Test
    void testEndpoints_shouldRequireAuthentication_whenAnonymous() {
        getForBody("/api/character/council", null, HttpStatus.UNAUTHORIZED, String.class);
        getForBody("/api/character/claims/"+UUID.randomUUID()+"/revisions", null, HttpStatus.UNAUTHORIZED, String.class);
        postForBody("/api/character/revisions/"+UUID.randomUUID()+"/undo", null, null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testStatus_shouldBeWaitingWithoutModelWork_whenNoEdition() {
        var status = getForBody("/api/character/council", ownerAuthHeaders(), HttpStatus.OK, CharacterCouncilStatusResponse.class);
        assertThat(status.getStatus().getValue()).isEqualTo("WAITING");
        assertThat(status.getConferenceId()).isNull();
    }

    @Test
    void testRevisions_shouldHideForeignClaimAndRevision_whenOtherUserRequests() {
        var owner = users.findAll().getFirst().getId();
        var claim = data.claim(owner);
        var revision = revisionData.createdClaim(claim);
        var other = registerUser("council-other");
        getForBody("/api/character/claims/"+claim.getId()+"/revisions", other.headers(), HttpStatus.NOT_FOUND, String.class);
        postForBody("/api/character/revisions/"+revision.getId()+"/undo", null, other.headers(), HttpStatus.NOT_FOUND, String.class);
    }
}
