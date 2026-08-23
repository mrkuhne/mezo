package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDate;
import java.util.UUID;

/**
 * One rung of the W3.2 consolidation ladder (bd mezo-b3pp.13, spec §4.3/§7.2): a condensed
 * narrative over a finished WEEK (from that week's {@code daily_summary} rows) or a finished
 * MONTH (from that month's {@code week} rows). Identity is
 * {@code (created_by, granularity, period_start)} — {@code period_start} is the ISO Monday for a
 * week and the first of the month for a month, so a period can never be summarized twice.
 *
 * <p>The ladder SHADOWS the fine-grained memory in ambient recall, it never deletes it: the daily
 * rows and their vectors stay in the store untouched (spec §12), and {@code PromptMemoryAssembler}
 * simply stops asking for daily hits older than the coverage cutoff.
 */
@Getter
@Setter
@Entity
@Table(name = "period_summary", uniqueConstraints =
    @UniqueConstraint(name = "uq_period_summary", columnNames = {"created_by", "granularity", "period_start"}))
@SQLDelete(sql = "update period_summary set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PeriodSummaryEntity extends OwnedEntity {

    /** ISO week, keyed by its Monday. */
    public static final String GRANULARITY_WEEK = "week";
    /** Calendar month, keyed by its first day. */
    public static final String GRANULARITY_MONTH = "month";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_period_summary_granularity. */
    @NotNull
    @Size(max = 5)
    @Pattern(regexp = "week|month")
    @Column(nullable = false, length = 5)
    private String granularity;

    /** ISO Monday (week) / first of the month (month) — the period's identity, not its end. */
    @NotNull
    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    /** The condensed narrative — the text that gets embedded as weekly_summary / monthly_summary. */
    @NotBlank
    @Column(name = "summary_text", nullable = false, columnDefinition = "text")
    private String summaryText;
}
