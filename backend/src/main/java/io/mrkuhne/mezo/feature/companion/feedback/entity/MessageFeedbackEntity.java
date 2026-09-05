package io.mrkuhne.mezo.feature.companion.feedback.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * One updatable 👍/👎 verdict per AI artifact (Phase 5 W4.1, bd mezo-b3pp.15, spec §4.4).
 *
 * <p>Artifact existence is deliberately NOT enforced by FK — the seven kinds span seven tables
 * and a dangling id is harmless in a single-user app (spec §8.1).
 *
 * <p>{@code uq_message_feedback_artifact} spans soft-deleted rows too, so the write path
 * (see {@link io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository#upsertVerdict}) is a native upsert that resurrects
 * a retracted row rather than colliding with it.
 */
@Getter
@Setter
@Entity
@Table(name = "message_feedback", uniqueConstraints =
    @UniqueConstraint(name = "uq_message_feedback_artifact", columnNames = {"created_by", "artifact_kind", "artifact_id"}))
@SQLDelete(sql = "update message_feedback set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MessageFeedbackEntity extends OwnedEntity {

    public static final String KIND_CHAT_MESSAGE = "chat_message";
    public static final String KIND_FEED_MESSAGE = "feed_message";
    public static final String KIND_WEEKLY_SUGGESTION = "weekly_suggestion";
    public static final String KIND_WEEKLY_REVIEW = "weekly_review";
    public static final String KIND_MEMOIR = "memoir";
    public static final String KIND_PREDICTION = "prediction";
    public static final String KIND_DAY_REVIEW = "day_review";

    public static final String VERDICT_UP = "up";
    public static final String VERDICT_DOWN = "down";

    public static final String REASON_INACCURATE = "inaccurate";
    public static final String REASON_TOO_MUCH = "too_much";
    public static final String REASON_BAD_TIMING = "bad_timing";
    public static final String REASON_NOT_ABOUT_ME = "not_about_me";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Mirrors ck_message_feedback_artifact_kind. */
    @NotNull
    @Size(max = 20)
    @Pattern(regexp = "chat_message|feed_message|weekly_suggestion|weekly_review|memoir|prediction|day_review")
    @Column(name = "artifact_kind", nullable = false, length = 20)
    private String artifactKind;

    /** The rated artifact's row id in its own kind's table (no FK — see class javadoc). */
    @NotNull
    @Column(name = "artifact_id", nullable = false, columnDefinition = "uuid")
    private UUID artifactId;

    /** Mirrors ck_message_feedback_verdict. */
    @NotNull
    @Size(max = 4)
    @Pattern(regexp = "up|down")
    @Column(nullable = false, length = 4)
    private String verdict;

    /** Mirrors ck_message_feedback_reason_value; ck_message_feedback_reason (reason only with
     *  a down verdict) is a cross-field DB CHECK with no entity-level equivalent. */
    @Size(max = 16)
    @Pattern(regexp = "inaccurate|too_much|bad_timing|not_about_me")
    @Column(length = 16)
    private String reason;
}
