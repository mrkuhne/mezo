package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class PersonalBaselineContextIT extends AbstractIntegrationTest {
    @Autowired private ChatService chat;
    @Autowired private ChatStreamService stream;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private BiometricProfilePopulator profiles;
    @Autowired private BiometricProfileRepository profileRepository;
    @Autowired private WeightLogPopulator weights;
    @Autowired private GoalPopulator goals;
    @Autowired private GoalRepository goalRepository;

    // gear-audited: baseline is supplied independently of the user's topic.
    private SendMessageRequest request() {
        return SendMessageRequest.builder().content("Beszélgessünk az irodalomról.").build();
    }

    private String context(UUID user) {
        return chat.prepareTurn(user, conversations.conversation(user).getId(), request()).turnContext();
    }

    @Test
    void testPrepareTurn_shouldIncludeStoredBiometricsAndLatestMeasurement_whenProfileExists() {
        UUID user = users.populateUser("baseline-profile@test.local");
        var profile = profiles.create(user);
        profile.setBirthDate(LocalDate.now().minusYears(32).plusDays(1));
        profile.setHeightCm(new BigDecimal("178.25"));
        profile.setBodyFatPct(new BigDecimal("17.35"));
        profile.setActivityLevel("MIXED");
        profileRepository.saveAndFlush(profile);
        weights.createWeightLog(user, LocalDate.now().minusDays(4), new BigDecimal("84.17"));
        weights.createWeightLog(user, LocalDate.now().minusDays(1), new BigDecimal("83.26"));
        assertThat(context(user)).contains("[Személyes alapadatok]", "Életkor: 31 év", "178.25 cm",
                "Nem: férfi", "17.35%", "MIXED", "83.26 kg", LocalDate.now().minusDays(1).toString())
                .doesNotContain("84.17");
    }

    @Test
    void testPrepareTurn_shouldKeepMissingDataExplicit_whenOnlyAnotherUserHasProfileAndGoal() {
        UUID user = users.populateUser("baseline-empty@test.local");
        UUID other = users.populateUser("baseline-other@test.local");
        profiles.create(other);
        weights.createWeightLog(other, LocalDate.now(), new BigDecimal("99.91"));
        goals.createGoal(other, "bulk", "active");
        assertThat(context(user)).contains("Biometrikus profil: nincs rögzítve", "Testsúlymérés: nincs rögzítve",
                "Aktív testsúlycél: nincs").doesNotContain("99.91", "180.00", "90.00");
    }

    @Test
    void testPrepareTurn_shouldIncludeGoalDirectionAndCurrentPrescription_whenActiveGoalExists() {
        UUID user = users.populateUser("baseline-goal@test.local");
        var segment = new GoalPrescriptionJson.Segment(1, 4, "Első", 2217, 157, 245, 69,
                null, List.of(), null, null, 2350, 2100, null);
        goals.createGoalFull(user, LocalDate.now().minusDays(7), LocalDate.now().plusDays(20),
                new GoalPrescriptionJson(OffsetDateTime.now(), "formula", List.of(segment), null, null),
                null, null, null);
        assertThat(context(user)).contains("Aktív testsúlycél: fogyás (cut)", "84.20 kg", "80.00 kg",
                LocalDate.now().minusDays(7).toString(), LocalDate.now().plusDays(20).toString(),
                "2217 kcal", "157 g", "245 g", "69 g", "2350 kcal", "2100 kcal");
    }

    @Test
    void testPrepareTurn_shouldUseStoredDirectionWithoutInventingTarget_whenMaintainGoalHasNoTargetWeight() {
        UUID user = users.populateUser("baseline-maintain@test.local");
        goals.createGoal(user, "maintain", "active");
        assertThat(context(user)).contains("Aktív testsúlycél: súlytartás (recomp: testsúly tartása mellett erő- és izomgyarapodás, hízás nélkül) (maintain)", "Célsúly: nincs rögzítve")
                .doesNotContain("80.00 kg", "0 kcal");
    }

    @Test
    void testPrepareTurn_shouldIgnoreDeletedProfileAndInactiveGoals_whenDataIsNotCurrent() {
        UUID user = users.populateUser("baseline-deleted@test.local");
        profileRepository.delete(profiles.create(user));
        goals.createGoal(user, "bulk", "archived");
        var active = goals.createGoal(user, "cut", "active");
        goalRepository.delete(active);
        assertThat(context(user)).contains("Biometrikus profil: nincs rögzítve", "Aktív testsúlycél: nincs")
                .doesNotContain("90.00 kg", "80.00 kg");
    }

    @Test
    void testAnswers_shouldReceiveBaseline_whenSyncAndStreamingTurnsUseGeneralTopic() {
        UUID user = users.populateUser("baseline-answers@test.local");
        goals.createGoal(user, "bulk", "active");
        var sync = chat.sendMessage(user, conversations.conversation(user).getId(), request());
        assertThat(sync.getContent()).contains("Aktív testsúlycél: tömegelés (bulk)", "90.00 kg");
        var events = stream.streamMessage(user, conversations.conversation(user).getId(), request())
                .collectList().block(Duration.ofSeconds(30));
        assertThat(events).isNotNull();
        String answer = events.stream().filter(event -> "delta".equals(event.event()))
                .map(event -> ((StreamDelta)event.data()).getText()).collect(Collectors.joining());
        assertThat(answer).contains("Aktív testsúlycél: tömegelés (bulk)", "90.00 kg");
    }
}
