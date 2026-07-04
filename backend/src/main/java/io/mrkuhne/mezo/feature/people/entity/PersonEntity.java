package io.mrkuhne.mezo.feature.people.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * An inner-circle person (Emberek). Identity + owner-curated narrative fields
 * ({@code knownFacts}/{@code ties}/{@code affectTrend}) are stored; mention-derived stats
 * (count / this-week / last-mentioned) are computed in {@code PeopleService}, never persisted.
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "person")
@SQLDelete(sql = "update person set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PersonEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(nullable = false) private String name;
    @NotNull @Column(nullable = false) private String initial;
    @NotNull @Column(nullable = false) private String relationship; // partner|teammate|mentee (DB CHECK)
    @NotNull @Column(name = "relationship_hu", nullable = false) private String relationshipHu;
    @NotNull @Column(name = "affect_baseline", nullable = false) private String affectBaseline; // affect (DB CHECK)
    @Column(name = "contact_cadence_label") private String contactCadenceLabel;
    @Column private String notes;

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "known_facts", nullable = false, columnDefinition = "text[]")
    private List<String> knownFacts = new ArrayList<>();

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> ties = new ArrayList<>();

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "affect_trend", nullable = false, columnDefinition = "integer[]")
    private List<Integer> affectTrend = new ArrayList<>();
}
