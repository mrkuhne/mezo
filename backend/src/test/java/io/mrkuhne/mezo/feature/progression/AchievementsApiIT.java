package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AchievementsResponse;
import io.mrkuhne.mezo.api.dto.BadgeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/progression/achievements — derived badges (fixed order) + perk unlocks. */
class AchievementsApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private ProgressionService progressionService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private BadgeResponse badge(AchievementsResponse res, String key) {
        return res.getBadges().stream().filter(b -> key.equals(b.getKey())).findFirst().orElseThrow();
    }

    @Test
    void testGetAchievements_shouldReturnNineZeroBadges_whenNoData() {
        AchievementsResponse res = getForBody("/api/progression/achievements",
            ownerAuthHeaders(), HttpStatus.OK, AchievementsResponse.class);

        assertThat(res.getBadges()).hasSize(9);
        assertThat(res.getBadges()).extracting(BadgeResponse::getKey).containsExactly(
            "first_quest", "quests_10", "quests_50", "first_activity", "rhythm_4w",
            "all_life_active", "life_lv5", "life_xp_10k", "savings_100k");
        assertThat(res.getBadges()).allSatisfy(b -> assertThat(b.getAchieved()).isFalse());
        assertThat(res.getPerks()).isEmpty();
    }

    @Test
    void testGetAchievements_shouldComputeQuestActivityAndSavingsBadges_whenDataSeeded() {
        UUID owner = ownerId();
        LocalDate d = LocalDate.now().minusDays(2);
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep", "recovery",
            "LIFE", "sleep_target", new BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_EXPIRED);
        activityPopulator.financialActivity(owner, d, "Spórolás", 120000L);
        // one LIFE XP grant so all_life_active counts exactly 1 of 8
        progressionService.applyActivity(owner, new ActivitySignal(UUID.randomUUID(), "learning", 15, "Teszt"));

        AchievementsResponse res = getForBody("/api/progression/achievements",
            ownerAuthHeaders(), HttpStatus.OK, AchievementsResponse.class);

        assertThat(badge(res, "first_quest").getAchieved()).isTrue();     // 1 completed (expired doesn't count)
        assertThat(badge(res, "first_quest").getCurrent()).isEqualTo(1L);
        assertThat(badge(res, "quests_10").getAchieved()).isFalse();
        assertThat(badge(res, "quests_10").getCurrent()).isEqualTo(1L);
        assertThat(badge(res, "first_activity").getAchieved()).isTrue();  // 2 entries
        assertThat(badge(res, "savings_100k").getAchieved()).isTrue();    // 120k >= 100k
        assertThat(badge(res, "savings_100k").getCurrent()).isEqualTo(120000L);
        assertThat(badge(res, "all_life_active").getCurrent()).isEqualTo(1L);
        assertThat(badge(res, "all_life_active").getAchieved()).isFalse();
        assertThat(badge(res, "life_lv5").getCurrent()).isEqualTo(1L);    // best LIFE level is 1
    }
}
