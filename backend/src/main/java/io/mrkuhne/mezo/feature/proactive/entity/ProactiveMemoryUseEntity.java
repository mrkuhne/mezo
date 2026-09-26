package io.mrkuhne.mezo.feature.proactive.entity;

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
 * The cooldown ledger for proactive memory use (Emlékezet S5, bd mezo-d6ivw.5): one row per
 * fired apropó, keyed by day + topic. Path-independent — works under both companion-feed
 * composer paths, unlike message-envelope refs, which the contextual path composes elsewhere.
 */
@Getter
@Setter
@Entity
@Table(name = "proactive_memory_use")
@SQLDelete(sql = "update proactive_memory_use set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ProactiveMemoryUseEntity extends OwnedEntity {

    /** Mirrors ck_proactive_memory_use_kind. */
    public static final String KIND_MORNING = "morning";
    public static final String KIND_MIDDAY = "midday";
    public static final String KIND_EVENING = "evening";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The day this apropó fired on. */
    @NotNull
    @Column(name = "used_on", nullable = false)
    private LocalDate usedOn;

    /** Which memory/topic this cooldown tracks. */
    @NotNull
    @Size(max = 64)
    @Column(name = "topic_key", nullable = false, length = 64)
    private String topicKey;

    /** Which feed slot fired it (morning/midday/evening). */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "morning|midday|evening")
    @Column(nullable = false, length = 16)
    private String kind;
}
