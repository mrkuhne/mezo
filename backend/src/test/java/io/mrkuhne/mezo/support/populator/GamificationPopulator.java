package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import io.mrkuhne.mezo.feature.gamification.entity.GamificationProfileEntity;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class GamificationPopulator {

    private final GamificationProfileRepository gamificationProfileRepository;
    private final CoinEventRepository coinEventRepository;

    public GamificationProfileEntity profile(UUID owner, int coins, int streakDays, int savers,
        LocalDate lastStreakDate) {
        GamificationProfileEntity e = new GamificationProfileEntity();
        e.setCreatedBy(owner);
        e.setCoins(coins);
        e.setStreakDays(streakDays);
        e.setStreakSavers(savers);
        e.setLastStreakDate(lastStreakDate);
        return gamificationProfileRepository.saveAndFlush(e);
    }

    public CoinEventEntity coinEvent(UUID owner, String reason, int amount, String sourceRefId,
        LocalDate occurredOn) {
        CoinEventEntity e = new CoinEventEntity();
        e.setCreatedBy(owner);
        e.setReason(reason);
        e.setAmount(amount);
        e.setSourceRefId(sourceRefId);
        e.setOccurredOn(occurredOn);
        return coinEventRepository.saveAndFlush(e);
    }
}
