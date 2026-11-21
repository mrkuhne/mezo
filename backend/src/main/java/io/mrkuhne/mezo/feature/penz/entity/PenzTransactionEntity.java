package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One money movement. {@code amountMinor} is in {@code currency}; {@code amountHufMinor} is its HUF twin, booked
 * ONCE at write time at the ECB rate of {@code date} and never re-derived ({@code fxRate}/{@code fxRateDate} are
 * null for HUF). A transfer is two rows (transfer_out + transfer_in) sharing {@code transferPairId}.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_transaction")
@SQLDelete(sql = "update penz_transaction set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzTransactionEntity extends OwnedEntity {

    public static final String KIND_EXPENSE = "expense";
    public static final String KIND_INCOME = "income";
    public static final String KIND_TRANSFER_OUT = "transfer_out";
    public static final String KIND_TRANSFER_IN = "transfer_in";
    public static final String KIND_INVEST_BUY = "invest_buy";
    public static final String KIND_INVEST_SELL = "invest_sell";
    public static final String SOURCE_SMS = "sms";
    public static final String SOURCE_MANUAL = "manual";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    /** expense | income | transfer_out | transfer_in | invest_buy | invest_sell. */
    @Column(name = "kind", nullable = false, length = 12)
    private String kind;

    @Column(name = "amount_minor", nullable = false)
    private long amountMinor;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "amount_huf_minor", nullable = false)
    private long amountHufMinor;

    @Column(name = "fx_rate", precision = 18, scale = 8)
    private BigDecimal fxRate;

    @Column(name = "fx_rate_date")
    private LocalDate fxRateDate;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "note", length = 500)
    private String note;

    /** manual | sms | recurring. */
    @Column(name = "source", nullable = false, length = 10)
    private String source = SOURCE_MANUAL;

    @Column(name = "needs_review", nullable = false)
    private boolean needsReview;

    @Column(name = "recurring_rule_id")
    private UUID recurringRuleId;

    @Column(name = "transfer_pair_id")
    private UUID transferPairId;

    @Column(name = "sms_message_id")
    private UUID smsMessageId;

    @Column(name = "client_ref")
    private UUID clientRef;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
