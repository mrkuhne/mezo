package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class NeedsPopulator {

    private final NeedsDayRepository needsDayRepository;

    public NeedsDayEntity needsDay(UUID owner, LocalDate date, int[] rings, int greenCount, boolean allGreen,
            int xp, int streak) {
        NeedsDayEntity e = new NeedsDayEntity();
        e.setCreatedBy(owner);
        e.setNeedsDate(date);
        e.setEnergia(rings[0]);
        e.setHidratacio(rings[1]);
        e.setPihenes(rings[2]);
        e.setMozgas(rings[3]);
        e.setLelek(rings[4]);
        e.setRend(rings[5]);
        e.setGreenCount(greenCount);
        e.setAllGreen(allGreen);
        e.setXpAwarded(xp);
        e.setStreakDays(streak);
        return needsDayRepository.saveAndFlush(e);
    }
}
