package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Check-in side of the W1.5 note sweep's {@code checkin_note} source — see
 * {@link NarrativeNoteSource}. Unlike {@code activity.service.ActivityNoteSourceAdapter}, this
 * adapter lives IN companion (not in {@code biometrics.checkin.service}) and imports
 * {@link CheckInRepository} directly: {@code feature.activity} already depends on
 * {@code feature.companion} (so a companion → activity edge would close a cycle, forcing the
 * inversion), but {@code feature.biometrics} has NO existing dependency on {@code
 * feature.companion} — while {@code feature.companion} already reaches {@code feature.biometrics}
 * transitively (companion → meal → goal → biometrics, the goal↔biometrics leg being a pre-existing
 * frozen cycle). Implementing {@link NarrativeNoteSource} from INSIDE {@code
 * biometrics.checkin.service} would add the missing biometrics → companion leg and close a NEW,
 * un-frozen 4-slice cycle ({@code ArchitectureTest#feature_slices_are_cycle_free}); staying a plain
 * companion → biometrics read (the direction that already exists safely elsewhere in this pipeline)
 * avoids that without touching the frozen cycle at all.
 *
 * <p>Deliberately NOT gated behind any feature switch: history already logged must stay
 * embeddable by the nightly sweep even on a day check-in capture itself is switched off — the
 * sweep, not the capture path, owns whether this backlog gets embedded.
 */
@Component
@RequiredArgsConstructor
public class CheckInNoteSourceAdapter implements NarrativeNoteSource {

    private final CheckInRepository checkInRepository;

    @Override
    public String kind() {
        return NarrativeNoteSource.CHECKIN_NOTE;
    }

    @Override
    public List<Note> notesToEmbed(UUID userId, LocalDate through, int minChars) {
        return checkInRepository.findNoteCandidates(userId, through, minChars).stream()
                .map(c -> new Note(c.getId(), c.getCreatedBy(), c.getNote(), c.getDate()))
                .toList();
    }

    @Override
    public List<Note> liveNotes(UUID userId, Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return checkInRepository.findByCreatedByAndIdIn(userId, ids).stream()
                .map(c -> new Note(c.getId(), c.getCreatedBy(), c.getNote(), c.getDate()))
                .toList();
    }
}
