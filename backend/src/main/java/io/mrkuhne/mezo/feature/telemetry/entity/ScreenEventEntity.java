package io.mrkuhne.mezo.feature.telemetry.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One screen view (bd mezo-o5cz, spec 2026-09-07 §3). INSERT-only; rows leave through the
 * retention job's hard DELETE, never through a soft delete — {@code is_deleted} exists only
 * because {@link OwnedEntity} mandates the column and nothing ever flips it.
 *
 * <p>{@code screen} is the client's MATCHED ROUTE PATTERN ({@code /admin/users/:id}), never a
 * concrete URL — the frontend resolves it before emitting, so no path param ever reaches here
 * (spec T3). {@code createdBy} is stamped from the JWT by the controller, NEVER from the payload
 * (spec T5).
 */
@Getter
@Setter
@Entity
@Table(name = "screen_event")
public class ScreenEventEntity extends OwnedEntity {

    /** The only event kind v1 accepts; the column exists so a later kind can ride the table. */
    public static final String EVENT_VIEW = "view";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "screen", nullable = false, length = 120)
    private String screen;

    @Column(name = "event", nullable = false, length = 24)
    private String event = EVENT_VIEW;

    /** Client clock, clamped server-side to {@code now ± mezo.telemetry.occurred-at-clamp-hours}. */
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "meta")
    private Map<String, Object> meta;
}
