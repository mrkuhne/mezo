package io.mrkuhne.mezo.feature.mail.entity;

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

/** An owner sender rule (address or @domain). Seed lists live in code, not here. (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_sender_rule")
@SQLDelete(sql = "update mail_sender_rule set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailSenderRuleEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "pattern", nullable = false, length = 254)
    private String pattern;

    @Column(name = "kind", nullable = false, length = 10)
    private String kind;

    @Column(name = "origin", nullable = false, length = 8)
    private String origin;
}
