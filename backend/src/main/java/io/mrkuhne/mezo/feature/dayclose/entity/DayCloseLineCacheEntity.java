package io.mrkuhne.mezo.feature.dayclose.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A Boop one-liner that has no {@code day_close} row to live on — the line after a check-in, or the line of a
 * day closed on the web — keyed by the hash of everything its prompt was built from (B3, mezo-r36n9.13).
 */
@Getter
@Setter
@Entity
@Table(name = "day_close_line_cache")
@SQLDelete(sql = "update day_close_line_cache set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DayCloseLineCacheEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "input_hash", nullable = false, length = 64)
    private String inputHash;

    @Column(nullable = false, columnDefinition = "text")
    private String line;
}
