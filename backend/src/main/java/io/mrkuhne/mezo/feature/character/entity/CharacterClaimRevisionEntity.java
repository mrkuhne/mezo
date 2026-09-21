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

@Getter
@Setter
@Entity
@Table(name = "character_claim_revision")
@SQLDelete(sql = "update character_claim_revision set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterClaimRevisionEntity extends OwnedEntity {
    @Id @GeneratedValue @Column(columnDefinition = "uuid")
    private UUID id;
    @NotNull @Column(name = "claim_id", nullable = false, columnDefinition = "uuid")
    private UUID claimId;
    @NotNull @Size(max = 16) @Pattern(regexp = "NEW|UP|DOWN|RETIRE|REVISE|MOVE|REPLY")
    @Column(nullable = false, length = 16)
    private String operation;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "before_snapshot", columnDefinition = "jsonb")
    private ClaimRevisionSnapshot beforeSnapshot;
    @NotNull @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after_snapshot", nullable = false, columnDefinition = "jsonb")
    private ClaimRevisionSnapshot afterSnapshot;
    @NotNull @Column(nullable = false, columnDefinition = "text")
    private String reason;
    @Column(name = "undone_at")
    private Instant undoneAt;
}
