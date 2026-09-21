package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.Setter;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "character_reply")
@SQLDelete(sql = "update character_reply set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterReplyEntity extends OwnedEntity {
    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "source_type", columnDefinition = "varchar(24)")
    private String sourceType;

    @Column(name = "source_id", columnDefinition = "uuid")
    private UUID sourceId;

    @Column(name = "source_index", columnDefinition = "integer")
    private Integer sourceIndex;

    @Column(name = "source_evidence", columnDefinition = "text")
    private String sourceEvidence;

    @Column(name = "source_text", columnDefinition = "text")
    private String sourceText;

    @Column(name = "text", columnDefinition = "varchar(2000)")
    private String text;

    @Column(name = "client_request_id", columnDefinition = "uuid")
    private UUID clientRequestId;

    @Column(name = "author_name", columnDefinition = "varchar(120)")
    private String authorName;

    @Column(name = "expert_key", columnDefinition = "varchar(40)")
    private String expertKey;

    @Column(name = "dimension_key", columnDefinition = "varchar(40)")
    private String dimensionKey;

    @Column(name = "claim_id", columnDefinition = "uuid")
    private UUID claimId;

    @Column(name = "status", columnDefinition = "varchar(24)")
    private String status;

    @Column(name = "outcome", columnDefinition = "varchar(24)")
    private String outcome;

    @Column(name = "outcome_text", columnDefinition = "varchar(2000)")
    private String outcomeText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "discussion", columnDefinition = "jsonb")
    private CharacterReplyDiscussionEnvelope discussion;

    @Column(name = "processing_token", columnDefinition = "uuid")
    private UUID processingToken;

    @Column(name = "processing_started_at", columnDefinition = "timestamptz")
    private Instant processingStartedAt;
}
