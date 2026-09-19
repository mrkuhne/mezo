package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import java.util.List;

/** One independently executable candidate source; failures are deliberately propagated. */
public interface MemoryRetriever {

    String name();

    List<MemoryCandidate> retrieve(RetrievalInput input);

    /**
     * Can this retriever contribute ANYTHING to this run? {@code false} means the coordinator does
     * not ask it at all — and, decisively, does not count it as a success either (mezo-eq85.10 fix
     * round 2, FIX A).
     *
     * <p>This predicate exists because the two are the same question. Fix round 1 made the fact and
     * graph retrievers return an empty list on a kind-scoped ({@code SIMILAR_DAYS}) run, which was
     * correct — neither can ever yield a {@code daily_summary} — but an empty list is indistinguishable
     * from "asked, found nothing", so both were counted as successes. With four retrievers and two
     * permanent free successes, {@code successCount == 0} became unreachable on every
     * {@code SIMILAR_DAYS} run: dense and lexical could BOTH be down and
     * {@link MemoryContextService#retrieveOrFail} would still hand back an audited empty context,
     * which the "hasonló napok" surfaces render as "nincs ilyen napod" — a lie about the user's own
     * history, and exactly the dishonesty fix round 1 shipped to remove.
     *
     * <p>So: a retriever that was ASKED and honestly found nothing is a SUCCESS (the normal
     * empty-memory case, not an outage); a retriever that was never asked is neither a success nor a
     * failure and is excluded from both sides of the ratio. The default is {@code true} — a
     * retriever only overrides this when it can prove a priori that it has nothing to offer.
     */
    default boolean appliesTo(RetrievalInput input) {
        return true;
    }
}
