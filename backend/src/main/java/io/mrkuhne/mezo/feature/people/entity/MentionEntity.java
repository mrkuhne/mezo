package io.mrkuhne.mezo.feature.people.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One logged mention of a person. The v1 write path (the {@code PersonLogSheet} chip flow)
 * server-stamps {@code source='chip'}, {@code ts=now}, {@code flagged=false}; the richer
 * source/duration/tiedTo columns exist for fixtures and future capture surfaces.
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "mention")
@SQLDelete(sql = "update mention set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MentionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "person_id", nullable = false, columnDefinition = "uuid") private UUID personId;
    @NotNull @Column(nullable = false) private Instant ts;
    @NotNull @Column(nullable = false) private String source; // voice|camera|chip|text (DB CHECK)
    @Column(name = "duration_s") private Integer durationS;
    @NotNull @Column(nullable = false) private String excerpt;
    @NotNull @Column(nullable = false) private String tone; // affect (DB CHECK)
    @Column(name = "tied_to_kind") private String tiedToKind;
    @Column(name = "tied_to_label") private String tiedToLabel;
    @NotNull @Column(nullable = false) private boolean flagged = false;
}
