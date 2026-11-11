package io.mrkuhne.mezo.feature.wearable.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** One device-calendar event of a day (Boop S2 snapshot, mezo-r36n9.2) — replaced per day, never edited. */
@Getter
@Setter
@Entity
@Table(name = "calendar_event")
public class CalendarEventEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** EventKit item id plus occurrence start (Boop B1, mezo-r36n9.11) — unique per owner. */
    @Column(name = "external_id", nullable = false, length = 200)
    private String externalId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    @Column(name = "calendar_name", length = 80)
    private String calendarName;
}
