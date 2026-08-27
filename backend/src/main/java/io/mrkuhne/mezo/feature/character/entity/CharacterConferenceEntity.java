package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A persisted konzílium — the real multi-turn expert transcript plus its structured outcome
 * (Karakter spec §3/§4). BOOTSTRAP has no {@code weekStart}; WEEKLY is unique per live
 * owner+week (partial unique index).
 */
@Getter
@Setter
@Entity
@Table(name = "character_conference")
@SQLDelete(sql = "update character_conference set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterConferenceEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** BOOTSTRAP | WEEKLY | MONTHLY. */
    @NotNull
    @Column(nullable = false, length = 10)
    private String kind;

    @Column(name = "week_start")
    private LocalDate weekStart;

    /** Note: written by later slices; Slice 1 only reads it. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ConferenceTranscriptEnvelope transcript;

    /** Note: written by later slices; Slice 1 only reads it. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ConferenceOutcomeEnvelope outcome;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
