package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the CheckIn aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class CheckInPopulator {

    private final CheckInRepository repository;

    public CheckInEntity createCheckIn(
        UUID owner, LocalDate date, String slotTime, Integer energy, Integer stress, String note) {
        CheckInEntity e = new CheckInEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setSlotTime(slotTime);
        e.setState("ok");
        e.setEnergy(energy);
        e.setStress(stress);
        e.setBody(3);
        e.setMental(3);
        e.setNote(note);
        e.setSavedAt(Instant.now());
        return repository.saveAndFlush(e);
    }
}
