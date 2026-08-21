package io.mrkuhne.mezo.feature.journal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import java.util.UUID;

/** One gratitude line (≤280 chars) about a day, optionally tagged with a LIFE skill area. */
@Entity
@Table(name = "gratitude_entry")
@SQLDelete(sql = "update gratitude_entry set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
@Getter @Setter @NoArgsConstructor
public class GratitudeEntryEntity extends OwnedEntity {

    public static final String LIFE_AREA_PATTERN =
            "mindfulness|mindset|cooking|financial|productivity|learning|connection|recovery";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @NotBlank
    @Size(max = 280)
    @Column(name = "text", nullable = false, length = 280)
    private String text;

    @Pattern(regexp = LIFE_AREA_PATTERN)
    @Size(max = 16)
    @Column(name = "life_area", length = 16)
    private String lifeArea;
}
