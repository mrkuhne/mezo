package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** A money account; {@code openingBalanceMinor} is in the account's own currency. Date-less: bespoke finders. */
@Getter
@Setter
@Entity
@Table(name = "penz_account")
@SQLDelete(sql = "update penz_account set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzAccountEntity extends OwnedEntity {

    public static final String TYPE_SAVINGS = "savings";
    public static final String TYPE_CHECKING = "checking";
    public static final String TYPE_CASH = "cash";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    /** checking | savings | cash | investment. */
    @Column(name = "type", nullable = false, length = 12)
    private String type;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "opening_balance_minor", nullable = false)
    private long openingBalanceMinor;

    @Column(name = "is_default", nullable = false)
    private boolean defaultAccount;

    @Column(name = "is_savings_target", nullable = false)
    private boolean savingsTarget;

    @Column(name = "archived", nullable = false)
    private boolean archived;

    /** The bank's SMS sender name an ingested SMS is matched to this account by. */
    @Column(name = "sms_sender", length = 100)
    private String smsSender;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
