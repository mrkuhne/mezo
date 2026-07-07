package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.proactive.service.PredictionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@code [fake-prediction:{…}]} sentinel rides a check-in note — the prediction gather renders
 * the V0.3 snapshot (for next-week context), so the check-in channel IS in the payload.
 */
@Transactional
@ActiveProfiles("companion-fake")
class PredictionGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired
    private PredictionGenerator generator;

    @Autowired
    private PredictionRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private PatternPopulator patternPopulator;

    @Autowired
    private CheckInPopulator checkInPopulator;

    @Test
    void testGather_shouldComposeSnapshotCandidatesAndCatalog_whenConfirmedPatternExists() {
        UUID user = userPopulator.createUser("pg-gather@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        PredictionGenerator.PredictionGather gather = generator.gather(user, WEEK_START);
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
        UUID user = userPopulator.createUser("pg-empty@test.local").getId();
        // a PROPOSED pattern does NOT count — only confirmed grounds a prediction
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_PROPOSED);
        assertThat(generator.gather(user, WEEK_START)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedRows_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("pg-gen@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-prediction:{\"predictions\":[{\"title\":\"Súly csökken\",\"basis\":\"Reta.\","
                        + "\"patternIndex\":0,\"metricKey\":\"weight_trend\","
                        + "\"expectedDirection\":\"down\"}]}]");
        List<PredictionEntity> saved = generator.generate(user, WEEK_START);
        assertThat(saved).hasSize(1);
        PredictionEntity p = saved.getFirst();
        assertThat(p.getTitle()).isEqualTo("Súly csökken");
        assertThat(p.getMetricKey()).isEqualTo(PredictionEntity.METRIC_WEIGHT_TREND);
        assertThat(p.getExpectedDirection()).isEqualTo(PredictionEntity.DIRECTION_DOWN);
        assertThat(p.getConfidence()).isNull();   // COPIED from the statistical pattern (null)
        assertThat(p.getValidFrom()).isEqualTo(WEEK_START);
        assertThat(p.getValidTo()).isEqualTo(WEEK_START.plusDays(6));
        assertThat(p.getStatus()).isEqualTo(PredictionEntity.STATUS_PENDING);
    }

    @Test
    void testGenerate_shouldDropRow_whenMetricKeyInvalid() {
        UUID user = userPopulator.createUser("pg-drop@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-prediction:{\"predictions\":[{\"title\":\"Bad\",\"basis\":\"x\","
                        + "\"patternIndex\":0,\"metricKey\":\"nonsense\","
                        + "\"expectedDirection\":\"down\"}]}]");
        assertThat(generator.generate(user, WEEK_START)).isEmpty();
    }

    @Test
    void testGenerate_shouldBeIdempotent_whenWeekAlreadyHasRows() {
        UUID user = userPopulator.createUser("pg-idem@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-prediction:{\"predictions\":[{\"title\":\"T\",\"basis\":\"b\","
                        + "\"patternIndex\":0,\"metricKey\":\"sleep_avg\","
                        + "\"expectedDirection\":\"up\"}]}]");
        assertThat(generator.generate(user, WEEK_START)).hasSize(1);
        assertThat(generator.generate(user, WEEK_START)).isEmpty();   // second call: no new LLM call, no new rows
        assertThat(repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user)).hasSize(1);
    }

    @Test
    void testGenerate_shouldReturnEmpty_whenAnswerUnparseable() {
        UUID user = userPopulator.createUser("pg-bad@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);
        // matches the (brace-delimited) sentinel but is not valid JSON ⇒ parse fails ⇒ no rows
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-prediction:{not valid json}]");
        assertThat(generator.generate(user, WEEK_START)).isEmpty();
    }
}
