package io.mrkuhne.mezo.feature.companion.entity;

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
 * S6 (mezo-d6ivw.6): "Elfelejtem" is permanent — the same thing is never re-learned from the same
 * source. A {@code fact_text} row holds a forgotten fact's normalized text (every text-minting
 * candidate writer checks it); a {@code pattern} row holds a forgotten observation's pattern id
 * (promotion checks it). The normalizer lives here, on the entity, so {@code companion.service}
 * and {@code proactive} share one definition (slice lesson 12).
 */
@Getter
@Setter
@Entity
@Table(name = "memory_forget_veto")
@SQLDelete(sql = "update memory_forget_veto set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryForgetVetoEntity extends OwnedEntity {

    public static final String DOMAIN_FACT_TEXT = "fact_text";
    public static final String DOMAIN_PATTERN = "pattern";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "fact_text|pattern")
    @Column(nullable = false, length = 16)
    private String domain;

    @NotNull
    @Size(max = 500)
    @Column(name = "veto_key", nullable = false, length = 500)
    private String vetoKey;

    /** The extraction dedupe rule (FactExtractionService / WeeklyLessonService normalize). */
    public static String normalizeFactText(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
