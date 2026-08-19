package io.mrkuhne.mezo.feature.journal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One row per free-prose journal entry (Phase 5 W1.1, bd mezo-b3pp.1, spec §4.1). Stories live
 * in vector space — this row is the source of truth; the embedding rides in {@code memory_embedding}.
 *
 * <p>{@code occurred_on} is the day the entry is ABOUT, not the day it was written.
 */
@Getter
@Setter
@Entity
@Table(name = "journal_entry")
@SQLDelete(sql = "update journal_entry set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class JournalEntryEntity extends OwnedEntity {

    public static final String SOURCE_QUICKINPUT = "quickinput";
    public static final String SOURCE_RITUAL = "ritual";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The day the entry is ABOUT (not when it was written). */
    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String text;

    /** Mirrors ck_journal_entry_source. */
    @NotNull
    @Size(max = 12)
    @Pattern(regexp = "quickinput|ritual")
    @Column(nullable = false, length = 12)
    private String source;
}
