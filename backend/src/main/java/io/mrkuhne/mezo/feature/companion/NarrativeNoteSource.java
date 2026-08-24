package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Port for the W1.5 nightly note sweep ({@code NoteEmbeddingCatchUp}, mezo-b3pp.5): companion only
 * needs "which live notes still need a vector", flattened to the fields the writer embeds — HOW the
 * note is stored (activity log vs. check-in) belongs to the owning feature, which implements this —
 * {@code activity/service/ActivityNoteSourceAdapter}; the check-in side
 * ({@code companion/embedding/CheckInNoteSourceAdapter}) is the documented ASYMMETRY: it stays in
 * companion because {@code feature.biometrics} has no edge into {@code feature.companion} today, so
 * implementing this port from there would close a NEW 4-slice cycle, while a plain
 * companion → biometrics read is safe (that class's javadoc carries the full argument). The
 * dependency otherwise stays activity → companion, never back — {@code feature.activity} already
 * depends on {@code feature.companion} (both directly, {@code ActivityClassifier} calling {@link CompanionLlm}, and
 * transitively via {@code feature.quest}, which also depends on companion), so a direct {@code
 * companion.embedding → activity.repository.ActivityLogRepository} import would close a NEW slice
 * cycle ({@code ArchitectureTest#feature_slices_are_cycle_free} is a FreezingArchRule — only
 * pre-existing frozen cycles are tolerated); this port keeps it one-directional, the {@link
 * TodayActivitySource} precedent.
 */
public interface NarrativeNoteSource {

    /** The memory_embedding kinds a note source can produce — the port's vocabulary, so an
     *  implementing feature never imports a companion ENTITY just to name its kind. */
    String ACTIVITY_NOTE = MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE;
    String CHECKIN_NOTE = MemoryEmbeddingEntity.KIND_CHECKIN_NOTE;

    /** One embeddable note, flattened off its owning feature's entity. */
    record Note(UUID id, UUID createdBy, String text, LocalDate occurredOn) {}

    /** Which kind this source's notes become (one of the constants above). */
    String kind();

    /** Live notes up to and including {@code through} whose text is at least {@code minChars}
     *  long, oldest first. */
    List<Note> notesToEmbed(UUID userId, LocalDate through, int minChars);
}
