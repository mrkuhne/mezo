package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * mezo-06o0.13: az edzés- és sport-jegyzet név-matche. A {@link NoteMentionCatchUp} ikertestvére
 * arra a két forrásra, ami szándékosan nem került fel a {@code NarrativeNoteSource} portra — a
 * sweep osztály-javadocja mondja el, miért.
 */
class TrainingNoteMentionSweepIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 21);

    @Autowired private TrainingNoteMentionSweep sweep;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private SportSessionRepository sportSessionRepository;

    @Test
    void testRun_shouldWriteMentionFromWorkoutNote_whenPersonNameMatches() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity adam = personPopulator.createPerson(owner, "Ádám");
        WorkoutSessionEntity workout = workout(owner, "Adammal toltuk a mellet, jól ment.", null);

        assertThat(sweep.run(owner, DAY)).isEqualTo(1);

        List<MentionEntity> mentions = mentionRepository.findAll();
        assertThat(mentions).singleElement().satisfies(m -> {
            assertThat(m.getPersonId()).isEqualTo(adam.getId());
            assertThat(m.getSourceRefKind()).isEqualTo(TrainingNoteMentionSweep.WORKOUT_NOTE);
            assertThat(m.getSourceRefId()).isEqualTo(workout.getId());
            assertThat(m.getExcerpt()).contains("Adammal toltuk a mellet");
            // The nightly LLM round fills tone/intensity later — the deterministic path never guesses.
            assertThat(m.getTone()).isNull();
        });
    }

    @Test
    void testRun_shouldReadBothWorkoutNoteFields_asOneRowUnderOneRef() {
        // A workout carries TWO free-text fields but is ONE row, and the dedup key is
        // (createdBy, personId, sourceRefKind, sourceRefId) — so the two fields MUST travel as one
        // text. Split into two detect calls, the closing note's match would collide with the
        // note's on that same key and be silently dropped: Réka, named only in the closing note,
        // would never get a mention at all.
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Ádám");
        PersonEntity reka = personPopulator.createPerson(owner, "Réka");
        workout(owner, "Adammal toltuk a mellet.", "Rékának is szólok legközelebb.");

        assertThat(sweep.run(owner, DAY)).isEqualTo(2);

        assertThat(mentionRepository.findAll()).extracting(MentionEntity::getPersonId)
            .contains(reka.getId());
    }

    @Test
    void testRun_shouldWriteMentionFromSportNote_underItsOwnSourceRefKind() {
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Nóri");
        SportSessionEntity sport = trainPopulator.createSportSession(owner, DAY);
        sport.setNotes("Nórival röpiztünk, jó meccs volt.");
        sportSessionRepository.saveAndFlush(sport);

        assertThat(sweep.run(owner, DAY)).isEqualTo(1);

        assertThat(mentionRepository.findAll()).singleElement().satisfies(m -> {
            assertThat(m.getSourceRefKind()).isEqualTo(TrainingNoteMentionSweep.SPORT_NOTE);
            assertThat(m.getSourceRefId()).isEqualTo(sport.getId());
        });
    }

    @Test
    void testRun_shouldBeIdempotent_whenTheSameDayIsSweptTwice() {
        // The sweep has no "already processed" state of its own — re-running a night must not
        // duplicate, and the only thing standing between it and duplicates is the mention dedup.
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Ádám");
        workout(owner, "Adammal toltuk a mellet.", null);

        assertThat(sweep.run(owner, DAY)).isEqualTo(1);
        assertThat(sweep.run(owner, DAY)).isZero();
        assertThat(mentionRepository.findAll()).hasSize(1);
    }

    @Test
    void testRun_shouldIgnoreOtherDaysAndEmptyNotes() {
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Ádám");
        workout(owner, null, null);                                  // no text at all
        WorkoutSessionEntity yesterday = workout(owner, "Adammal toltuk a mellet.", null);
        yesterday.setDate(DAY.minusDays(1));
        workoutSessionRepository.saveAndFlush(yesterday);

        assertThat(sweep.run(owner, DAY)).isZero();
        assertThat(mentionRepository.findAll()).isEmpty();
    }

    @Test
    void testRun_shouldNotLeakAcrossUsers() {
        UUID owner = userPopulator.createUser().getId();
        UUID stranger = userPopulator.createUser().getId();
        personPopulator.createPerson(stranger, "Ádám");
        workout(owner, "Adammal toltuk a mellet.", null);

        assertThat(sweep.run(owner, DAY)).isZero();
        assertThat(sweep.run(stranger, DAY)).isZero();
        assertThat(mentionRepository.findAll()).isEmpty();
    }

    private WorkoutSessionEntity workout(UUID owner, String note, String closingNote) {
        WorkoutSessionEntity w = new WorkoutSessionEntity();
        w.setCreatedBy(owner);
        w.setDayLabel("Hét");
        w.setType("gym");
        w.setMuscle("mell");
        w.setOrderIndex(0);
        w.setStatus("completed");
        w.setDate(DAY);
        w.setNote(note);
        w.setClosingNote(closingNote);
        return trainPopulator.save(w);
    }
}
