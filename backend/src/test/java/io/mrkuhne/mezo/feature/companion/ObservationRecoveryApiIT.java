package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
class ObservationRecoveryApiIT extends ApiIntegrationTest {
    private static final String URL = "/api/companion/observation/recovery";
    @Autowired private AppUserRepository users;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JournalPopulator journals;
    @Autowired private JournalEntryRepository journalRepository;
    @Autowired private DailySummaryPopulator summaries;
    @Autowired private LlmLogPopulator logs;
    @Autowired private LlmLogRepository logRepository;
    @Autowired private PatternRepository patterns;
    @Autowired private ObjectMapper json;
    @Autowired private io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService pipeline;

    private UUID owner() { return users.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId(); }

    @Test
    void testRecovery_shouldRequireOwner_whenUnauthenticatedOrOrdinaryUser() {
        postForBody(URL, Map.of("mode", "preview"), null, HttpStatus.UNAUTHORIZED, String.class);
        postForBody(URL, Map.of("mode", "preview"), registerUser("recovery-other").headers(),
                HttpStatus.FORBIDDEN, String.class);
    }

    @Test
    void testPreview_shouldNotUseOtherOwnersLogs_whenOnlyForeignLogsExist() {
        seedLog(userPopulator.createUser().getId());
        JsonNode result = request(Map.of("mode", "preview"));
        assertThat(result.path("candidates").size()).isZero();
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).isEmpty();
    }

    @Test
    void testApply_shouldUseExactPreviewWithoutDuplicates_whenRetried() {
        seed();
        JsonNode preview = request(Map.of("mode", "preview"));
        assertThat(preview.path("candidates").size()).isEqualTo(1);
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).isEmpty();
        Map<String, String> apply = Map.of("mode", "apply", "planId", preview.path("planId").asText());
        assertThat(request(apply).path("created").asInt()).isEqualTo(1);
        assertThat(request(apply).path("created").asInt()).isEqualTo(1);
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).hasSize(1);
    }

    @Test
    void testApply_shouldRevalidateSources_whenSourceDeletedAfterPreview() {
        UUID journal = seed();
        JsonNode preview = request(Map.of("mode", "preview"));
        journalRepository.delete(journalRepository.findById(journal).orElseThrow());
        assertThat(request(Map.of("mode", "apply", "planId", preview.path("planId").asText()))
                .path("created").asInt()).isZero();
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).isEmpty();
    }

    @Test
    void testApply_shouldRejectUnknownPlan_whenNoServerPreviewExists() {
        postForBody(URL, Map.of("mode", "apply", "planId", UUID.randomUUID().toString()),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void testPreview_shouldReportLlmFailure_whenProposalTransportFails() {
        seedLog(owner());
        summaries.summary(owner(), LocalDate.now().minusDays(1), "[fake-fail]");
        assertPreviewFailure();
    }

    @ParameterizedTest
    @ValueSource(strings = {"[not-json]", "[{}]", "[null]"})
    void testPreview_shouldReportLlmFailure_whenProposalOutputIsMalformed(String output) {
        seedLog(owner());
        summaries.summary(owner(), LocalDate.now().minusDays(1), "[fake-hypotheses:" + output + "]");
        assertPreviewFailure();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{not-json}", "{}"})
    void testPreview_shouldReportLlmFailure_whenCritiqueOutputIsMalformed(String output) {
        seed(output);
        assertPreviewFailure();
    }

    @Test
    void testPreview_shouldReportLlmFailure_whenCritiqueTransportFails() {
        UUID source = seed();
        // The JSON escape prevents the proposal-call fake from seeing the failure marker.
        // Deserialization restores it only in the candidate that the critique call receives.
        String proposal = json.writeValueAsString(List.of(Map.of("title", "[fake-fail]",
                "mechanism", "Kapcsolat", "category", "trigger", "observation", "Munka után elfáradtál.",
                "question", "Jellemző?", "evidenceRefs", List.of("journal_entry:" + source), "topicKey", "work-energy")))
                .replace("[fake-fail]", "\\u005bfake-fail\\u005d");
        summaries.summary(owner(), LocalDate.now(), "[fake-hypotheses:" + proposal + "]");
        assertPreviewFailure();
    }

    @Test
    void testPreview_shouldReturnSuccessfulEmptyPlan_whenModelExplicitlyReturnsNoProposals() {
        seedLog(owner());
        summaries.summary(owner(), LocalDate.now().minusDays(1), "[fake-hypotheses:[]]");
        assertThat(request(Map.of("mode", "preview")).path("candidates").size()).isZero();
    }

    @Test
    void testPreview_shouldReturnSuccessfulEmptyPlan_whenValidCritiqueRejectsCandidate() {
        seed(json.writeValueAsString(Map.of("statistical", .1, "confounders", .2, "l3align", .4,
                "actionability", .2, "grounded", false, "contradicted", true, "actionable", false,
                "reasoning", "A forrás nem támasztja alá.")));
        assertThat(request(Map.of("mode", "preview")).path("candidates").size()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"[fake-fail]", "[fake-hypotheses:[not-json]]"})
    void testRun_shouldRemainFailSoft_whenNightlyProposalCallFails(String script) {
        summaries.summary(owner(), LocalDate.now().minusDays(1), script);
        assertThat(pipeline.run(owner(), null)).isZero();
    }

    private void assertPreviewFailure() {
        String body = postForBody(URL, Map.of("mode", "preview"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "OBSERVATION_RECOVERY_LLM_FAILED");
        assertThat(patterns.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner())).isEmpty();
    }

    private JsonNode request(Map<String, String> body) {
        return json.readTree(postForBody(URL, body, ownerAuthHeaders(), HttpStatus.OK, String.class));
    }

    private void seedLog(UUID owner) {
        var log = logs.log(owner, CallKind.SMART, "companion_hypothesis", "fake", 10, 10);
        log.setOperation("propose");
        log.setResponseText("[{\"title\":\"Munka és energia\",\"category\":\"trigger\"}]");
        logRepository.saveAndFlush(log);
    }

    private UUID seed() {
        return seed(json.writeValueAsString(Map.of("statistical", .1, "confounders", .2,
                "l3align", .4, "actionability", .8, "grounded", true, "contradicted", false,
                "actionable", true, "reasoning", "Eredeti napló alapján kérdez.")));
    }

    private UUID seed(String critique) {
        UUID owner = owner();
        var journal = journals.createEntry(owner, LocalDate.now().minusDays(2), "Munka után kimerültem.", "quickinput");
        String proposal = json.writeValueAsString(List.of(Map.of("title", "Munka és energia [fake-critique:" + critique + "]",
                "mechanism", "Lehetséges kapcsolat", "category", "trigger", "observation", "Munka után kimerültséget írtál.",
                "question", "Rád illik?", "evidenceRefs", List.of("journal_entry:" + journal.getId()), "topicKey", "work-energy")));
        summaries.summary(owner, LocalDate.now().minusDays(1), "Nap. [fake-hypotheses:" + proposal + "]");
        seedLog(owner);
        return journal.getId();
    }
}
