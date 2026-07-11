package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LevelUpEventPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Profile life[] band + computed traits (discipline 28d ratio, consistency active-week streak). */
class ProfileTraitsIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private LevelUpEventPopulator levelUpEventPopulator;
    @Autowired private UserPopulator userPopulator;

    private static LevelUpResult payload() {
        return new LevelUpResult("GYM", null, null, null, 10,
            List.of(), List.of(), List.of(), new LevelUpResult.Robustness(0, 0));
    }

    @Test
    void testGetProfile_shouldListAllEightLifeSkillsInTaxonomyOrder_whenNoRows() {
        UUID owner = userPopulator.createUser("life-a@test.hu").getId();

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getLife()).extracting(s -> s.getSkillKey())
            .containsExactly("mindfulness", "mindset", "cooking", "financial",
                "productivity", "learning", "connection", "recovery");
        assertThat(profile.getLife()).allSatisfy(s -> {
            assertThat(s.getKind()).isEqualTo("LIFE");
            assertThat(s.getLevel()).isEqualTo(1);
        });
        assertThat(profile.getTraits().getDisciplinePct()).isNull(); // no commitments in window
        assertThat(profile.getTraits().getConsistencyWeeks()).isZero();
    }

    @Test
    void testGetProfile_shouldComputeDisciplineFromQuestLedger_whenQuestsClosedInWindow() {
        UUID owner = userPopulator.createUser("life-b@test.hu").getId();
        LocalDate d = LocalDate.now().minusDays(3);
        // 3 completed + 1 expired = 75% quest ratio; no active meso → no training component
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new java.math.BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep", "recovery",
            "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(2), DailyQuestEntity.SLOT_BODY, "body_rest_sleep", "recovery",
            "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(4), DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log", "recovery",
            "LIFE", "weight_logged", null, 15, DailyQuestEntity.STATUS_EXPIRED);

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getTraits().getDisciplinePct()).isEqualTo(75);
    }

    @Test
    void testGetProfile_shouldCountConsecutiveActiveWeeks_whenFourActiveDaysPerWeek() {
        UUID owner = userPopulator.createUser("life-c@test.hu").getId();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        // previous week: 4 active days; the week before: 4 active days; current week: 1 (not counted)
        for (int w = 1; w <= 2; w++) {
            for (int i = 0; i < 4; i++) {
                LocalDate day = monday.minusWeeks(w).plusDays(i);
                levelUpEventPopulator.createEventAt(owner, "GYM", UUID.randomUUID(), payload(),
                    day.atStartOfDay(zone).toInstant().plusSeconds(3600));
            }
        }
        levelUpEventPopulator.createEventAt(owner, "GYM", UUID.randomUUID(), payload(),
            monday.atStartOfDay(zone).toInstant().plusSeconds(3600));

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getTraits().getConsistencyWeeks()).isEqualTo(2);
    }
}
