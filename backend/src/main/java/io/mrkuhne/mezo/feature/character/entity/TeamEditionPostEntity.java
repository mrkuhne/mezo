package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** Egy poszt egy "esti kiadásban" — a csapattag (Szunya/Mocor/Falat/Deru/Mezo) hangján, rank
 *  szerint sorolva (mezo-a9bo7 H1). */
@Getter
@Setter
@Entity
@Table(name = "team_edition_post")
@SQLDelete(sql = "update team_edition_post set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TeamEditionPostEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "edition_id", nullable = false, columnDefinition = "uuid")
    private UUID editionId;

    @NotNull
    @Column(nullable = false)
    private Short rank;

    // NOTE: no @Pattern here (unlike CharacterRunEntity#status) — bean validation would throw
    // jakarta.validation.ConstraintViolationException on pre-insert, before the row ever reaches
    // Postgres, which is not what TeamEditionSchemaIT (and the brief) asserts for an invalid
    // character key: it wants the DB's ck_team_edition_post_character check constraint to be the
    // one enforcing this, surfacing as DataIntegrityViolationException.
    @NotNull @Size(max = 16)
    @Column(name = "character_key", nullable = false, length = 16)
    private String characterKey;

    @NotNull @Size(max = 16)
    @Column(nullable = false, length = 16)
    private String genre;

    @NotNull @Size(max = 24)
    @Column(name = "source_kind", nullable = false, length = 24)
    private String sourceKind;

    @NotNull @Size(max = 64)
    @Column(name = "source_id", nullable = false, length = 64)
    private String sourceId;

    @NotNull @Size(max = 160)
    @Column(name = "source_route", nullable = false, length = 160)
    private String sourceRoute;

    @Column(columnDefinition = "text")
    private String title;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @NotNull
    @Column(nullable = false)
    private Boolean voiced = false;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private EditionFactsEnvelope facts;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private EditionRefsEnvelope refs;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private EditionGuestsEnvelope guests;
}
