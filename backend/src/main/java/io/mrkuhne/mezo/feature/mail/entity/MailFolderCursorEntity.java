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

/** Per-folder IMAP progress (UIDVALIDITY + last seen UID). (Boop Levél, mezo-r36n9.38). */
@Getter
@Setter
@Entity
@Table(name = "mail_folder_cursor")
@SQLDelete(sql = "update mail_folder_cursor set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MailFolderCursorEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "mailbox_id", nullable = false)
    private UUID mailboxId;

    @Column(name = "folder", nullable = false, length = 64)
    private String folder;

    @Column(name = "uidvalidity", nullable = false)
    private long uidvalidity;

    @Column(name = "last_uid", nullable = false)
    private long lastUid;
}
