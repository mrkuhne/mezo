package io.mrkuhne.mezo.feature.companion.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * S8 (mezo-d6ivw.12): one memory item a chat turn produced — the shared shape of the turn-memory
 * forget list, the forget-all preview and the {@code [Ebben a beszélgetésben]} prompt block.
 * Persisted inside {@link ForgottenMemoriesEnvelope}; {@code who}/{@code text} are snapshots.
 *
 * @param kind            {@link #KIND_PERSON_FACT} | {@link #KIND_FACT_CANDIDATE} | {@link #KIND_KNOWLEDGE_FACT}
 * @param refId           the person fact / the undecided candidate / the promoted knowledge fact
 * @param personId        the person of a person fact, else null
 * @param who             the person's name for a person fact, else null (= about the owner)
 * @param pending         true for an undecided proposal
 * @param sourceMessageId the chat USER message that produced it
 */
public record ChatMemoryItem(String kind, UUID refId, UUID personId, String who, String text,
                             Instant createdAt, boolean pending, UUID sourceMessageId) {

    public static final String KIND_PERSON_FACT = "person_fact";
    public static final String KIND_FACT_CANDIDATE = "fact_candidate";
    public static final String KIND_KNOWLEDGE_FACT = "knowledge_fact";
}
