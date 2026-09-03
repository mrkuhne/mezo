package io.mrkuhne.mezo.feature.habit.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One catalog habit (seed-imported or user-created). habit_day joins it by habit_key (D2). */
@Getter
@Setter
@Entity
@Table(name = "habit_def")
@SQLDelete(sql = "update habit_def set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HabitDefEntity extends OwnedEntity {

    public static final String MODE_DERIVED = "DERIVED";
    public static final String MODE_MANUAL = "MANUAL";
    public static final String METRIC_MANUAL = "manual";
    public static final String SKILL_KIND_LIFE = "LIFE";
    public static final String FRAMEWORK_FOGG = "FOGG";
    public static final String FRAMEWORK_CLEAR = "CLEAR";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "habit_key", nullable = false, length = 40)
    private String habitKey;

    @Column(name = "chain_id", nullable = false, columnDefinition = "uuid")
    private UUID chainId;

    @Column(nullable = false)
    private Integer position;

    @Column(nullable = false, length = 80)
    private String title;

    @Column
    private String why;

    @Column(name = "anchor_copy", length = 120)
    private String anchorCopy;

    @Column(nullable = false, length = 7)
    private String mode;

    @Column(nullable = false, length = 40)
    private String metric;

    @Column(name = "skill_key", nullable = false, length = 40)
    private String skillKey;

    @Column(name = "skill_kind", nullable = false, length = 4)
    private String skillKind = SKILL_KIND_LIFE;

    @Column(nullable = false)
    private Integer xp;

    @Column(name = "link_url")
    private String linkUrl;

    /** Behaviour-change framework this recipe was built on; null for pre-mezo-3zue defs. */
    @Column(length = 5)
    private String framework;

    /** FOGG: the habit_key of another of the user's defs this one is stacked onto. */
    @Column(name = "anchor_habit_key", length = 40)
    private String anchorHabitKey;

    /** CLEAR: when and where — the 1st law's "make it obvious". */
    @Column(length = 160)
    private String cue;

    /** CLEAR: the wanting behind the behaviour — the 2nd law. */
    @Column(length = 200)
    private String craving;

    /** CLEAR: what makes it satisfying — the 4th law. */
    @Column(length = 160)
    private String reward;

    /** FOGG: the immediate "shine" performed within seconds of the behaviour. */
    @Column(length = 120)
    private String celebration;

    /** CLEAR: the optional identity sentence ("…hogy olyan ember legyek, aki"). */
    @Column(length = 120)
    private String identity;

    @Column(name = "is_active", nullable = false)
    private Boolean active = true;
}
