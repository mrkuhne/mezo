package io.mrkuhne.mezo.feature.gamification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import io.mrkuhne.mezo.feature.gamification.service.GamificationService;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * GamificationAccountAdapter streak rollover (bd mezo-huzd, behavior contract clause 3): bump,
 * saver-bridged gap, unsaved reset, the streak_7 milestone, and the honest streakAlive projection
 * (clause 1) on a fresh day. Awards are applied strictly oldest-to-newest per occurredOn, as the
 * rollover logic processes transitions from the profile's current lastStreakDate as they arrive.
 * NOT @Transactional: committed multi-transaction replay scenarios (gap bridging with saver,
 * rollover on different days) require real transaction boundaries between test methods.
 */
class GamificationStreakIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private GamificationService gamificationService;
    @Autowired private CoinEventRepository coinEventRepository;
    @Autowired private GamificationProfileRepository gamificationProfileRepository;
    @Autowired private GamificationPopulator gamificationPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() {
        return userPopulator.createUser(UUID.randomUUID() + "@test.hu").getId();
    }

    private void applyHabit(UUID owner, LocalDate date) {
        // small XP so no account-level crossing muddies the coin/streak assertions below
        progressionService.applyHabit(owner, new HabitSignal(UUID.randomUUID(), "mindset", 5, "Napi szokás", date));
    }

    @Test
    void testStreak_shouldBumpToTwoAndStayAlive_whenConsecutiveDays() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        applyHabit(owner, today.minusDays(1));
        applyHabit(owner, today);

        var profile = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        assertThat(profile.getStreakDays()).isEqualTo(2);
        assertThat(profile.getLastStreakDate()).isEqualTo(today);
    }

    @Test
    void testStreak_shouldConsumeSaverAndContinue_whenOneDayGapWithHeldSaver() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        applyHabit(owner, today.minusDays(2)); // bootstrap: streakDays=1, lastStreakDate=D-2

        var seeded = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        seeded.setStreakSavers(1); // bank one saver directly — no ProgressionService path mints this
        gamificationProfileRepository.save(seeded);

        applyHabit(owner, today); // gap of 2 (one missed day) with a saver held -> bridged, streak continues

        var profile = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        assertThat(profile.getStreakDays()).isEqualTo(2);
        assertThat(profile.getStreakSavers()).isZero();
        assertThat(coinEventRepository
            .existsByCreatedByAndReasonAndSourceRefId(owner, "saver_used", "saver-" + today)).isTrue();
    }

    @Test
    void testStreak_shouldResetToOne_whenOneDayGapWithoutSaver() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        applyHabit(owner, today.minusDays(2)); // bootstrap: streakDays=1, lastStreakDate=D-2, no saver banked

        applyHabit(owner, today); // gap of 2, no saver -> reset

        var profile = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        assertThat(profile.getStreakDays()).isEqualTo(1);
        assertThat(profile.getLastStreakDate()).isEqualTo(today);
        assertThat(coinEventRepository
            .existsByCreatedByAndReasonAndSourceRefId(owner, "saver_used", "saver-" + today)).isFalse();
    }

    @Test
    void testStreak_shouldAwardStreak7BonusExactlyOnce_whenSevenConsecutiveDates() {
        UUID owner = owner();
        LocalDate start = LocalDate.now().minusDays(6);
        for (int i = 0; i < 7; i++) {
            applyHabit(owner, start.plusDays(i));
        }

        var profile = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        assertThat(profile.getStreakDays()).isEqualTo(7);
        assertThat(profile.getCoins()).isEqualTo(50); // only the streak_7 milestone (35 XP total stays well under Lv1->2)

        long streak7Rows = coinEventRepository
            .findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now())
            .stream().filter(e -> "streak_7".equals(e.getReason())).count();
        assertThat(streak7Rows).isEqualTo(1);
        assertThat(coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now())
            .stream().filter(e -> "streak_7".equals(e.getReason())).mapToInt(CoinEventEntity::getAmount).sum())
            .isEqualTo(50);
    }

    @Test
    void testGetProfile_shouldShowStreakAliveWithPreservedCount_whenLastAwardWasYesterday() {
        UUID owner = owner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        applyHabit(owner, yesterday.minusDays(1));
        applyHabit(owner, yesterday); // last award = yesterday, streakDays=2

        // read "on a fresh day" (today), before any award happens today
        var res = gamificationService.getProfile(owner);

        assertThat(res.getStreakAlive()).isTrue();
        assertThat(res.getStreakDays()).isEqualTo(2);
    }

    @Test
    void testGetProfile_shouldShowStreakDaysButDeadFlame_whenLastAwardIsAnOlderGap() {
        UUID owner = owner();
        gamificationPopulator.profile(owner, 0, 3, 0, LocalDate.now().minusDays(5)); // stale streak

        var res = gamificationService.getProfile(owner);

        assertThat(res.getStreakDays()).isEqualTo(3); // count preserved as stored...
        assertThat(res.getStreakAlive()).isFalse();    // ...but the flame is dead (FE dims it)
    }
}
