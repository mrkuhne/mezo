package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.people.service.MentionDetectionService;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Emberek (mezo-06o0.13): a nap edzés-jegyzeteinek név-matche — a {@link NoteMentionCatchUp}
 * ikertestvére arra a két forrásra, ami nem fér rá a {@code NarrativeNoteSource} portra.
 *
 * <p><b>Miért nem a port.</b> Kézenfekvő lett volna két új adapter, de a portnak MÁSIK fogyasztója
 * is van: a {@code NoteEmbeddingCatchUp} minden forrás jegyzetét beágyazza a szemantikus memóriába
 * a {@code kind()} alatt. Egy edzés-jegyzet adapter tehát csendben azt is eldöntené, hogy a
 * sorozat-jegyzetek bekerülnek a memory-vektorok közé — új {@code MemoryEmbeddingEntity.KIND_*}
 * konstans, saját DB CHECK, és egy meg nem beszélt termékdöntés. Ez a sweep csak említést ír, és
 * a beágyazás kérdését érintetlenül hagyja.
 *
 * <p><b>Miért két fajta egy helyett.</b> A {@code workout_session} és a {@code sport_session} külön
 * tábla, és a mention dedup-kulcsa {@code (created_by, person_id, source_ref_kind, source_ref_id)} —
 * a két id-tér összemosása egy közös „training_note" fajta alatt egy elvi ütközést hagyna nyitva,
 * ráadásul a feed forrás-címkéje is ezen áll: az „edzés" és a „sport" a felhasználónak két külön
 * dolog. A CHECK-et a {@code 202609062200_mezo-06o0.13_...} changeset szélesíti.
 *
 * <p>Egy edzés két szabadszöveges mezőt hordoz ({@code note} = a terv/közbeni jegyzet,
 * {@code closingNote} = a záró jegyzet), de EGY sorral azonosítható. A kettőt összefűzve adjuk át:
 * a dedup-kulcsban a sor id-ja szerepel, tehát külön hívásonként a második felülírásra futna.
 *
 * <p>{@code ts} = a nap kezdete (UTC), a {@link NoteMentionCatchUp} konvenciója szerint — egy
 * régi nap első sweepje ne árassza el „mai" említésekkel a feedet. Kapuzás PEOPLE ∧ COMPANION;
 * a bean a companionban él, mert {@code companion → train} és {@code companion → people} él már
 * létezik, a fordított irány ciklust zárna. IDENT-3: soronként warn + továbblépés.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class TrainingNoteMentionSweep {

    /** mention.source_ref_kind az edzés-sorra (terv/közbeni + záró jegyzet együtt). */
    public static final String WORKOUT_NOTE = "workout_note";
    /** mention.source_ref_kind a sport-alkalom jegyzetére. */
    public static final String SPORT_NOTE = "sport_note";

    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final MentionDetectionService mentionDetectionService;

    /** Végigmegy a nap edzés- és sport-jegyzetein; visszaadja az új említések számát. */
    public int run(UUID userId, LocalDate day) {
        int written = 0;
        for (WorkoutSessionEntity workout
                : workoutSessionRepository.findByCreatedByAndDateOrderByCreatedAtAsc(userId, day)) {
            written += detect(userId, workoutText(workout), WORKOUT_NOTE, workout.getId(), day);
        }
        for (SportSessionEntity sport
                : sportSessionRepository.findByCreatedByAndDeletedFalseAndDateOrderByTimeAsc(userId, day)) {
            written += detect(userId, sport.getNotes(), SPORT_NOTE, sport.getId(), day);
        }
        return written;
    }

    /** Az edzés két jegyzetmezője EGY szövegként — a dedup-kulcs a sor id-ja, nem a mező.
     *  Publikus, mert a {@code PersonExtractionService} napi narratívája ugyanezt az összefűzést
     *  használja: a két útnak szó szerint ugyanazt a szöveget kell látnia egy edzésről. */
    public static String workoutText(WorkoutSessionEntity workout) {
        String note = workout.getNote();
        String closing = workout.getClosingNote();
        if (note == null || note.isBlank()) {
            return closing;
        }
        return closing == null || closing.isBlank() ? note : note + "\n" + closing;
    }

    private int detect(UUID userId, String text, String refKind, UUID refId, LocalDate day) {
        try {
            return mentionDetectionService.detect(userId, text, "text", refKind, refId,
                    day.atStartOfDay(ZoneOffset.UTC).toInstant());
        } catch (Exception e) {
            log.warn("Training-note mention detection failed for {} {}", refKind, refId, e);
            return 0;
        }
    }
}
