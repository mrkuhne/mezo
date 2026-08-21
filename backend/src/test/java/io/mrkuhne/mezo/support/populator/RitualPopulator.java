package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class RitualPopulator {

    private final RitualDayRepository ritualDayRepository;

    public RitualDayEntity closedDay(UUID owner, LocalDate date) {
        RitualDayEntity e = new RitualDayEntity();
        e.setCreatedBy(owner);
        e.setRitualDate(date);
        e.setClosedAt(Instant.now());
        return ritualDayRepository.saveAndFlush(e);
    }

    /** An OPEN ritual_day row — the reflection-before-close shape (mezo-b3pp.2): no closed_at. */
    public RitualDayEntity openDay(UUID owner, LocalDate date, String reflectionText) {
        RitualDayEntity e = new RitualDayEntity();
        e.setCreatedBy(owner);
        e.setRitualDate(date);
        e.setReflectionText(reflectionText);
        return ritualDayRepository.saveAndFlush(e);
    }
}
