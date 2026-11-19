package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Port for the W1.5 nightly note sweep ({@code NoteEmbeddingCatchUp}, mezo-b3pp.5): companion only
 * needs "which live notes still need a vector", flattened to the fields the writer embeds — HOW the
 * note is stored belongs to the owning feature, which implements this. The check-in side
 * ({@code companion/embedding/CheckInNoteSourceAdapter}) is the documented ASYMMETRY: it stays in
 * companion because {@code feature.biometrics} has no edge into {@code feature.companion} today, so
 * implementing this port from there would close a NEW 4-slice cycle, while a plain
 * companion → biometrics read is safe (that class's javadoc carries the full argument). The
 * activity-log implementation left with the XP world (mezo-r36n9.97.5); its already-written
 * {@code activity_note} vectors stay in the memory and keep resolving through the memory reads.
 */
public interface NarrativeNoteSource {

    /** The memory_embedding kinds a note source can produce — the port's vocabulary, so an
     *  implementing feature never imports a companion ENTITY just to name its kind. */
    String CHECKIN_NOTE = MemoryEmbeddingEntity.KIND_CHECKIN_NOTE;

    /** One embeddable note, flattened off its owning feature's entity. */
    record Note(UUID id, UUID createdBy, String text, LocalDate occurredOn) {}

    /** Which kind this source's notes become (one of the constants above). */
    String kind();

    /**
     * The user's live notes from THIS source ON a single day, in a stable order (mezo-06o0.10).
     *
     * <p>A second reader joined the sweep: the nightly people round
     * ({@code companion.service.PersonExtractionService}) builds the day's narrative from every
     * free-text source the user writes into, and an activity note or a check-in note is exactly
     * that. It needs one day, not the whole backlog, so it gets its own day-scoped method rather
     * than filtering {@link #notesToEmbed}'s full history in memory every night.
     *
     * <p>Deliberately NOT length-gated, unlike {@link #notesToEmbed}: a two-word note can still
     * name a person, and the reader that cares about substance can measure it itself.
     */
    List<Note> notesOn(UUID userId, LocalDate day);

    /** Live notes up to and including {@code through} whose text is at least {@code minChars}
     *  long, oldest first. */
    List<Note> notesToEmbed(UUID userId, LocalDate through, int minChars);

    /**
     * Which of {@code ids} still exist as LIVE rows for this user, with their current text — the
     * lifecycle half of the sweep (mezo-b3pp.26). An id absent from the result is a row that is
     * gone (soft-deleted), and its vector gets reaped.
     *
     * <p>Deliberately NOT length-gated, unlike {@link #notesToEmbed}: liveness and
     * substantiveness are different questions. A note edited down below {@code note-min-chars}
     * is still LIVE and must be re-embedded with its shorter text, not reaped — otherwise merely
     * raising that config knob would mass-delete a user's existing vectors on the next run.
     *
     * <p>An empty {@code ids} must return an empty list without hitting the database.
     */
    List<Note> liveNotes(UUID userId, Collection<UUID> ids);
}
