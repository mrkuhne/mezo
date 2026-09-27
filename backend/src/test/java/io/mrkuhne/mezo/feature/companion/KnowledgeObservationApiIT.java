package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.KnowledgeObservationResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** S6 (mezo-d6ivw.6) Task A9: the Tudástár hub's observation endpoints over HTTP. */
@ActiveProfiles("companion-fake")
class KnowledgeObservationApiIT extends ApiIntegrationTest {

    private static final String KNOWLEDGE = "/api/companion/observation/knowledge";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void list_shouldServeTheOwnersConfirmedObservations() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED, Instant.now());

        List<KnowledgeObservationResponse> list = getForList(KNOWLEDGE, ownerAuthHeaders(), HttpStatus.OK,
                KnowledgeObservationResponse.class);

        assertThat(list).anySatisfy(r -> {
            assertThat(r.getPatternId()).isEqualTo(row.getId());
            assertThat(r.getStatus().getValue()).isEqualTo("confirmed");
            assertThat(r.getFactId()).isNull();
        });
    }

    @Test
    void forget_shouldForgetTheRow_andDropItFromTheList() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);

        deleteAndExpect("/api/companion/observation/" + row.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        assertThat(getForList(KNOWLEDGE, ownerAuthHeaders(), HttpStatus.OK, KnowledgeObservationResponse.class))
                .noneMatch(r -> r.getPatternId().equals(row.getId()));
    }

    @Test
    void forget_shouldReturn404_forAnUnknownRow() {
        deleteAndExpect("/api/companion/observation/" + UUID.randomUUID(), ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }

    @Test
    void factEvidence_shouldReturn404_forAnUnknownFact() {
        getForBody("/api/companion/fact/" + UUID.randomUUID() + "/evidence", ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void allThree_shouldReturn401_withoutToken() {
        getForBody(KNOWLEDGE, null, HttpStatus.UNAUTHORIZED, Void.class);
        deleteAndExpect("/api/companion/observation/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
        getForBody("/api/companion/fact/" + UUID.randomUUID() + "/evidence", null, HttpStatus.UNAUTHORIZED,
                Void.class);
    }
}
