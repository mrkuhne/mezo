package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterFollowupService;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CharacterFollowupIT extends ApiIntegrationTest {
    @Autowired private CharacterFollowupService followups;
    @Autowired private CharacterConferenceRepository conferences;
    @Autowired private CharacterReplyPopulator data;

    @Test
    void testFollowup_shouldKeepSameQuestionOpen_whenNoNewEvidenceArrives() {
        var owner = databasePopulator.populateUser("followup@test.local");
        var day = LocalDate.of(2026, 9, 21);
        var source = data.conference(owner, data.claim(owner));
        var proposal = new ClaimProposal("drill", "NEW", "discipline", null,
                "Megfigyelendő kapcsolat", new BigDecimal("0.5"), false, "Kevés adat");
        source.setFollowups(followups.create(List.of(new CharacterFollowupService.Draft(0, "HYPOTHESIS",
                "Pihenés után könnyebb?", "Két edzés és alvásnapló", day.plusDays(1))), List.of(proposal), day));
        conferences.saveAndFlush(source);
        var due = followups.due(owner, day.plusDays(1));
        assertThat(due).hasSize(1);
        assertThat(followups.due(databasePopulator.populateUser("foreign-followup@test.local"), day.plusDays(1))).isEmpty();
        followups.reschedule(owner, due, day.plusDays(1));
        var stored = conferences.findById(source.getId()).orElseThrow().getFollowups().items().getFirst();
        assertThat(stored.id()).isEqualTo(due.getFirst().item().id());
        assertThat(stored.status()).isEqualTo("WAITING");
        assertThat(stored.dueOn()).isAfter(day.plusDays(1));
        followups.closeAnswered(owner, source.getId(), 0, day.plusDays(1));
        assertThat(conferences.findById(source.getId()).orElseThrow().getFollowups().items().getFirst().status()).isEqualTo("WAITING");
    }

    @Test
    void testCreate_shouldRejectInvalidTargetsAndPastDates_whenModelSchedulesFollowup() {
        var day = LocalDate.of(2026, 9, 21);
        var proposal = new ClaimProposal("drill", "NEW", "discipline", null, "Téma", BigDecimal.ONE, false, "ok");
        assertThat(followups.create(List.of(
                new CharacterFollowupService.Draft(1, "QUESTION", "Kérdés?", "Válasz", day.plusDays(1)),
                new CharacterFollowupService.Draft(0, "QUESTION", "Kérdés?", "Válasz", day)), List.of(proposal), day).items()).isEmpty();
    }
}
