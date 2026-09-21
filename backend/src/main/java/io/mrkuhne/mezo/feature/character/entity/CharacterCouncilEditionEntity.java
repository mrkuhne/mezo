package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "character_council_edition")
@SQLDelete(sql = "update character_council_edition set is_deleted=true where id=?")
@SQLRestriction("is_deleted=false")
public class CharacterCouncilEditionEntity extends OwnedEntity {
    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(nullable = false) private LocalDate day;
    @NotNull @Pattern(regexp = "WAITING|PROCESSING|COMPLETED|QUIET|FAILED")
    @Column(nullable = false, length = 16) private String status;
    @Column(nullable = false) private int attempts;
    @Column(name = "processing_token") private UUID processingToken;
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "conference_id") private UUID conferenceId;
}
