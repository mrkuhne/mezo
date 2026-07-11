package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ActivityCategoryRequest;
import io.mrkuhne.mezo.api.dto.ActivityCreateRequest;
import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.api.dto.ActivityWriteResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** /api/activity surface: create+classify+award, caps, categorize/override, quest synergy. */
@ActiveProfiles({"demodata", "companion-fake"})
class ActivityApiIT extends ApiIntegrationTest {

    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testCreateActivity_shouldClassifyAwardAndCompleteQuest_whenConfidentAndQuestMatches() {
        questPopulator.activityQuest(ownerId(), LocalDate.now(), "learning", 20,
            DailyQuestEntity.STATUS_OFFERED);
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Olvastam 30 percet [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.92,"
                + "\"xpSuggestion\":18,\"durationMin\":30,\"amountHuf\":null}]")
            .build();

        ActivityWriteResponse res = postForBody("/api/activity", req, ownerAuthHeaders(),
            HttpStatus.OK, ActivityWriteResponse.class);

        assertThat(res.getEntry().getSkillKey()).isEqualTo("learning");
        assertThat(res.getEntry().getXpAwarded()).isEqualTo(18);
        assertThat(res.getEntry().getCategorizedBy()).isEqualTo("AI");
        assertThat(res.getEntry().getDurationMin()).isEqualTo(30);
        assertThat(res.getCompletedQuest()).isNotNull();
        assertThat(res.getCompletedQuest().getStatus()).isEqualTo("completed");
        assertThat(res.getLevelUps()).hasSize(2); // activity award + quest award
        // learning row = 18 (activity) + 20 (quest)
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "learning")
            .orElseThrow().getCumulativeXp()).isEqualTo(38);
    }

    @Test
    void testCreateActivity_shouldStoreUncategorized_whenConfidenceBelowThreshold() {
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Valami homályos [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.35,"
                + "\"xpSuggestion\":12,\"durationMin\":null,\"amountHuf\":null}]")
            .build();

        ActivityWriteResponse res = postForBody("/api/activity", req, ownerAuthHeaders(),
            HttpStatus.OK, ActivityWriteResponse.class);

        assertThat(res.getEntry().getSkillKey()).isNull();
        assertThat(res.getEntry().getXpAwarded()).isZero(); // XP waits for categorization
        assertThat(res.getCompletedQuest()).isNull();
        assertThat(res.getLevelUps()).isEmpty();
    }

    @Test
    void testCreateActivity_shouldCapPerSkillXp_whenDailySkillBudgetNearlyUsed() {
        // 35 XP already awarded to learning today → cap 40 leaves 5, even though 18 suggested
        activityPopulator.activity(ownerId(), LocalDate.now(), "Korábbi olvasás", "learning", 35,
            ActivityLogEntity.BY_AI);
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Még olvasás [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.9,"
                + "\"xpSuggestion\":18,\"durationMin\":null,\"amountHuf\":null}]")
            .build();

        ActivityWriteResponse res = postForBody("/api/activity", req, ownerAuthHeaders(),
            HttpStatus.OK, ActivityWriteResponse.class);

        assertThat(res.getEntry().getXpAwarded()).isEqualTo(5);
    }

    @Test
    void testCategorizeActivity_shouldGrantStoredSuggestion_whenUncategorized() {
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Homályos [fake-activity:{\"skillKey\":null,\"confidence\":0.2,"
                + "\"xpSuggestion\":14,\"durationMin\":null,\"amountHuf\":null}]")
            .build();
        ActivityWriteResponse created = postForBody("/api/activity", req, ownerAuthHeaders(),
            HttpStatus.OK, ActivityWriteResponse.class);

        ActivityWriteResponse res = postForBody(
            "/api/activity/" + created.getEntry().getId() + "/category",
            ActivityCategoryRequest.builder().skillKey("mindset").build(),
            ownerAuthHeaders(), HttpStatus.OK, ActivityWriteResponse.class);

        assertThat(res.getEntry().getSkillKey()).isEqualTo("mindset");
        assertThat(res.getEntry().getCategorizedBy()).isEqualTo("USER");
        assertThat(res.getEntry().getXpAwarded()).isEqualTo(14);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "mindset")
            .orElseThrow().getCumulativeXp()).isEqualTo(14);
    }

    @Test
    void testCategorizeActivity_shouldMoveXp_whenOverridingAiCategory() {
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Olvastam [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.9,"
                + "\"xpSuggestion\":16,\"durationMin\":null,\"amountHuf\":null}]")
            .build();
        ActivityWriteResponse created = postForBody("/api/activity", req, ownerAuthHeaders(),
            HttpStatus.OK, ActivityWriteResponse.class);
        assertThat(created.getEntry().getXpAwarded()).isEqualTo(16);

        ActivityWriteResponse res = postForBody(
            "/api/activity/" + created.getEntry().getId() + "/category",
            ActivityCategoryRequest.builder().skillKey("productivity").build(),
            ownerAuthHeaders(), HttpStatus.OK, ActivityWriteResponse.class);

        assertThat(res.getEntry().getSkillKey()).isEqualTo("productivity");
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "learning")
            .orElseThrow().getCumulativeXp()).isZero();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "productivity")
            .orElseThrow().getCumulativeXp()).isEqualTo(16);
    }

    @Test
    void testCategorizeActivity_shouldReject_whenSkillKeyUnknown() {
        var e = activityPopulator.activity(ownerId(), LocalDate.now(), "X", null, 0, null);

        String body = exchangeForBody(HttpMethod.POST, "/api/activity/" + e.getId() + "/category",
            ActivityCategoryRequest.builder().skillKey("hacking").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "ACTIVITY_SKILL_UNKNOWN");
    }

    @Test
    void testGetActivityDay_shouldListOwnEntriesNewestFirst_whenLogged() {
        LocalDate d = LocalDate.now();
        activityPopulator.activity(ownerId(), d, "Első", "learning", 10, ActivityLogEntity.BY_AI);
        activityPopulator.activity(ownerId(), d, "Második", "mindset", 10, ActivityLogEntity.BY_USER);

        ActivityResponse[] list = getForBody("/api/activity/day/" + d, ownerAuthHeaders(),
            HttpStatus.OK, ActivityResponse[].class);

        assertThat(list).hasSize(2);
        assertThat(list[0].getText()).isEqualTo("Második");
    }
}
