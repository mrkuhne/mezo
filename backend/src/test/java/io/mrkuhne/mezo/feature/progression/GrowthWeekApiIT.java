package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/progression/growth-week — quests + LIFE XP + activities + savings per ISO week. */
class GrowthWeekApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private ProgressionService progressionService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetGrowthWeek_shouldAggregateWeek_whenDataInWindow() {
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        UUID owner = ownerId();
        // quests: 1 completed + 1 expired in-week, 1 completed BEFORE the week (excluded)
        questPopulator.quest(owner, monday, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new java.math.BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, monday.plusDays(1), DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_EXPIRED);
        questPopulator.quest(owner, monday.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep", "recovery",
            "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_COMPLETED);
        // LIFE XP: a real award this week (occurredAt = now → in the current week)
        progressionService.applyActivity(owner, new ActivitySignal(UUID.randomUUID(), "learning", 15, "Teszt"));
        // activities: 1 financial + 1 plain, both in-week
        activityPopulator.financialActivity(owner, monday, "Spórolás", 50000L);
        activityPopulator.activity(owner, monday.plusDays(1), "Olvastam", "learning", 15,
            io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity.BY_AI);

        GrowthWeekResponse res = getForBody("/api/progression/growth-week/" + monday.plusDays(2),
            ownerAuthHeaders(), HttpStatus.OK, GrowthWeekResponse.class);

        assertThat(res.getWeekStart()).isEqualTo(monday);
        assertThat(res.getQuestCompleted()).isEqualTo(1);
        assertThat(res.getQuestClosed()).isEqualTo(2);
        assertThat(res.getLifeXp()).isEqualTo(15L);
        assertThat(res.getActivities()).isEqualTo(2);
        assertThat(res.getSavingsHuf()).isEqualTo(50000L);
    }

    @Test
    void testGetGrowthWeek_shouldReturnZeros_whenNothingHappened() {
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);

        GrowthWeekResponse res = getForBody("/api/progression/growth-week/" + monday,
            ownerAuthHeaders(), HttpStatus.OK, GrowthWeekResponse.class);

        assertThat(res.getQuestClosed()).isZero();
        assertThat(res.getLifeXp()).isZero();
        assertThat(res.getActivities()).isZero();
        assertThat(res.getSavingsHuf()).isZero();
    }
}
