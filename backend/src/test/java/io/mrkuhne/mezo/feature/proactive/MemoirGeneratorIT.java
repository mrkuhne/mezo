package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.service.MemoirGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * W2 generation flow over the fake LLM: gather = the WEEK'S summaries [weekStart, weekStart+6]
 * + facts + patterns, with numbered anchor candidates; strict-JSON {title, body, anchorIndexes}
 * scripted via [fake-memoir:{…}] (check-in note → the note is NOT in the memoir gather, so the
 * sentinel is planted via a daily-summary NARRATIVE instead — summaries carry free text).
 */
@Transactional
@ActiveProfiles("companion-fake")
class MemoirGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    @Autowired private MemoirGenerator generator;
    @Autowired private MemoirRepository repository;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGather_shouldComposeWeekSummariesAndCandidates_whenDataExists() {
        UUID user = userPopulator.createUser("mg-gather@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Kedden kemény edzés volt.");
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Előző vasárnap — nem tartozik bele.");

        MemoirGenerator.MemoirGather gather = generator.gather(user, WEEK_START);

        assertThat(gather).isNotNull();
        assertThat(gather.payload())
                .contains("Kedden kemény edzés volt.")
                .doesNotContain("Előző vasárnap — nem tartozik bele.")
                .contains("HORGONY-JELÖLTEK");
        // one Memory candidate per included summary
        assertThat(gather.candidates()).hasSize(1);
        assertThat(gather.candidates().get(0).kind()).isEqualTo("Memory");
    }

    @Test
    void testGather_shouldReturnNull_whenWeekEmpty() {
        UUID user = userPopulator.createUser("mg-empty@test.local").getId();

        assertThat(generator.gather(user, WEEK_START)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedMemoir_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("mg-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(2),
                "[fake-memoir:{\"title\":\"A várakozás hete\",\"body\":\"Szép hét volt.\",\"anchorIndexes\":[0]}]");

        MemoirEntity memoir = generator.generate(user, WEEK_START);

        assertThat(memoir).isNotNull();
        assertThat(memoir.getTitle()).isEqualTo("A várakozás hete");
        assertThat(memoir.getBody()).isEqualTo("Szép hét volt.");
        assertThat(memoir.getAnchors().anchors()).hasSize(1);
        assertThat(memoir.getAnchors().anchors().get(0).kind()).isEqualTo("Memory");
    }

    @Test
    void testGenerate_shouldReturnExisting_whenRowAlreadyExists() {
        UUID user = userPopulator.createUser("mg-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Volt nap.");
        MemoirEntity existing = memoirPopulator.memoir(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerUnparseable() {
        UUID user = userPopulator.createUser("mg-broken@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "[fake-memoir:{\"title\":}]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }
}
