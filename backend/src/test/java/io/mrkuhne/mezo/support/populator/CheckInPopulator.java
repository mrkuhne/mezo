package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the CheckIn aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class CheckInPopulator {

    private final CheckInRepository repository;

    public CheckInEntity createCheckIn(
        UUID owner, LocalDate date, String slotTime, Integer energy, Integer stress, String note) {
        return createCheckIn(owner, date, slotTime, energy, stress, 3, 3, note);
    }

    /** Explicit body/mental értékekkel — a V3.4 metrika-extraktor IT-khez (mezo-6ha5). */
    public CheckInEntity createCheckIn(
        UUID owner, LocalDate date, String slotTime, Integer energy, Integer stress,
        Integer body, Integer mental, String note) {
        CheckInEntity e = new CheckInEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setSlotTime(slotTime);
        e.setState("done");
        e.setEnergy(energy);
        e.setStress(stress);
        e.setBody(body);
        e.setMental(mental);
        e.setNote(note);
        e.setSavedAt(Instant.now());
        return repository.saveAndFlush(e);
    }

    /**
     * Check-in 2.0 (mezo-ck2): a bare "done" row whose answers the {@code answers} customizer
     * sets — nothing else is filled, so every unset item stays NULL (not answered).
     */
    public CheckInEntity createCheckIn(UUID owner, LocalDate date, String slotTime, Consumer<CheckInEntity> answers) {
        CheckInEntity e = new CheckInEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setSlotTime(slotTime);
        e.setState("done");
        e.setSavedAt(Instant.now());
        answers.accept(e);
        return repository.saveAndFlush(e);
    }
}
