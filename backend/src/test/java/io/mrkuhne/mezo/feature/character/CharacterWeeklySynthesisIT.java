package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterConferenceService;
import io.mrkuhne.mezo.feature.character.service.KonziliumProposalRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class CharacterWeeklySynthesisIT extends AbstractIntegrationTest {
    @Autowired private CharacterConferenceService weekly;
    @Autowired private CharacterReplyPopulator data;
    @Autowired private DatabasePopulator users;
    @Autowired private CharacterConferenceRepository conferences;
    @Autowired private CharacterClaimRepository claims;
    @Autowired private KonziliumProposalRound proposals;
    @Autowired private FakeCompanionLlm model;

    @Test
    void testWeekly_shouldReadDailyDiscussionWithoutRecreatingClaim_whenObservationsAlreadyConsumed() {
        var owner = users.populateUser("weekly-synthesis@test.local");
        var claim = data.claim(owner);
        claim.setText("Fake javaslat."); claims.saveAndFlush(claim);
        var monday = LocalDate.of(2026, 9, 14);
        var daily = data.conference(owner, claim);
        daily.setKind("DAILY"); daily.setWeekStart(monday.plusDays(1));
        daily.setDeliberation(new ConferenceDeliberationEnvelope(List.of(
                new ConferenceDeliberationEnvelope.Thread("discipline", "Fegyelem", List.of(
                        new ConferenceDeliberationEnvelope.Item(0, "drill", claim.getText(), "NEW", null,
                                false, List.of(), null, null))))));
        conferences.saveAndFlush(daily);
        int promptsBefore = model.userMessages().size();
        var result = weekly.runWeekly(owner, monday);
        assertThat(result).isNotNull();
        assertThat(model.userMessages().subList(promptsBefore, model.userMessages().size()))
                .anySatisfy(prompt -> assertThat(prompt).contains("Korábbi napi beszélgetés", daily.getId().toString()));
        assertThat(claims.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).hasSize(1);
    }

    @Test
    void testDailyProposal_shouldLabelActualObservationDate_whenEditionIsNextMorning() {
        var owner = users.populateUser("daily-period@test.local");
        var observation = data.observation(owner);
        var edition = observation.getDay().plusDays(1);
        proposals.runDaily(owner, edition, List.of(observation));
        assertThat(model.lastUserMessage()).contains("Napi kiadás: " + edition,
                "megfigyelések eseményideje: " + observation.getDay() + " – " + observation.getDay())
                .doesNotContain("Hét: " + observation.getDay());
    }
}
