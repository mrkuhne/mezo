package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.util.Collection;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * S9 (mezo-d6ivw.10): once-ever memory for the weekly fact merge — a member set that was merged,
 * proposed, undone or rejected is never offered again (uq_fact_merge_ledger_member_key).
 */
@Getter
@Setter
@Entity
@Table(name = "fact_merge_ledger")
@SQLDelete(sql = "update fact_merge_ledger set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class FactMergeLedgerEntity extends OwnedEntity {

    public static final String KIND_AUTO = "auto";
    public static final String KIND_PROPOSAL = "proposal";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** {@link #keyOf(Collection)} of the member knowledge_fact ids — the once-ever dedupe key. */
    @NotNull
    @Size(max = 400)
    @Column(name = "member_key", nullable = false, length = 400)
    private String memberKey;

    /** Mirrors ck_fact_merge_ledger_kind — 'auto' = the weekly round auto-merged the members
     *  without asking, 'proposal' = it rode the candidate inbox as a merge proposal. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "auto|proposal")
    @Column(nullable = false, length = 16)
    private String kind;

    /** The {@code learned_fact} the proposal minted (kind='proposal' only); null for 'auto'. */
    @Column(name = "learned_fact_id", columnDefinition = "uuid")
    private UUID learnedFactId;

    public static String keyOf(Collection<UUID> ids) {
        return ids.stream().map(UUID::toString).sorted().collect(Collectors.joining(","));
    }
}
