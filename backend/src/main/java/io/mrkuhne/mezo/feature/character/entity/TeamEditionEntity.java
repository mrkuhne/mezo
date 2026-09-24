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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** Egy nap "esti kiadása" — a csapat-üzenőfal napi összefoglalója (mezo-a9bo7 H1). */
@Getter
@Setter
@Entity
@Table(name = "team_edition")
@SQLDelete(sql = "update team_edition set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TeamEditionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate day;

    @NotNull @Size(max = 16) @Pattern(regexp = "PUBLISHED|QUIET")
    @Column(nullable = false, length = 16)
    private String status;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    /** Soft ref to the conference this edition was generated from — nullable. */
    @Column(name = "conference_id", columnDefinition = "uuid")
    private UUID conferenceId;
}
