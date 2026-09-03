package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateInviteRequest;
import io.mrkuhne.mezo.api.dto.InviteResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/admin/invites (mezo-qw37.3): owner-only minting, listing and revoking of invite codes. */
class AdminInviteIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/invites";

    @Autowired private InviteRepository inviteRepository;

    @Test
    void testInvites_shouldReturn401_whenNoToken() {
        getForBody(URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testInvites_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        String body = getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "AUTH_FORBIDDEN");
        String create = postForBody(URI, new CreateInviteRequest("x", null), anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(create, "AUTH_FORBIDDEN");
        deleteAndExpect(URI + "/" + java.util.UUID.randomUUID(), anna.headers(), HttpStatus.FORBIDDEN);
    }

    @Test
    void testCreateInvite_shouldMintReadableCodeWithExpiry_whenOwner() {
        InviteResponse invite = postForBody(URI, new CreateInviteRequest("Csaba", 7), ownerAuthHeaders(),
            HttpStatus.OK, InviteResponse.class);

        assertThat(invite.getCode()).matches("MEZO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}");
        assertThat(invite.getLabel()).isEqualTo("Csaba");
        assertThat(invite.getExpiresAt()).isAfter(OffsetDateTime.now().plusDays(6));
        assertThat(invite.getUsedBy()).isNull();
        assertThat(inviteRepository.findById(invite.getId())).isPresent();
    }

    @Test
    void testListInvites_shouldShowConsumerName_whenCodeWasUsed() {
        InviteResponse open = postForBody(URI, new CreateInviteRequest(null, null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        InviteResponse used = postForBody(URI, new CreateInviteRequest("Béla", null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        postForBody("/api/auth/register", new RegisterRequest(used.getCode(), "bela-admin@test.local", "teszt-jelszo-1", "Béla"),
            null, HttpStatus.OK, TokenResponse.class);

        List<InviteResponse> invites = getForList(URI, ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);

        // newest first: the used one was minted second
        assertThat(invites).extracting(InviteResponse::getId).containsExactly(used.getId(), open.getId());
        assertThat(invites.getFirst().getUsedByName()).isEqualTo("Béla");
        assertThat(invites.getFirst().getUsedAt()).isNotNull();
        assertThat(invites.get(1).getUsedBy()).isNull();
    }

    @Test
    void testDeleteInvite_shouldRemoveOpenCode_whenOwner() {
        InviteResponse open = postForBody(URI, new CreateInviteRequest(null, null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        deleteAndExpect(URI + "/" + open.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);
        assertThat(inviteRepository.findById(open.getId())).isEmpty();
    }

    @Test
    void testDeleteInvite_shouldReturn409_whenCodeAlreadyUsed() {
        InviteResponse used = postForBody(URI, new CreateInviteRequest(null, null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        postForBody("/api/auth/register", new RegisterRequest(used.getCode(), "used-admin@test.local", "teszt-jelszo-1", "Dóra"),
            null, HttpStatus.OK, TokenResponse.class);

        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, URI + "/" + used.getId(), null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "ADMIN_INVITE_USED");
        assertThat(inviteRepository.findById(used.getId())).isPresent();
    }

    @Test
    void testDeleteInvite_shouldReturn404_whenUnknown() {
        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, URI + "/" + java.util.UUID.randomUUID(), null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "ADMIN_INVITE_NOT_FOUND");
    }
}
