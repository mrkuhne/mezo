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

/** One daily focus (up to a configured cap per day). Ordered by creation within a day. */
@Getter
@Setter
@Entity
@Table(name = "intention_focus")
@SQLDelete(sql = "update intention_focus set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class IntentionFocusEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "focus_date", nullable = false)
    private LocalDate focusDate;

    @Column(nullable = false, length = 200)
    private String text;
}
