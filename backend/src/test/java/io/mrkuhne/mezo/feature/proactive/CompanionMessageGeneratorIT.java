package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Companion-feed morning-kind generation flow over the fake LLM: the pure-code gather composes
 * the biometrics-free snapshot + facts + past summaries + numbered ref candidates; the
 * {@code [fake-feed-morning:{…}]} sentinel (planted via a check-in note, the {@code
 * [fake-briefing:…]} trick) scripts the strict-JSON answer; no summaries in the window or a
 * broken answer produce NO row (honest absence).
 */
@Transactional
@ActiveProfiles("companion-fake")
class CompanionMessageGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGenerateMorning_shouldPersistEnvelope_whenNarrativeWindowHasSummaries() {
        UUID user = userPopulator.createUser("morning-gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        // the check-in note rides into the snapshot's [Regeneráció] block -> the fake sees it
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[0]}]");

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_MORNING);
        assertThat(message.getContent().eyebrow()).isEqualTo("Jó reggelt");
        assertThat(message.getContent().body()).containsExactly("Mai terv.");
        assertThat(message.getContent().refs()).extracting("kind").containsExactly("Goal");
        assertThat(message.getContent().refs()).extracting("label").containsExactly("cél");
        assertThat(message.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerateMorning_shouldReturnNull_whenNoSummariesInWindow() {
        UUID user = userPopulator.createUser("morning-empty@test.local").getId();

        assertThat(companionMessageGenerator.generateMorning(user, DAY)).isNull();
        assertThat(companionMessageRepository.count()).isZero();
    }

    @Test
    void testGenerateMorning_shouldReturnExistingRow_whenCalledTwice() {
        UUID user = userPopulator.createUser("morning-idem@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap úszás volt.");
        checkInPopulator.createCheckIn(user, DAY, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[]}]");

        CompanionMessageEntity first = companionMessageGenerator.generateMorning(user, DAY);
        CompanionMessageEntity second = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(companionMessageRepository.count()).isEqualTo(1);
    }
}
