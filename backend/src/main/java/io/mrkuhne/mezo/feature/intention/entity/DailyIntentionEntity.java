package io.mrkuhne.mezo.feature.intention.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The holistic evening reflection — one live row per owner × day (partial-unique). */
@Getter
@Setter
@Entity
@Table(name = "daily_intention")
@SQLDelete(sql = "update daily_intention set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DailyIntentionEntity extends OwnedEntity {

    public static final String REFLECTION_YES = "yes";
    public static final String REFLECTION_PARTIAL = "partial";
    public static final String REFLECTION_NO = "no";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "intention_date", nullable = false)
    private LocalDate intentionDate;

    @Column(nullable = false, length = 8)
    private String reflection;
}
