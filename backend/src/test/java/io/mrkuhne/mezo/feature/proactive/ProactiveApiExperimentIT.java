package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExperimentDecisionRequest;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** HTTP-level experiment flow: list (lazy propose) + L2 accept/dismiss decision + guards. */
@ActiveProfiles("companion-fake")
class ProactiveApiExperimentIT extends ApiIntegrationTest {

    @Autowired private PatternPopulator patternPopulator;
    @Autowired private ExperimentPopulator experimentPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetExperiments_shouldReturnEmpty_whenNoConfirmedPatterns() {
        List<ExperimentResponse> experiments = getForList(
                "/api/proactive/experiment", ownerAuthHeaders(), HttpStatus.OK, ExperimentResponse.class);

        assertThat(experiments).isEmpty();   // honest empty (lazy propose has no grounding), never 404
    }

    @Test
    void testGetExperiments_shouldLazilyPropose_whenConfirmedPatternExists() {
        patternPopulator.statistical(ownerId(), "sleep~rpe", PatternEntity.STATUS_CONFIRMED);

        List<ExperimentResponse> experiments = getForList(
                "/api/proactive/experiment", ownerAuthHeaders(), HttpStatus.OK, ExperimentResponse.class);

        assertThat(experiments).hasSize(1);
        assertThat(experiments.getFirst().getStatus()).isEqualTo(ExperimentEntity.STATUS_PROPOSED);
        assertThat(experiments.getFirst().getStartDate()).isNull();
    }

    @Test
    void testDecide_shouldActivateThenReject409_whenAcceptedThenReDecided() {
        ExperimentEntity proposed = experimentPopulator.experiment(ownerId(),
                ExperimentEntity.STATUS_PROPOSED, PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);

        ExperimentResponse activated = postForBody(
                "/api/proactive/experiment/" + proposed.getId() + "/decision",
                new ExperimentDecisionRequest().decision("accept"),
                ownerAuthHeaders(), HttpStatus.OK, ExperimentResponse.class);
        assertThat(activated.getStatus()).isEqualTo(ExperimentEntity.STATUS_ACTIVE);
        assertThat(activated.getStartDate()).isNotNull();

        // re-deciding a now-active experiment is a conflict (only proposed rows are decidable)
        String body = postForBody(
                "/api/proactive/experiment/" + proposed.getId() + "/decision",
                new ExperimentDecisionRequest().decision("dismiss"),
                ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "PROACTIVE_EXPERIMENT_NOT_PROPOSED");
    }

    @Test
    void testDecide_shouldDismissAndDropFromList_whenDismissed() {
        ExperimentEntity proposed = experimentPopulator.experiment(ownerId(),
                ExperimentEntity.STATUS_PROPOSED, PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);

        postForBody("/api/proactive/experiment/" + proposed.getId() + "/decision",
                new ExperimentDecisionRequest().decision("dismiss"),
                ownerAuthHeaders(), HttpStatus.OK, ExperimentResponse.class);

        // dismissed rows are excluded from the live list (no confirmed pattern ⇒ no lazy re-propose)
        assertThat(getForList("/api/proactive/experiment", ownerAuthHeaders(), HttpStatus.OK, ExperimentResponse.class))
                .isEmpty();
    }

    @Test
    void testDecide_shouldReturn404_whenForeignOrMissing() {
        postForBody("/api/proactive/experiment/" + UUID.randomUUID() + "/decision",
                new ExperimentDecisionRequest().decision("accept"),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDecide_shouldReturn400_whenDecisionInvalid() {
        ExperimentEntity proposed = experimentPopulator.experiment(ownerId(),
                ExperimentEntity.STATUS_PROPOSED, PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);

        String body = postForBody("/api/proactive/experiment/" + proposed.getId() + "/decision",
                new ExperimentDecisionRequest().decision("love-it"),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertThat(body).contains("decision");
    }

    @Test
    void testPropose_shouldPersistProposal_whenUnderCapWithPattern() {
        patternPopulator.statistical(ownerId(), "sleep~rpe", PatternEntity.STATUS_CONFIRMED);

        // POST /propose returns the freshly proposed array; assert 200 then confirm via the list read
        assertThat(exchangeForResponse(
                org.springframework.http.HttpMethod.POST, "/api/proactive/experiment/propose", null, ownerAuthHeaders())
                .getStatusCode().value()).isEqualTo(200);

        assertThat(getForList("/api/proactive/experiment", ownerAuthHeaders(), HttpStatus.OK, ExperimentResponse.class))
                .hasSize(1);
    }

    @Test
    void testGetExperiments_shouldReturn401_whenNoToken() {
        getForBody("/api/proactive/experiment", null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
