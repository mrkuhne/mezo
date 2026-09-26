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

/** One line in a team chat thread — an opener, a guest chime-in, the resolve line, a skeptic
 *  aside, or a user reply (Csapatfal Act III, mezo-a9bo7.21, spec §5.1). */
@Getter
@Setter
@Entity
@Table(name = "team_chat_line")
@SQLDelete(sql = "update team_chat_line set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TeamChatLineEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "thread_id", columnDefinition = "uuid")
    private UUID threadId;

    @NotNull @Size(max = 8)
    @Pattern(regexp = "OPEN|GUEST|RESOLVE|SKEPTIC|USER")
    @Column(nullable = false, length = 8)
    private String kind;

    /** Null for a {@code USER} line. */
    @Size(max = 16)
    @Column(length = 16)
    private String character;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @NotNull
    @Column(nullable = false)
    private Boolean voiced = false;

    /** The whitelist the line was written from. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private EditionFactsEnvelope facts;

    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}
