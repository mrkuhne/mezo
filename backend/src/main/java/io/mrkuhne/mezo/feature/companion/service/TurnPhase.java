package io.mrkuhne.mezo.feature.companion.service;

/**
 * mezo-rj214.7 S9.6 Task 2 — the phases a LIVE-pipeline turn narrates while it waits: what the
 * planner/executor/answerer are doing right now, wire-named for the stream event the FE renders
 * (Task 3/4). {@code PLANNING} is emitted by the caller at attempt start, not by {@link
 * ChatService} itself (see {@link ChatService#pipelineAnswer}'s javadoc) — a planner that fails
 * must still have narrated the wait before it had a plan to retrieve with.
 */
public enum TurnPhase {
    PLANNING("planning"),
    RETRIEVING("retrieving"),
    ANSWERING("answering");

    private final String wire;

    TurnPhase(String wire) {
        this.wire = wire;
    }

    public String wire() {
        return wire;
    }
}
