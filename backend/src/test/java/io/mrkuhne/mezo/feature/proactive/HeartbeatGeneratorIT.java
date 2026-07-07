package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.service.HeartbeatGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
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
 * The {@code [fake-heartbeat:…]} sentinel rides a check-in note — the heartbeat gather renders
 * the snapshot (like briefing/weekly), so the check-in channel IS in the payload.
 */
@Transactional
@ActiveProfiles("companion-fake")
class HeartbeatGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now();

    @Autowired
    private HeartbeatGenerator generator;

    @Autowired
    private HeartbeatNoteRepository repository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private DailySummaryPopulator dailySummaryPopulator;

    @Autowired
    private CheckInPopulator checkInPopulator;

    @Autowired
    private BriefingPopulator briefingPopulator;

    @Test
    void testGather_shouldComposeSnapshotSummaryAndWindow_whenMemoryExists() {
        UUID user = userPopulator.createUser("hbg-gather@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnapi nap összefoglaló.");
        briefingPopulator.briefing(user, DAY);
        String payload = generator.gather(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        assertThat(payload)
                .contains("AKTUÁLIS ÁLLAPOT")
                .contains("Tegnapi nap összefoglaló.")
                .contains("MAI BRIEFING (ne ismételd):")
                .contains("ABLAK: dél (nudge)");
    }

    @Test
    void testGather_shouldReturnNull_whenNoNarrativeMemory() {
        UUID user = userPopulator.createUser("hbg-empty@test.local").getId();
        assertThat(generator.gather(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedNote_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("hbg-gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1));
        checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2,
                "[fake-heartbeat:Szép délutáni tempó, tartsd a vizet.]");
        HeartbeatNoteEntity note = generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_EVENING);
        assertThat(note).isNotNull();
        assertThat(note.getContent()).isEqualTo("Szép délutáni tempó, tartsd a vizet.");
        assertThat(note.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_CLOSING);
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, DAY, HeartbeatNoteEntity.WINDOW_EVENING)).isPresent();
    }

    @Test
    void testGenerate_shouldReturnExistingRow_whenNoteAlreadyExists() {
        UUID user = userPopulator.createUser("hbg-idem@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1));
        HeartbeatNoteEntity first = generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        HeartbeatNoteEntity second = generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerBlank() {
        UUID user = userPopulator.createUser("hbg-blank@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1));
        checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2, "[fake-heartbeat:]");
        assertThat(generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY)).isNull();
    }
}
