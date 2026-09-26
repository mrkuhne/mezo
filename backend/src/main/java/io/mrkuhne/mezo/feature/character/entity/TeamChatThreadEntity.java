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
}
