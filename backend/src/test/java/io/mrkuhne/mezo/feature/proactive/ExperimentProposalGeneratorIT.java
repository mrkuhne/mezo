package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.service.ExperimentProposalGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@code [fake-experiment:{…}]} sentinel rides a check-in note — the proposal gather renders
 * the V0.3 snapshot, so the check-in channel IS in the payload.
 */
@Transactional
@ActiveProfiles("companion-fake")
class ExperimentProposalGeneratorIT extends AbstractIntegrationTest {

    @Autowired
    private ExperimentProposalGenerator generator;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private PatternPopulator patternPopulator;

    @Autowired
    private CheckInPopulator checkInPopulator;

    @Autowired
    private ExperimentPopulator experimentPopulator;

    @Test
    void testGather_shouldComposeSnapshotCandidatesAndCatalog_whenConfirmedPatternExists() {
        UUID user = userPopulator.createUser("epg-gather@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        ExperimentProposalGenerator.Gather gather = generator.gather(user);
        assertThat(gather).isNotNull();
        assertThat(gather.payload())
                .contains("AKTUÁLIS ÁLLAPOT")
                .contains("MINTA-JELÖLTEK")
                .contains("METRIKA-KATALÓGUS: weight_trend | sleep_avg | training_volume")
                .contains("IRÁNYOK: up | down | stable");
        assertThat(gather.candidates()).hasSize(1);
    }

    @Test
    void testGather_shouldReturnNull_whenNoConfirmedPattern() {
        UUID user = userPopulator.createUser("epg-empty@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_PROPOSED);
        assertThat(generator.gather(user)).isNull();
    }

    @Test
    void testPropose_shouldPersistScriptedProposal_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("epg-gen@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-experiment:{\"experiments\":[{\"title\":\"Esti mag\",\"hypothesis\":\"Korábbi mag.\","
                        + "\"patternIndex\":0,\"metricKey\":\"sleep_avg\","
                        + "\"expectedDirection\":\"up\",\"totalDays\":90}]}]");
        List<ExperimentEntity> saved = generator.propose(user);
        assertThat(saved).hasSize(1);
        ExperimentEntity e = saved.getFirst();
        assertThat(e.getTitle()).isEqualTo("Esti mag");
        assertThat(e.getStatus()).isEqualTo(ExperimentEntity.STATUS_PROPOSED);
        assertThat(e.getMetricKey()).isEqualTo(PredictionEntity.METRIC_SLEEP_AVG);
        assertThat(e.getTotalDays()).isEqualTo(28);   // clamped from 90 to max-days
        assertThat(e.getStartDate()).isNull();
    }

    @Test
    void testPropose_shouldBeNoOp_whenOpenCapReached() {
        UUID user = userPopulator.createUser("epg-cap@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        // fill the open cap (max-open=3) with active experiments
        for (int i = 0; i < 3; i++) {
            experimentPopulator.experiment(user, ExperimentEntity.STATUS_ACTIVE,
                    PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);
        }
        assertThat(generator.propose(user)).isEmpty();
    }

    @Test
    void testPropose_shouldReturnEmpty_whenAnswerUnparseable() {
        UUID user = userPopulator.createUser("epg-bad@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-experiment:{not valid json}]");
        assertThat(generator.propose(user)).isEmpty();
    }
}
