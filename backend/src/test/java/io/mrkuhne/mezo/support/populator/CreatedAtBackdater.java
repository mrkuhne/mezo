package io.mrkuhne.mezo.support.populator;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/**
 * Makes a row OLD (round 2 S5, bd mezo-d58h.7.5). {@code OwnedEntity.createdAt} is
 * {@code @CreationTimestamp} + {@code updatable = false}, so JPA cannot write it and every
 * populator-made row is born "now" — which would make every feature-abandonment test vacuous
 * (nothing could sit outside a 30-day idle window). A native update is the only way in; the
 * field-injected {@code @PersistenceContext} is the house test-support exception to constructor DI
 * (the {@code CompanionMessagePopulator.rawInsertKind} idiom).
 *
 * <p>The table name is checked against an allow-list rather than interpolated blind: these are the
 * usage tables the question detectors read, and a typo should fail loudly here instead of silently
 * updating nothing.
 */
@TestComponent
public class CreatedAtBackdater {

    private static final Set<String> TABLES = Set.of(
        "journal_entry", "gratitude_entry", "decision_entry",
        "habit_day", "ritual_day", "needs_day", "ai_message", "exercise_feedback",
        // Reflexió S2 (mezo-eq85.2): a hypothesis's dormancy clock starts at its own birthday
        "pattern");

    @PersistenceContext
    private EntityManager em;

    /** One row by id. */
    @Transactional
    public void backdate(String table, UUID rowId, Instant createdAt) {
        em.createNativeQuery("update " + checked(table) + " set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", rowId).executeUpdate();
        em.flush();
        em.clear();
    }

    /** Every row this owner has in the table — the usual shape of an abandonment fixture. */
    @Transactional
    public void backdateAll(String table, UUID owner, Instant createdAt) {
        em.createNativeQuery(
                "update " + checked(table) + " set created_at = :at where created_by = :owner")
            .setParameter("at", createdAt).setParameter("owner", owner).executeUpdate();
        em.flush();
        em.clear();
    }

    private static String checked(String table) {
        if (!TABLES.contains(table)) {
            throw new IllegalArgumentException("Not a usage table: " + table);
        }
        return table;
    }
}
