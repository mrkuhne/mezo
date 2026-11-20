package io.mrkuhne.mezo.feature.penz.service.news;

/**
 * One reason a narrated item was rejected (mezo-r36n9.104), classified by the evaluation taxonomy of spec §6
 * (Entity Swap · Numerical Error · Negation Flip · Temporal Confusion) plus the §6 boundaries and the shape rules.
 * {@code detail} names the rule hit, never the offending prose (it may be injected text).
 */
public record DigestViolation(Rule rule, String field, String detail) {

    public enum Rule { SHAPE, NUMERICAL_ERROR, ENTITY_SWAP, NEGATION_FLIP, TEMPORAL_CONFUSION, BOUNDARY }
}
