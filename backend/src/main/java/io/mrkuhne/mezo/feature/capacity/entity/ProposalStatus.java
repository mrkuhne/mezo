package io.mrkuhne.mezo.feature.capacity.entity;

/** Decision state of a {@code capacity_proposal} (Boop B7, mezo-r36n9.17). Stored lowercase ({@link #wire()}). */
public enum ProposalStatus {
    OPEN, ACCEPTED, DECLINED, IGNORED, UNDONE, EXPIRED;

    public String wire() {
        return name().toLowerCase();
    }
}
