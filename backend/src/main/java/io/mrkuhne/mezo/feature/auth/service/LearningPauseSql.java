package io.mrkuhne.mezo.feature.auth.service;

/**
 * The batch half of "Most ne tanulj" (mezo-rrjxe): ONE SQL predicate that excludes paused
 * material, composed by every native look-back query — the
 * {@code MemorySourceVisibilitySql.forgottenTurn} idiom. Nobody re-derives the interval maths.
 */
public final class LearningPauseSql {

    private LearningPauseSql() {
    }

    /** True for rows of {@code alias} (needs {@code created_by}, {@code created_at}) that were NOT
     *  created inside any pause interval of their owner. */
    public static String notPaused(String alias) {
        return " not exists (select 1 from learning_pause lp where lp.created_by = " + alias + ".created_by"
                + " and lp.is_deleted = false and " + alias + ".created_at >= lp.started_at"
                + " and " + alias + ".created_at < coalesce(lp.ended_at, lp.planned_end_at, 'infinity'::timestamptz)) ";
    }
}
