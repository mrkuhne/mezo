package io.mrkuhne.mezo.feature.people.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * S3 (mezo-d6ivw.3): egy normalizált, forrás-hivatkozott tény egy ismert személyről. Az
 * {@code active} flag a visszavonás/nyugdíjazás célpontja (a soft delete-et csak a hub teljes
 * törlése használja majd, S6); egy inaktív sor normalizált szövege tartós vétó — a capture soha
 * nem menti újra. A legacy {@code person.known_facts} tömb read-only seed-adat marad.
 */
@Getter
@Setter
@Entity
@Table(name = "person_fact")
@SQLDelete(sql = "update person_fact set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PersonFactEntity extends OwnedEntity {

    public static final String KIND_PREFERENCE = "preference";
    public static final String KIND_RELATIONSHIP_STATE = "relationship_state";
    public static final String KIND_SHARED_ACTIVITY = "shared_activity";
    public static final String KIND_IMPORTANT_DATE = "important_date";
    public static final String KIND_SENSITIVITY = "sensitivity";
    public static final Set<String> KINDS = Set.of(KIND_PREFERENCE, KIND_RELATIONSHIP_STATE,
        KIND_SHARED_ACTIVITY, KIND_IMPORTANT_DATE, KIND_SENSITIVITY);
    /** Supersede-not-append: új azonos-fajta tény ugyanarról a személyről a régit deaktiválja. */
    public static final Set<String> VOLATILE_KINDS = Set.of(KIND_RELATIONSHIP_STATE);
    public static final String SOURCE_CHAT_TURN = "chat_turn";
    public static final String SOURCE_NIGHTLY_DAY = "nightly_day";
    public static final int FACT_TEXT_MAX_CHARS = 300;

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(name = "person_id", nullable = false, columnDefinition = "uuid") private UUID personId;
    @NotNull @Column(nullable = false) private String kind;
    @NotNull @Column(name = "fact_text", nullable = false) private String factText;
    @NotNull @Column(nullable = false) private String confidence; // low|medium|high (DB CHECK)
    @NotNull @Column(name = "source_ref_kind", nullable = false) private String sourceRefKind;
    @NotNull @Column(name = "source_ref_id", nullable = false) private String sourceRefId;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "include_in_prompt", nullable = false) private boolean includeInPrompt = true;
    @Column(name = "seen_at") private Instant seenAt;
}
