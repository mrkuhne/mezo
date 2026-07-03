package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

/** V3.1 pattern inbox HTTP contract — list ownership, repeatable L2 decisions, error paths. */
@ActiveProfiles("companion-fake")
class CompanionPatternApiIT extends ApiIntegrationTest {

    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testListPatterns_shouldReturnOnlyOwnRows_whenForeignPatternsExist() {
        PatternEntity own = patternPopulator.statistical(ownerId());
        patternPopulator.statistical(userPopulator.createUser().getId());

        List<PatternResponse> patterns = getForList("/api/companion/pattern",
                ownerAuthHeaders(), HttpStatus.OK, PatternResponse.class);

        assertThat(patterns).hasSize(1);
        assertThat(patterns.getFirst().getId()).isEqualTo(own.getId());
        assertThat(patterns.getFirst().getKind()).isEqualTo("statistical");
        assertThat(patterns.getFirst().getConfidence()).isNull();
        assertThat(patterns.getFirst().getEvidence()).isNotEmpty();
    }

    @Test
    void testDecidePattern_shouldTransitionRepeatably_whenReDecided() {
        PatternEntity pattern = patternPopulator.statistical(ownerId());

        PatternResponse confirmed = postForBody(
                "/api/companion/pattern/" + pattern.getId() + "/decision",
                new PatternDecisionRequest().decision("confirm"),
                ownerAuthHeaders(), HttpStatus.OK, PatternResponse.class);
        assertThat(confirmed.getStatus()).isEqualTo("confirmed");

        // a pattern is a standing judgement — re-deciding is allowed (unlike fact candidates)
        PatternResponse monitored = postForBody(
                "/api/companion/pattern/" + pattern.getId() + "/decision",
                new PatternDecisionRequest().decision("monitor"),
                ownerAuthHeaders(), HttpStatus.OK, PatternResponse.class);
        assertThat(monitored.getStatus()).isEqualTo("monitoring");
    }

    @Test
    void testDecidePattern_shouldReturn404_whenForeignOrMissing() {
        PatternEntity foreign = patternPopulator.statistical(userPopulator.createUser().getId());

        postForBody("/api/companion/pattern/" + foreign.getId() + "/decision",
                new PatternDecisionRequest().decision("confirm"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        postForBody("/api/companion/pattern/" + UUID.randomUUID() + "/decision",
                new PatternDecisionRequest().decision("confirm"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDecidePattern_shouldReturn400_whenDecisionInvalid() {
        PatternEntity pattern = patternPopulator.statistical(ownerId());

        String body = postForBody("/api/companion/pattern/" + pattern.getId() + "/decision",
                new PatternDecisionRequest().decision("love-it"),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertThat(body).contains("decision");
    }

    @Test
    void testPatternEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/companion/pattern", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
