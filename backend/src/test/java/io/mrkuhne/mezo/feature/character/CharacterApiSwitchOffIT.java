package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.detector.CharacterDetector;
import io.mrkuhne.mezo.feature.character.detector.CheckinGapDetector;
import io.mrkuhne.mezo.feature.character.detector.ChatTopicShiftDetector;
import io.mrkuhne.mezo.feature.character.detector.DetectorRegistry;
import io.mrkuhne.mezo.feature.character.detector.ExperimentOutcomeLedgerDetector;
import io.mrkuhne.mezo.feature.character.detector.JournalNoteDetector;
import io.mrkuhne.mezo.feature.character.detector.JournalSilenceDetector;
import io.mrkuhne.mezo.feature.character.detector.KnowledgeRejectionPatternDetector;
import io.mrkuhne.mezo.feature.character.detector.LoggingGapDetector;
import io.mrkuhne.mezo.feature.character.detector.MentionContextShiftDetector;
import io.mrkuhne.mezo.feature.character.detector.PeopleMoodLinkDetector;
import io.mrkuhne.mezo.feature.character.detector.PredictionCalibrationDetector;
import io.mrkuhne.mezo.feature.character.detector.QuestCompletionCalibrationDetector;
import io.mrkuhne.mezo.feature.character.detector.UnderLoggingDetector;
import io.mrkuhne.mezo.feature.character.detector.WeekendGapDetector;
import io.mrkuhne.mezo.feature.character.service.CharacterMetaReads;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Character switch off ⇒ the whole /api/character HTTP surface does not exist (bean-boundary gating). */
@TestPropertySource(properties = "mezo.feature.character.enabled=false")
class CharacterApiSwitchOffIT extends ApiIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void the_detector_beans_are_absent() {
        // mezo-1gim.4 item 4: the five detectors + the registry that injects List<CharacterDetector>
        // must all be gone with the switch off, and the registry must not fail to construct on an
        // empty list (there's simply no bean to construct).
        assertThat(context.getBeanProvider(DetectorRegistry.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(CheckinGapDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(LoggingGapDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(JournalSilenceDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(JournalNoteDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(UnderLoggingDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(PeopleMoodLinkDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(MentionContextShiftDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(WeekendGapDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(ChatTopicShiftDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(KnowledgeRejectionPatternDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(PredictionCalibrationDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(QuestCompletionCalibrationDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(ExperimentOutcomeLedgerDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(CharacterMetaReads.class).getIfAvailable()).isNull();
        assertThat(context.getBeansOfType(CharacterDetector.class)).isEmpty();
    }

    @Test
    void testGetOverview_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetDimension_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/dimension/discipline", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetFeed_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/feed", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testListConferences_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/conference", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetConference_shouldReturn404_whenCharacterSwitchedOff() {
        String body = getForBody(
                "/api/character/conference/" + UUID.randomUUID(), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
