package io.mrkuhne.mezo.feature.gamification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import io.mrkuhne.mezo.feature.gamification.service.GamificationAccountAdapter;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.quest.QuestSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GamificationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.IllegalTransactionStateException;

/**
 * GamificationAccountAdapter coin awards, driven through real {@link ProgressionService} XP grants
 * (bd mezo-huzd, behavior contract clause 3: quest/all3/level_up coins + the idempotency backstop).
 * NOT @Transactional: MANDATORY propagation proof (onXpAwarded refuses to join outside a tx) and
 * committed multi-transaction replay scenarios (idempotency via external checks) require real
 * transaction boundaries and rollback isolation between test methods.
 */
class GamificationCoinIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private CoinEventRepository coinEventRepository;
    @Autowired private GamificationProfileRepository gamificationProfileRepository;
    @Autowired private GamificationPopulator gamificationPopulator;
    @Autowired private GamificationAccountAdapter gamificationAccountAdapter;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() {
        return userPopulator.createUser(UUID.randomUUID() + "@test.hu").getId();
    }

    private void applyHabit(UUID owner, LocalDate date, int xp) {
        progressionService.applyHabit(owner, new HabitSignal(UUID.randomUUID(), "mindset", xp, "Napi szokás", date));
    }

    // ==== transaction-join proof ====

    @Test
    void testOnXpAwarded_shouldRequireActiveTransaction_whenCalledOutsideAnAwardTx() {
        // MANDATORY propagation: called standalone (no surrounding tx on this thread), it must
        // refuse rather than silently open its own — proof it joins the award transaction.
        assertThatThrownBy(() -> gamificationAccountAdapter.onXpAwarded(
            UUID.randomUUID(), "HABIT", UUID.randomUUID(), LocalDate.now()))
            .isInstanceOf(IllegalTransactionStateException.class);
    }

    // ==== quest coins ====

    @Test
    void testApplyQuest_shouldAwardQuestCoin_whenQuestApplied() {
        UUID owner = owner();
        UUID questId = UUID.randomUUID();
        progressionService.applyQuest(owner,
            new QuestSignal(questId, "mindset", "LIFE", 5, "Küldetés", LocalDate.now()));

        assertThat(coinEventRepository
            .existsByCreatedByAndReasonAndSourceRefId(owner, "quest", questId.toString())).isTrue();
        assertThat(gamificationProfileRepository.findByCreatedBy(owner).orElseThrow().getCoins()).isEqualTo(10);
    }

    @Test
    void testApplyQuest_shouldNotDoubleAwardCoin_whenSameQuestSignalReapplied() {
        UUID owner = owner();
        QuestSignal signal = new QuestSignal(UUID.randomUUID(), "mindset", "LIFE", 5, "Küldetés", LocalDate.now());

        progressionService.applyQuest(owner, signal);
        progressionService.applyQuest(owner, signal); // idempotent replay: award() returns early, never fires the port

        List<CoinEventEntity> rows = coinEventRepository
            .findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now());
        assertThat(rows).hasSize(1);
        assertThat(gamificationProfileRepository.findByCreatedBy(owner).orElseThrow().getCoins()).isEqualTo(10);
    }

    @Test
    void testApplyQuest_shouldAwardAll3BonusExactlyOnce_whenThreeDistinctQuestsSameDate() {
        UUID owner = owner();
        LocalDate today = LocalDate.now();
        progressionService.applyQuest(owner, new QuestSignal(UUID.randomUUID(), "mindset", "LIFE", 5, "Q1", today));
        progressionService.applyQuest(owner, new QuestSignal(UUID.randomUUID(), "cooking", "LIFE", 5, "Q2", today));
        progressionService.applyQuest(owner, new QuestSignal(UUID.randomUUID(), "financial", "LIFE", 5, "Q3", today));

        assertThat(coinEventRepository
            .existsByCreatedByAndReasonAndSourceRefId(owner, "all3", "all3-" + today)).isTrue();
        assertThat(gamificationProfileRepository.findByCreatedBy(owner).orElseThrow().getCoins())
            .isEqualTo(10 * 3 + 20); // 3× quest(+10) + all3(+20)

        // a 4th distinct quest the same day must NOT re-award the all-3 bonus
        progressionService.applyQuest(owner, new QuestSignal(UUID.randomUUID(), "learning", "LIFE", 5, "Q4", today));
        long all3Rows = coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, today)
            .stream().filter(e -> "all3".equals(e.getReason())).count();
        assertThat(all3Rows).isEqualTo(1);
    }

    // ==== account level-up coins ====

    @Test
    void testApplyHabit_shouldAwardLevelUpCoinOnceAndBumpAccountLevel_whenCrossingLevel() {
        UUID owner = owner();
        // Lv1→Lv2 costs 80 XP (AccountLevelCurve); 90 XP crosses it.
        applyHabit(owner, LocalDate.now(), 90);

        var profile = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        assertThat(profile.getAccountLevel()).isEqualTo(2);
        assertThat(coinEventRepository
            .existsByCreatedByAndReasonAndSourceRefId(owner, "level_up", "level-2")).isTrue();
        int levelUpCoins = coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now())
            .stream().filter(e -> "level_up".equals(e.getReason())).mapToInt(CoinEventEntity::getAmount).sum();
        assertThat(levelUpCoins).isEqualTo(50);

        // re-crossing check for the SAME threshold must stay idempotent (no second level-2 award)
        applyHabit(owner, LocalDate.now(), 1);
        long level2Rows = coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now())
            .stream().filter(e -> "level_up".equals(e.getReason()) && "level-2".equals(e.getSourceRefId())).count();
        assertThat(level2Rows).isEqualTo(1);
    }

    @Test
    void testApplyHabit_shouldSkipLevelUpCoinInsert_whenRefAlreadyExists() {
        UUID owner = owner();
        gamificationPopulator.profile(owner, 0, 0, 0, null); // accountLevel defaults to 1
        gamificationPopulator.coinEvent(owner, "level_up", 50, "level-2", LocalDate.now()); // pre-existing ref

        applyHabit(owner, LocalDate.now(), 90); // crosses Lv1->Lv2

        var profile = gamificationProfileRepository.findByCreatedBy(owner).orElseThrow();
        assertThat(profile.getAccountLevel()).isEqualTo(2); // the level is still stored...
        assertThat(profile.getCoins()).isZero(); // ...but the guarded insert was skipped -> no coins added
        long level2Rows = coinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(owner, LocalDate.now())
            .stream().filter(e -> "level_up".equals(e.getReason()) && "level-2".equals(e.getSourceRefId())).count();
        assertThat(level2Rows).isEqualTo(1); // no duplicate row inserted
    }
}
