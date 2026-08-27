package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Activity side of the W1.5 note sweep's {@code activity_note} source — see
 * {@link NarrativeNoteSource}. Deliberately a plain repository read, NOT {@link ActivityService},
 * to keep the companion → activity dependency out of the graph entirely (a direct
 * {@code ActivityService} import from {@code companion.embedding} would close a NEW slice cycle —
 * {@code ActivityService} itself already depends on {@code feature.quest}, which depends on
 * {@code feature.companion}).
 *
 * <p>Deliberately NOT gated behind {@code ACTIVITY_SWITCH}: history already logged must stay
 * embeddable by the nightly sweep even on a day the activity-capture feature itself is switched
 * off — the sweep, not the capture path, owns whether this backlog gets embedded.
 */
@Component
@RequiredArgsConstructor
public class ActivityNoteSourceAdapter implements NarrativeNoteSource {

    private final ActivityLogRepository activityLogRepository;

    @Override
    public String kind() {
        return NarrativeNoteSource.ACTIVITY_NOTE;
    }

    @Override
    public List<Note> notesToEmbed(UUID userId, LocalDate through, int minChars) {
        return activityLogRepository.findNoteCandidates(userId, through, minChars).stream()
                .map(e -> new Note(e.getId(), e.getCreatedBy(), e.getText(), e.getOccurredOn()))
                .toList();
    }

    @Override
    public List<Note> liveNotes(UUID userId, Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return activityLogRepository.findByCreatedByAndIdIn(userId, ids).stream()
                .map(e -> new Note(e.getId(), e.getCreatedBy(), e.getText(), e.getOccurredOn()))
                .toList();
    }
}
