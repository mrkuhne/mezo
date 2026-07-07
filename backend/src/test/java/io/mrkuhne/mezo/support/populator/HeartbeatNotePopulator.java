package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code heartbeat_note} rows (proactive H1). */
@TestComponent
@RequiredArgsConstructor
public class HeartbeatNotePopulator {

    private final HeartbeatNoteRepository heartbeatNoteRepository;

    public HeartbeatNoteEntity note(UUID createdBy, LocalDate noteDate, String windowKey) {
        HeartbeatNoteEntity entity = new HeartbeatNoteEntity();
        entity.setCreatedBy(createdBy);
        entity.setNoteDate(noteDate);
        entity.setWindowKey(windowKey);
        entity.setKind(HeartbeatNoteEntity.WINDOW_EVENING.equals(windowKey)
                ? HeartbeatNoteEntity.KIND_CLOSING
                : HeartbeatNoteEntity.KIND_NUDGE);
        entity.setContent("Teszt napközbeni jegyzet.");
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return heartbeatNoteRepository.saveAndFlush(entity);
    }
}
