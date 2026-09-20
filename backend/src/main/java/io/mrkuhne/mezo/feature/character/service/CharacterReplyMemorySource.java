package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Captured replies are self-report narrative, available to both memory generations and catch-up.
 */
@Component
@RequiredArgsConstructor
public class CharacterReplyMemorySource implements NarrativeNoteSource {
    private final CharacterReplyRepository replies;

    @Override
    public String kind() {
        return MemoryEmbeddingEntity.KIND_CHARACTER_REPLY;
    }

    public static Note note(CharacterReplyEntity r) {
        return new Note(
                r.getId(),
                r.getCreatedBy(),
                "Karakter — felhasználói önbeszámoló. Téma: «"
                        + CharacterReplyService.flat(r.getSourceText())
                        + "». Válasz: "
                        + CharacterReplyService.flat(r.getText()),
                r.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate());
    }

    @Override
    public List<Note> notesToEmbed(UUID owner, LocalDate through, int minChars) {
        return replies.findByCreatedByOrderByCreatedAtAsc(owner).stream()
                .map(CharacterReplyMemorySource::note)
                .filter(n -> !n.occurredOn().isAfter(through) && n.text().length() >= minChars)
                .toList();
    }

    @Override
    public List<Note> notesOn(UUID owner, LocalDate day) {
        return notesToEmbed(owner, day, 0).stream()
                .filter(n -> n.occurredOn().equals(day))
                .toList();
    }

    @Override
    public List<Note> liveNotes(UUID owner, Collection<UUID> ids) {
        return ids.isEmpty()
                ? List.of()
                : replies.findByCreatedByAndIdIn(owner, ids).stream()
                        .map(CharacterReplyMemorySource::note)
                        .toList();
    }
}
