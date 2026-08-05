package io.mrkuhne.mezo.feature.train.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

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
}
