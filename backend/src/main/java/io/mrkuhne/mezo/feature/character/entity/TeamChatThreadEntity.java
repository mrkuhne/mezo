package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** An "ügy" — the all-day team chat thread the companion rule engine opens on a flag raise and
 *  resolves when its trace clears (Csapatfal Act III, mezo-a9bo7.21, spec §5.1). */
@Getter
@Setter
@Entity
@Table(name = "team_chat_thread")
@SQLDelete(sql = "update team_chat_thread set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TeamChatThreadEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Size(max = 24)
    @Column(name = "flag_key", nullable = false, length = 24)
    private String flagKey;

    @NotNull @Size(max = 16)
    @Column(name = "owner_character", nullable = false, length = 16)
    private String ownerCharacter;

    @Size(max = 16)
    @Column(name = "guest_character", length = 16)
    private String guestCharacter;

    /** The library entry picked at open (feedback + priority). */
    @Size(max = 64)
    @Column(name = "advice_key", length = 64)
    private String adviceKey;

    @NotNull @Size(max = 10)
    @Pattern(regexp = "OPEN|RESOLVED|EXPIRED")
    @Column(nullable = false, length = 10)
    private String status;

    @NotNull
    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @NotNull
    @Column(nullable = false)
    private Boolean pushed = false;

    /** Offered {@code AdviceActionCatalog} actions. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private TeamChatActionsEnvelope actions;

    /** {@code {actionKey, at}} once applied. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private TeamChatActionsEnvelope.Applied applied;

    /** S7: why a RESOLVED ügy closed — DATA (a clear), REPLY (the user's explanation), EXCUSED
     *  (a known exception confirmed). Null while OPEN and on EXPIRED. */
    @Size(max = 8)
    @Pattern(regexp = "DATA|REPLY|EXCUSED")
    @Column(name = "close_reason", length = 8)
    private String closeReason;

    /** S7: the short context tag shown as „Falat lezárta: meccsnap". */
    @Size(max = 60)
    @Column(name = "close_note", length = 60)
    private String closeNote;

    /** S7: EXCUSE (the known-exception question) or REVIEW (the capped re-check); null otherwise. */
    @Size(max = 8)
    @Pattern(regexp = "EXCUSE|REVIEW")
    @Column(length = 8)
    private String offer;

    @Column(name = "exception_id", columnDefinition = "uuid")
    private UUID exceptionId;
}
