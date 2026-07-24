package io.mrkuhne.mezo.feature.gamification.config;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Gamification ledger tuning (mezo.gamification, bd mezo-huzd): title-shop saver price/cap, and
 * the coin awards the {@code AccountProgressPort} adapter fires (level-up, quest completion,
 * all-3-quests-done bonus, streak-day milestones).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.gamification")
public record GamificationProperties(
    @Positive int saverPrice,       // 200 — coin cost of one streak saver
    @Positive int maxSavers,        // 2 — max streak savers a profile may bank
    @Positive int levelUpCoins,     // 50 — coins awarded on every account level-up
    @Positive int questCoins,       // 10 — coins awarded per completed daily quest
    @Positive int all3Coins,        // 20 — bonus coins when all 3 daily quests are done
    @NotEmpty Map<Integer, @Positive Integer> milestoneCoins // streak-day -> bonus coins {7:50,30:150,100:500}
) {}
