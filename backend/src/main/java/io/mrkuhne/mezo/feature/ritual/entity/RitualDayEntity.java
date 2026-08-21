package io.mrkuhne.mezo.feature.ritual.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "ritual_day")
@SQLDelete(sql = "update ritual_day set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RitualDayEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "ritual_date", nullable = false)
    private LocalDate ritualDate;

    /** Null while the day is only reflected on — "closed" is `closed_at is not null` (mezo-b3pp.2). */
    @Column(name = "closed_at")
    private Instant closedAt;

    /** The evening's prose answer to „Milyen volt a napod valójában?" (W1.2) — nullable,
     *  skipping is first-class. Written by an upsert BEFORE the close; embedded on close. */
    @Column(name = "reflection_text", columnDefinition = "text")
    private String reflectionText;
}
