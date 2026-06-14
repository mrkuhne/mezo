package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A running "Terv" — the interval-plan block, mirroring {@link MesocycleEntity}. The
 * week→session→segment tree is typed jsonb ({@link RunningBlockStructure}). Lifecycle
 * status planned|active|archived; at most one active per owner (enforced in service).
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "running_block")
@SQLDelete(sql = "update running_block set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RunningBlockEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String title;

    @Column
    private String goal;

    @NotNull
    @Column(nullable = false)
    private String kind = "interval"; // DB CHECK

    @NotNull
    @Column(nullable = false)
    private String status; // planned|active|archived (DB CHECK)

    @NotNull
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @NotNull
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @NotNull
    @Column(nullable = false)
    private Integer weeks;

    @NotNull
    @Column(name = "current_week", nullable = false)
    private Integer currentWeek = 0;

    @Column
    private String summary;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private RunningBlockStructure structure;
}
