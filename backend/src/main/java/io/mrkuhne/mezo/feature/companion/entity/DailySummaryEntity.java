package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDate;
import java.util.UUID;

/**
 * One generated Hungarian past-tense narrative per finished day (V2.2, spec §7) — the primary
 * narrative unit the episodic memory embeds. Regenerable data: uniqueness is a PARTIAL index
 * ({@code uq_daily_summary_created_by_summary_date where is_deleted = false}), so soft-deleting
 * a summary lets the nightly job regenerate that day.
 */
@Getter
@Setter
@Entity
@Table(name = "daily_summary")
@SQLDelete(sql = "update daily_summary set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DailySummaryEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The finished day the narrative describes (never "today" — that is the V0.3 snapshot's job). */
    @NotNull
    @Column(name = "summary_date", nullable = false)
    private LocalDate summaryDate;

    /** LLM-generated past-tense Hungarian digest of the day's L0 data. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String narrative;
}
