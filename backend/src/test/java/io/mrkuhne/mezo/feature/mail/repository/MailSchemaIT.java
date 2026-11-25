package io.mrkuhne.mezo.feature.mail.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.mail.entity.MailItemEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.ResetDatabase;
import io.mrkuhne.mezo.support.populator.MailPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The morning-post schema (mezo-r36n9.38): the unique indexes that keep the pipeline idempotent, and the reset
 * covering every mail table. Not {@code @Transactional}: constraint violations need real commits, and the reset
 * is only meaningful against committed rows. Everything is invented.
 */
class MailSchemaIT extends AbstractIntegrationTest {

    private static final List<String> TABLES = List.of("mail_mailbox", "mail_folder_cursor", "mail_run",
        "mail_message", "mail_item", "mail_feedback", "mail_sender_rule");

    @Autowired private DatabasePopulator db;
    @Autowired private MailPopulator mail;
    @Autowired private ResetDatabase resetDatabase;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MailMailboxRepository mailboxes;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = db.populateUser("mail-" + UUID.randomUUID() + "@test.local");
    }

    @Test
    void testMailbox_shouldRejectASecondLiveMailboxForOneUser() {
        MailMailboxEntity first = mail.mailbox(owner);

        assertThatThrownBy(() -> mail.mailbox(owner)).isInstanceOf(DataIntegrityViolationException.class);

        jdbc.update("update mail_mailbox set is_deleted = true where id = ?", first.getId());
        assertThat(mail.mailbox(owner).getId()).isNotNull();
    }

    @Test
    void testMailbox_shouldSaveDisconnectedWithNullSecrets() {
        MailMailboxEntity e = mail.mailbox(owner);
        e.setSecretCipher(null);
        e.setSecretNonce(null);
        e.setState("disconnected");
        MailMailboxEntity saved = mailboxes.saveAndFlush(e);

        assertThat(saved.getSecretCipher()).isNull();
        assertThat(saved.getSecretNonce()).isNull();
        assertThat(jdbc.queryForObject("select state from mail_mailbox where id = ?", String.class, saved.getId()))
            .isEqualTo("disconnected");
    }

    @Test
    void testMessage_shouldRejectTheSameGmMsgidTwice_andAllowManyWithoutOne() {
        UUID mailbox = mail.mailbox(owner).getId();
        mail.message(owner, mailbox, 1234L);

        assertThatThrownBy(() -> mail.message(owner, mailbox, 1234L))
            .isInstanceOf(DataIntegrityViolationException.class);

        mail.message(owner, mailbox, null);
        mail.message(owner, mailbox, null);
        assertThat(jdbc.queryForObject("select count(*) from mail_message", Integer.class)).isEqualTo(3);
    }

    @Test
    void testMessage_shouldRejectTheSameContentHashTwice() {
        UUID mailbox = mail.mailbox(owner).getId();
        MailMessageEntity first = mail.message(owner, mailbox, 1L);
        MailMessageEntity second = mail.message(owner, mailbox, 2L);

        assertThatThrownBy(() -> jdbc.update("update mail_message set content_hash = ? where id = ?",
            first.getContentHash(), second.getId())).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testItem_shouldKeepOneRowPerParcel() {
        UUID mailbox = mail.mailbox(owner).getId();
        UUID m1 = mail.message(owner, mailbox, 1L).getId();
        UUID m2 = mail.message(owner, mailbox, 2L).getId();
        mail.item(owner, m1, "gls", "PKG-1");

        assertThatThrownBy(() -> mail.item(owner, m2, "gls", "PKG-1"))
            .isInstanceOf(DataIntegrityViolationException.class);
        MailItemEntity other = mail.item(owner, m2, "gls", "PKG-2");
        assertThat(other.getId()).isNotNull();
    }

    @Test
    void testResetDatabase_shouldTruncateAllSevenMailTables() {
        UUID mailbox = mail.mailbox(owner).getId();
        mail.cursor(owner, mailbox, "INBOX");
        mail.run(owner, mailbox);
        UUID message = mail.message(owner, mailbox, 9L).getId();
        UUID item = mail.item(owner, message, "gls", "PKG-9").getId();
        mail.feedback(owner, item, "nope");
        mail.senderRule(owner, "@example.test", "silent");
        for (String table : TABLES) {
            assertThat(jdbc.queryForObject("select count(*) from " + table, Integer.class)).as(table).isEqualTo(1);
        }

        resetDatabase.resetExceptMasterData();

        for (String table : TABLES) {
            assertThat(jdbc.queryForObject("select count(*) from " + table, Integer.class)).as(table).isZero();
        }
    }
}
