package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.proactive.service.FeatureAbandonmentDetector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §(17)): a feature family that was GENUINELY used before
 * (≥ minPriorRows rows) but has nothing new inside the idle window. An empty table means "never
 * used", which is not abandonment — that case stays silent, by its own test.
 */
class FeatureAbandonmentDetectorIT extends AbstractIntegrationTest {

    private static final Instant LONG_AGO = Instant.now().minus(120, ChronoUnit.DAYS);

    @Autowired private FeatureAbandonmentDetector detector;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;
    @Autowired private CreatedAtBackdater createdAtBackdater;
    @Autowired private UserPopulator userPopulator;

    /** 10 old journal entries and nothing since ⇒ the mind family is abandoned. */
    @Test
    void testDetect_shouldFire_whenTheMindFamilyWasUsedAndThenWentQuiet() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 10);

        var verdict = detector.detect(owner);

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().family()).isEqualTo(FeatureAbandonmentDetector.FAMILY_MIND);
        assertThat(verdict.orElseThrow().priorRows()).isEqualTo(10L);
        assertThat(verdict.orElseThrow().idleDays()).isEqualTo(30);
    }

    /** The honesty gate: never used is not abandoned. */
    @Test
    void testDetect_shouldStaySilent_whenTheFamilyWasNeverReallyUsed() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 3); // < minPriorRows

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** One fresh row anywhere in the family keeps the whole family alive. */
    @Test
    void testDetect_shouldStaySilent_whenSomethingInTheFamilyIsStillFresh() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 10);
        habitPopulator.row(owner, LocalDate.now(), "water", HabitDayEntity.STATUS_DONE);

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** The habit trap: {@code pending} rows are the APP's writes, so they are neither prior USE nor
     *  freshness — ten of them created today must not revive an abandoned family. */
    @Test
    void testDetect_shouldIgnorePendingHabitRows() {
        UUID owner = userPopulator.createUser().getId();
        seedJournal(owner, 10);
        for (int i = 0; i < 10; i++) {
            habitPopulator.row(owner, LocalDate.now().minusDays(i), "water",
                HabitDayEntity.STATUS_PENDING);
        }

        assertThat(detector.detect(owner))
            .hasValueSatisfying(v -> assertThat(v.family())
                .isEqualTo(FeatureAbandonmentDetector.FAMILY_MIND));
    }

    /** Mind is checked first; with mind alive, an abandoned chat is still found. */
    @Test
    void testDetect_shouldFindTheChatFamily_whenOnlyItWentQuiet() {
        UUID owner = userPopulator.createUser().getId();
        journalPopulator.createEntry(owner, LocalDate.now(), "ma is írtam", "quickinput");
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        for (int i = 0; i < 10; i++) {
            aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "kérdés " + i);
        }
        createdAtBackdater.backdateAll("ai_message", owner, LONG_AGO);

        var verdict = detector.detect(owner);

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().family()).isEqualTo(FeatureAbandonmentDetector.FAMILY_CHAT);
    }

    /** The assistant's own replies are not the user using the chat. */
    @Test
    void testDetect_shouldIgnoreAssistantMessages_forTheChatFamily() {
        UUID owner = userPopulator.createUser().getId();
        journalPopulator.createEntry(owner, LocalDate.now(), "ma is írtam", "quickinput");
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        for (int i = 0; i < 10; i++) {
            aiMessagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "válasz " + i);
        }
        createdAtBackdater.backdateAll("ai_message", owner, LONG_AGO);

        assertThat(detector.detect(owner)).isEmpty();
    }

    private void seedJournal(UUID owner, int rows) {
        for (int i = 0; i < rows; i++) {
            journalPopulator.createEntry(owner, LocalDate.now().minusDays(40L + i), "régi " + i,
                "quickinput");
        }
        createdAtBackdater.backdateAll("journal_entry", owner, LONG_AGO);
    }
}
