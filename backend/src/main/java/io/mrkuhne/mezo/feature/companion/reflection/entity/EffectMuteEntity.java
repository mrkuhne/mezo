package io.mrkuhne.mezo.feature.companion.reflection.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * S6 (mezo-d6ivw.6): a per-subject effect mute/forget — outlives the nightly {@code effect_link}
 * cache (those rows are soft-deleted and re-created every recompute, so a flag ON the row would
 * die with it). {@code muted} hides the subject's metrics without vetoing recomputation;
 * {@code forgotten} is terminal — the subject is never shown or used again.
 */
@Getter
@Setter
@Entity
@Table(name = "effect_mute")
@SQLDelete(sql = "update effect_mute set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class EffectMuteEntity extends OwnedEntity {

    public static final String MODE_MUTED = "muted";
    public static final String MODE_FORGOTTEN = "forgotten";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_effect_mute_subject_kind. */
    @NotNull
    @Size(max = 8)
    @Pattern(regexp = "person|event")
    @Column(name = "subject_kind", nullable = false, length = 8)
    private String subjectKind;

    @NotNull
    @Size(max = 64)
    @Column(name = "subject_key", nullable = false, length = 64)
    private String subjectKey;

    /** Mirrors ck_effect_mute_mode. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "muted|forgotten")
    @Column(nullable = false, length = 16)
    private String mode;

    public boolean isForgotten() {
        return MODE_FORGOTTEN.equals(mode);
    }
}
