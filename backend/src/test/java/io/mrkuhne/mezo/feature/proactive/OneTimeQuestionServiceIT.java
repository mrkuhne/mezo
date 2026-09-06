package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §c): a question is asked ONCE, ever; never on a day that
 * already has a card; and its body reaches the user exactly as written.
 *
 * <p>{@code @ActiveProfiles("companion-fake")} follows {@code SetupCheckServiceIT} — delivery goes
 * through {@code AdviceCardService}, which resolves the prose generator even though the verbatim
 * path never calls it.
 */
@ActiveProfiles("companion-fake")
class OneTimeQuestionServiceIT extends AbstractIntegrationTest {

    @Autowired private OneTimeQuestionService oneTimeQuestionService;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private JournalEntryRepository journalEntryRepository;
    @Autowired private CreatedAtBackdater createdAtBackdater;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunFor_shouldAskTheAbandonmentQuestion_whenTheMindFamilyWentQuiet() {
        UUID owner = abandonedMindUser();

        Optional<CompanionMessageEntity> card = oneTimeQuestionService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_ADVICE);
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT);
        assertThat(card.orElseThrow().getContent().eyebrow()).isEqualTo(OneTimeQuestionService.EYEBROW);
        // Verbatim: one paragraph, the question itself, plus the two one-tap answers.
        assertThat(card.orElseThrow().getContent().body()).hasSize(1);
        assertThat(card.orElseThrow().getContent().body().get(0)).contains("tudatosan tetted félre");
        assertThat(card.orElseThrow().getContent().suggestions()).hasSize(2);
        assertThat(card.orElseThrow().getContent().facts()).isNotEmpty();
    }

    /** Once ever: a second sweep on a LATER day, with the trigger still true, says nothing. */
    @Test
    void testRunFor_shouldNeverAskTheSameQuestionTwice() {
        UUID owner = abandonedMindUser();
        assertThat(oneTimeQuestionService.runFor(owner)).isPresent();
        // Move the card off today so the day-budget gate is not what silences the second run.
        companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE)
            .ifPresent(row -> {
                row.setMessageDate(LocalDate.now().minusDays(3));
                companionMessageRepository.saveAndFlush(row);
            });

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
    }

    /** The trap this slice exists to avoid: a question card a flag SUPERSEDED is soft-deleted and
     *  invisible to every JPA read — but it was still asked, so it must never come back. */
    @Test
    void testRunFor_shouldNeverAskAgain_whenTheQuestionCardWasSuperseded() {
        UUID owner = abandonedMindUser();
        CompanionMessageEntity asked = oneTimeQuestionService.runFor(owner).orElseThrow();
        companionMessageRepository.delete(asked); // @SQLDelete → soft delete, the supersession path
        companionMessageRepository.flush();

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
    }

    /** Shared daily budget: a question never stacks with the day's advice card. */
    @Test
    void testRunFor_shouldStaySilent_whenTodayAlreadyHasAnAdviceCard() {
        UUID owner = abandonedMindUser();
        companionMessagePopulator.createAdvice(owner, LocalDate.now(), FlagKey.SLEEP_DEBT,
            "sleep_recover_tonight", "Mezo · észrevétel", "…", List.of(), List.of("…"), Instant.now());

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE).orElseThrow()
            .getContent().adviceKey()).isEqualTo(FlagKey.SLEEP_DEBT);
    }

    /** Nothing to ask about ⇒ nothing is asked (and nothing is burned). */
    @Test
    void testRunFor_shouldStaySilent_whenNoQuestionTriggers() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(oneTimeQuestionService.runFor(owner)).isEmpty();
        assertThat(companionMessageRepository.findByCreatedByAndMessageDateAndKind(
            owner, LocalDate.now(), CompanionMessageEntity.KIND_ADVICE)).isEmpty();
    }

    /** 10 journal entries, all older than the idle window, and nothing since. */
    private UUID abandonedMindUser() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 0; i < 10; i++) {
            journalPopulator.createEntry(owner, LocalDate.now().minusDays(40L + i), "régi " + i,
                "quickinput");
        }
        createdAtBackdater.backdateAll("journal_entry", owner, Instant.now().minus(120, ChronoUnit.DAYS));
        assertThat(journalEntryRepository.countByCreatedBy(owner)).isEqualTo(10L);
        return owner;
    }
}
