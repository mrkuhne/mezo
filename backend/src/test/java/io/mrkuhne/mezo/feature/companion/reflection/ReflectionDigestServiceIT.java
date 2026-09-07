package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionDigestService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Reflexió S4 (mezo-eq85.4) Step 6: the morning one-liner. Deterministic Hungarian sentence built
 * in CODE from what last night actually decided — no LLM anywhere in this class's dependency graph,
 * so a digest can never claim something the numbers did not say.
 *
 * <p>Every test derives both the seeded instant AND the {@code digestFor} argument from ONE local
 * {@code LocalDate.now()}, so a run that straddles midnight cannot desync the two (the S3 review
 * finding about class-load date constants).
 */
class ReflectionDigestServiceIT extends AbstractIntegrationTest {

    private static final TestPlanEnvelope PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    @Autowired private ReflectionDigestService reflectionDigestService;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testDigestFor_shouldAnnounceTheConfirmation_whenLastNightConfirmedARow() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED,
                lastNight(today));

        assertThat(reflectionDigestService.digestFor(owner, today))
                .contains("Ma éjjel megerősítettem: „" + row.getTitle() + "”. Beépítettem a tudásba.");
    }

    @Test
    void testDigestFor_shouldAnnounceTheRefutation_whenLastNightRefutedARow() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_REFUTED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_REFUTED,
                lastNight(today));

        assertThat(reflectionDigestService.digestFor(owner, today))
                .contains("Elengedtem: „" + row.getTitle() + "” — a számok nem támasztották alá.");
    }

    /** No verdict last night, but the user ASKED for this one to be watched — then the running
     *  tally is the news. */
    @Test
    void testDigestFor_shouldReportTheNightlyEvidence_whenAWatchedRowWasEvaluated() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_MONITORING);
        row.setEvidenceHits(3);
        row.setEvidenceMisses(1);
        patternPopulator.save(row);
        patternEventPopulator.userReply(owner, row.getId(), "chip", "watch", "Figyeld csak.");
        patternEventPopulator.evidence(owner, row.getId(), 0.5, 10, 0.03, "live", true,
                lastNight(today));

        assertThat(reflectionDigestService.digestFor(owner, today))
                .contains("Tegnap kérted, hogy figyeljem: „" + row.getTitle()
                        + "” — az éjjeli számítás szerint bejött (3 / 4).");
    }

    /** A row nobody answered is not "amit kértél" — it stays off the morning message. */
    @Test
    void testDigestFor_shouldBeEmpty_whenTheEvaluatedRowHasNoUserReply() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_MONITORING);
        patternEventPopulator.evidence(owner, row.getId(), 0.5, 10, 0.03, "live", true,
                lastNight(today));

        assertThat(reflectionDigestService.digestFor(owner, today)).isEmpty();
    }

    /**
     * THE regression the whole-branch review caught: the nightly {@code ReflectionJob} runs at
     * 03:40 of the REQUESTED morning, and the 05:45 morning message must report THAT run. With the
     * old {@code [date−1 03:00, date 03:00)} window the verdict landed 40 minutes past the end and
     * the digest silently described the night before while saying „Ma éjjel…". Every other case in
     * this class seeds at 23:00, which is inside both windows — which is exactly why none of them
     * could see it.
     */
    @Test
    void testDigestFor_shouldReportTonightsRun_whenTheVerdictLandedAtTheNightlyJobHour() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED,
                nightlyJobRun(today));

        assertThat(reflectionDigestService.digestFor(owner, today))
                .contains("Ma éjjel megerősítettem: „" + row.getTitle() + "”. Beépítettem a tudásba.");
    }

    /** The window is {@code [date−1 05:00, date 05:00)} — a verdict from two nights ago is old news. */
    @Test
    void testDigestFor_shouldBeEmpty_whenTheVerdictIsOlderThanTheWindow() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED,
                lastNight(today.minusDays(1)));

        assertThat(reflectionDigestService.digestFor(owner, today)).isEmpty();
    }

    /** A statistical catalog row belongs to the Pearson job and the Minták screen, never here. */
    @Test
    void testDigestFor_shouldBeEmpty_whenTheConfirmedRowIsAStatisticalCatalogRow() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.statistical(owner, "sleep~mood",
                PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.decision(owner, row.getId(), PatternEventEntity.KIND_CONFIRMED,
                lastNight(today));

        assertThat(reflectionDigestService.digestFor(owner, today)).isEmpty();
    }

    @Test
    void testDigestFor_shouldBeEmpty_whenTheNightDecidedNothing() {
        LocalDate today = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        patternPopulator.reflection(owner, PLAN, PatternEntity.STATUS_MONITORING);

        assertThat(reflectionDigestService.digestFor(owner, today)).isEmpty();
    }

    /** 23:00 of the previous evening — inside {@code [date−1 05:00, date 05:00)} whatever time of
     *  day the suite happens to run. */
    private static Instant lastNight(LocalDate date) {
        return date.minusDays(1).atTime(LocalTime.of(23, 0))
                .atZone(ZoneId.systemDefault()).toInstant();
    }

    /** 03:45 of {@code date} itself — five minutes into the nightly {@code ReflectionJob}'s 03:40
     *  run, the moment the morning message is actually meant to be about. */
    private static Instant nightlyJobRun(LocalDate date) {
        return date.atTime(LocalTime.of(3, 45)).atZone(ZoneId.systemDefault()).toInstant();
    }
}
