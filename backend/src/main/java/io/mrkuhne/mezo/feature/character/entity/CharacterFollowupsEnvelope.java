package io.mrkuhne.mezo.feature.character.entity;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Follow-up state belongs to the original conference item, not a parallel conversation. */
public record CharacterFollowupsEnvelope(List<Item> items) {
    public CharacterFollowupsEnvelope { items = items == null ? List.of() : List.copyOf(items); }
    public record Item(UUID id, int sourceIndex, String kind, String expertKey, String question,
                       String requiredEvidence, LocalDate dueOn, String status,
                       LocalDate lastCheckedOn, UUID resolvedByConferenceId) {}
}
