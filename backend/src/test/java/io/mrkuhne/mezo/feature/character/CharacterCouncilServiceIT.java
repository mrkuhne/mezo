package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.character.repository.*;
import io.mrkuhne.mezo.feature.character.service.*;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class CharacterCouncilServiceIT extends AbstractIntegrationTest {
    @Autowired private CharacterCouncilService council;
    @Autowired private CharacterCouncilProcessing processing;
    @Autowired private CharacterRunLog runs;
    @Autowired private UserPopulator users;
    @Autowired private CharacterReplyPopulator data;
    @Autowired private CharacterObservationRepository observations;
    @Autowired private CharacterConferenceRepository conferences;
    @Autowired private CharacterService character;

    @Test
    void testRun_shouldPublishDailyDiscussionAndConsumeOnce_whenInputsReady() {
        var owner=users.createUser().getId();
        character.overview(owner);
        var day=LocalDate.now();
        var observation=data.observation(owner);
        observation.setDay(day.minusDays(1)); observations.saveAndFlush(observation);
        runs.record(owner,"NIGHTLY",day.minusDays(1),1,1,List.of(),List.of("drill"),null);
        council.run(owner,day);
        var status=processing.status(owner,day);
        assertThat(status.getStatus().getValue()).isEqualTo("COMPLETED");
        var conf=conferences.findByIdAndCreatedBy(status.getConferenceId(),owner).orElseThrow();
        assertThat(conf.getKind()).isEqualTo("DAILY");
        assertThat(conf.getDeliberation().threads()).isNotEmpty();
        assertThat(observations.findById(observation.getId()).orElseThrow().getConsumedByConferenceId()).isEqualTo(conf.getId());
        council.run(owner,day);
        assertThat(conferences.findByCreatedByOrderByGeneratedAtDesc(owner)).hasSize(1);
        assertThat(character.feed(owner,30)).anyMatch(item -> "CONFERENCE_ITEM".equals(item.getSourceType().getValue()));
    }
    @Test
    void testRun_shouldRecoverUnconsumedEvidence_whenOlderThanEditionCatchupWindow() {
        var owner = users.createUser().getId();
        character.overview(owner);
        var day = LocalDate.now();
        var observation = data.observation(owner);
        observation.setDay(day.minusDays(5));
        observations.saveAndFlush(observation);
        runs.record(owner, "NIGHTLY", day.minusDays(1), 0, 0, List.of(), List.of(), null);
        council.run(owner, day);
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("COMPLETED");
        assertThat(observations.findById(observation.getId()).orElseThrow().getConsumedByConferenceId()).isNotNull();
    }

    @Test
    void testRun_shouldFinishQuietAndConsumeCheckedInput_whenExpertsReturnValidEmptyProposals() {
        var owner = users.createUser().getId();
        character.overview(owner);
        var day = LocalDate.now();
        var observation = data.observation(owner);
        observation.setDay(day.minusDays(1));
        observation.setText("[fake-char-proposals:[]]");
        observations.saveAndFlush(observation);
        runs.record(owner, "NIGHTLY", day.minusDays(1), 1, 1, List.of(), List.of("drill"), null);
        council.run(owner, day);
        assertThat(processing.status(owner, day).getStatus().getValue()).isEqualTo("QUIET");
        assertThat(observations.findById(observation.getId()).orElseThrow().getConsumedByConferenceId()).isNotNull();
        council.run(owner, day);
        assertThat(conferences.findByCreatedByOrderByGeneratedAtDesc(owner)).hasSize(1);
    }

}
