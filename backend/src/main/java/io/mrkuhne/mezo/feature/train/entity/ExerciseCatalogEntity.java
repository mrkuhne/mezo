package io.mrkuhne.mezo.feature.train.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * Exercise catalog row — a hybrid table (since mezo-52zg): rows with {@code createdBy == null}
 * are MASTER content, upserted by {@code slug} at startup from {@code content/exercise-catalog.json}
 * ({@link io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader}); rows with {@code createdBy} set are
 * user-authored and soft-deletable. {@code videoUrl} is a demo link settable on any row (the loader
 * never clobbers it). {@code type} is {@code compound|isolation|plyo}, {@code muscle} a token of the
 * picker taxonomy (both DB CHECKed).
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_catalog")
@SQLDelete(sql = "update exercise_catalog set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseCatalogEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, unique = true)
    private String slug;

    @NotNull
    @Column(nullable = false)
    private String name;

    @NotNull
    @Column(nullable = false)
    private String muscle;

    @NotNull
    @Column(nullable = false)
    private String type;

    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal stim;

    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal fatigue;

    /** null = master/JSON content (loader-owned); set = user-authored row. */
    @Column(name = "created_by")
    private UUID createdBy;

    @NotNull
    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    /** Effective YouTube demo URL; nullable. */
    @Column(name = "video_url")
    private String videoUrl;

    /**
     * Demo still, start position ({@code mezo-8xdl.1}) — the presence flag for the image pair:
     * no start frame means the exercise has no image at all. Same-origin vendored path
     * ({@code /exercises/{slug}-a.jpg}) or an absolute URL.
     */
    @Column(name = "image_start_url")
    private String imageStartUrl;

    /** Demo still, end position; alternated with {@link #imageStartUrl} to convey the movement. */
    @Column(name = "image_end_url")
    private String imageEndUrl;

    /** {@code machine|cable|dumbbell|barbell|bodyweight|kettlebell|other} (DB CHECKed); loader-owned on master rows. */
    @NotNull
    @Column(nullable = false)
    private String equipment = "other";

    /**
     * {@code stable|free} (DB CHECKed): physical support, separate from the technique palette.
     * Loader-owned on master rows, user-settable on own rows.
     */
    @NotNull
    @Column(nullable = false)
    private String stability = "free";

    /** Explicit master SPE palette. NULL on user-authored rows means the legacy stability fallback. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "allowed_techniques", columnDefinition = "varchar(16)[]")
    private List<String> allowedTechniques;

    /** Loads the muscle well in its lengthened position; loader-owned on master rows. */
    @NotNull
    @Column(name = "lengthened_friendly", nullable = false)
    private Boolean lengthenedFriendly = false;

    // Selection attributes (mezo-r36n9.66): loader-owned on master rows; NULL on user-authored rows.

    /** Finer, multi-valued kit list the swap filters on ("Mi van a termemben"); distinct from {@link #equipment}. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "gear", columnDefinition = "varchar(16)[]")
    private List<String> gear;

    /** One of the 21 movement patterns (spec §6.1). */
    @Column(name = "pattern")
    private String pattern;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "secondary_muscles", columnDefinition = "varchar(24)[]")
    private List<String> secondaryMuscles;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "joints", columnDefinition = "varchar(16)[]")
    private List<String> joints;

    /** Loads the muscle at a stretch; distinct from {@link #lengthenedFriendly}. */
    @Column(name = "lengthened")
    private Boolean lengthened;

    /** {@code low|medium|high} systemic demand. */
    @Column(name = "demand")
    private String demand;
}
