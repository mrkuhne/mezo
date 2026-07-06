package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.service.BriefingGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * B1.1 generation flow over the fake LLM: the pure-code gather composes snapshot + facts +
 * past summaries + numbered ref candidates; the [fake-briefing:{…}] sentinel (planted via a
 * check-in note, the [fake-summary:…] trick) scripts the strict-JSON answer; broken JSON or an
 * empty summary window produce NO row (honest absence).
 */
@Transactional
@ActiveProfiles("companion-fake")
class BriefingGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private BriefingGenerator briefingGenerator;
    @Autowired private BriefingRepository briefingRepository;
    @Autowired private BriefingPopulator briefingPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGather_shouldComposeSnapshotFactsSummariesAndCandidates_whenDataExists() {
        UUID user = userPopulator.createUser("gather@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap kemény leg-day volt.");
        knowledgeFactPopulator.fact(user, "Laktózérzékeny", "health", 1);

        BriefingGenerator.BriefingGather gather = briefingGenerator.gather(user, DAY);

        assertThat(gather).isNotNull();
        assertThat(gather.payload())
                .contains("AKTUÁLIS ÁLLAPOT")                      // V0.3 snapshot block
                .contains("Laktózérzékeny")                        // V1.1 facts block
                .contains("Tegnap kemény leg-day volt.")           // past narrative
                .contains("HIVATKOZÁS-JELÖLTEK");                  // numbered candidates
        // 6 static snapshot candidates + 1 per included summary
        assertThat(gather.candidates()).hasSize(7);
        assertThat(gather.candidates().get(6).kind()).isEqualTo("Memory");
        assertThat(gather.candidates().get(6).label()).isEqualTo(DAY.minusDays(1).toString());
    }

    @Test
    void testGather_shouldReturnNull_whenNoSummariesInWindow() {
        UUID user = userPopulator.createUser("gather-empty@test.local").getId();

        assertThat(briefingGenerator.gather(user, DAY)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedEnvelope_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        // the check-in note rides into the snapshot's [Regeneráció] block -> the fake sees it
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-briefing:{\"eyebrow\":\"Reta nap 3\",\"body\":[\"Jó reggelt!\"],\"refIndexes\":[5,6]}]");

        BriefingEntity briefing = briefingGenerator.generate(user, DAY);

        assertThat(briefing).isNotNull();
        assertThat(briefing.getContent().eyebrow()).isEqualTo("Reta nap 3");
        assertThat(briefing.getContent().body()).containsExactly("Jó reggelt!");
        assertThat(briefing.getContent().refs()).extracting("kind")
                .containsExactly("Sleep", "Memory");               // candidates #5 and #6
        assertThat(briefing.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerate_shouldReturnExistingWithoutLlmCall_whenRowAlreadyExists() {
        UUID user = userPopulator.createUser("gen-idem@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap úszás volt.");
        BriefingEntity existing = briefingPopulator.briefing(user, DAY);

        BriefingEntity second = briefingGenerator.generate(user, DAY);

        assertThat(second.getId()).isEqualTo(existing.getId());
        assertThat(briefingRepository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerIsNotParseableJson() {
        UUID user = userPopulator.createUser("gen-broken@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap futás volt.");
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-briefing:{\"eyebrow\":}]");   // invalid JSON

        assertThat(briefingGenerator.generate(user, DAY)).isNull();
        assertThat(briefingRepository.count()).isZero();
    }

    @Test
    void testGenerate_shouldDropOutOfRangeRefIndexes_whenModelHallucinatesThem() {
        UUID user = userPopulator.createUser("gen-refs@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap edzés volt.");
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-briefing:{\"eyebrow\":\"x\",\"body\":[\"y\"],\"refIndexes\":[0,99,-1,0]}]");

        BriefingEntity briefing = briefingGenerator.generate(user, DAY);

        // 99 and -1 dropped, duplicate 0 deduped -> exactly candidate #0
        assertThat(briefing.getContent().refs()).extracting("kind").containsExactly("WeightTrend");
    }
}
