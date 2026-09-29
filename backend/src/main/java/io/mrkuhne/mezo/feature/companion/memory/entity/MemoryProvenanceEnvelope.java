package io.mrkuhne.mezo.feature.companion.memory.entity;

import java.time.Instant;
import java.util.UUID;

/** Typed origin metadata for a canonical memory projection. S2 (mezo-d6ivw.2) appends the
 *  trailing {@code patternId}/{@code confirmSource} fields — they also double as {@code
 *  io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity}'s pattern-promotion provenance
 *  (see {@link #patternPromotion}), not only the memory projection this record was originally
 *  named for. */
public record MemoryProvenanceEnvelope(
        String sourceTable,
        Instant sourceUpdatedAt,
        String projectorVersion,
        UUID conversationId,
        String suppressionReason,
        UUID patternId,
        String confirmSource) {

    public MemoryProvenanceEnvelope(String sourceTable, Instant sourceUpdatedAt, String projectorVersion, UUID conversationId) {
        this(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, null, null, null);
    }

    public MemoryProvenanceEnvelope(String sourceTable, Instant sourceUpdatedAt, String projectorVersion, UUID conversationId, String suppressionReason) {
        this(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, suppressionReason, null, null);
    }

    public boolean userSuppressed() {
        return "user".equals(suppressionReason);
    }

    public MemoryProvenanceEnvelope withUserSuppression() {
        return new MemoryProvenanceEnvelope(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, "user", patternId, confirmSource);
    }

    public static MemoryProvenanceEnvelope empty() {
        return new MemoryProvenanceEnvelope(null, null, null, null, null, null, null);
    }

    /** S2 (mezo-d6ivw.2): a knowledge fact born from a pattern confirm — who and from what. */
    public static MemoryProvenanceEnvelope patternPromotion(UUID patternId, String confirmSource) {
        return new MemoryProvenanceEnvelope("pattern", null, null, null, null, patternId, confirmSource);
    }

    /** S7 (mezo-d6ivw.7): a knowledge fact born from a csapatfal reply — {@code patternId} carries
     *  the USER line id and {@code conversationId} the ügy (thread) id, reusing the record's
     *  existing pattern-promotion slots for the team-chat mapping. */
    public static MemoryProvenanceEnvelope teamChat(UUID lineId, UUID threadId) {
        return new MemoryProvenanceEnvelope("team_chat_line", null, null, threadId, null, lineId, null);
    }

    /** „Rólam is" (mezo-d6ivw.13): a knowledge fact copied from a chat person fact at the user's
     *  tap. The envelope only names the origin table and the act ({@code confirmSource} =
     *  "about_me"); the link itself is {@code knowledge_fact.source_person_fact_id}, a real column
     *  so the one-live-copy rule can be a unique index. */
    public static MemoryProvenanceEnvelope personFact() {
        return new MemoryProvenanceEnvelope("person_fact", null, null, null, null, null, "about_me");
    }
}
