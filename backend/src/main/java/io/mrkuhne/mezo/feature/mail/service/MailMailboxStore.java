package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.entity.MailMailboxEntity;
import io.mrkuhne.mezo.feature.mail.entity.MailSenderRuleEntity;
import io.mrkuhne.mezo.feature.mail.repository.MailFolderCursorRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailMailboxRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailRunRepository;
import io.mrkuhne.mezo.feature.mail.repository.MailSenderRuleRepository;
import io.mrkuhne.mezo.feature.mail.entity.MailRunEntity;
import io.mrkuhne.mezo.feature.mail.service.rules.SenderRule;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Short writes of the mailbox row and the owner's sender rules (the IMAP check happens before, outside). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailMailboxStore {

    private final MailMailboxRepository mailboxes;
    private final MailFolderCursorRepository cursors;
    private final MailRunRepository runs;
    private final MailSenderRuleRepository senderRules;

    @Transactional(readOnly = true)
    public Optional<MailMailboxEntity> find(UUID owner) {
        return mailboxes.findByCreatedBy(owner);
    }

    @Transactional(readOnly = true)
    public Optional<MailRunEntity> latestRun(UUID owner) {
        return runs.findFirstByCreatedByOrderByStartedAtDesc(owner);
    }

    /**
     * Stores a verified mailbox: reuses the owner's row (one live mailbox per user), seals state {@code connected},
     * streak 0. A different address drops the old folder cursors (they belong to another mailbox).
     */
    @Transactional
    public MailMailboxEntity connect(UUID owner, String address, MailCredentialCipher.Sealed sealed) {
        MailMailboxEntity m = mailboxes.findByCreatedBy(owner).orElseGet(() -> {
            MailMailboxEntity e = new MailMailboxEntity();
            e.setCreatedBy(owner);
            return e;
        });
        if (m.getId() != null && !address.equalsIgnoreCase(m.getAddress())) {
            cursors.deleteAll(cursors.findByMailboxId(m.getId()));
            m.setLastRunAt(null);
        }
        m.setAddress(address);
        m.setSecretCipher(sealed.cipher());
        m.setSecretNonce(sealed.nonce());
        m.setState(MailIntakeStore.STATE_CONNECTED);
        m.setZeroRunStreak(0);
        return mailboxes.saveAndFlush(m);
    }

    /** Disconnects: state {@code disconnected}, both secret columns emptied, the row (and its history) kept. */
    @Transactional
    public Optional<MailMailboxEntity> disconnect(UUID owner) {
        return mailboxes.findByCreatedBy(owner).map(m -> {
            m.setSecretCipher(null);
            m.setSecretNonce(null);
            m.setState(MailIntakeStore.STATE_DISCONNECTED);
            m.setZeroRunStreak(0);
            return mailboxes.saveAndFlush(m);
        });
    }

    /** The owner-origin rules only (the seed lives in code). */
    @Transactional(readOnly = true)
    public List<MailSenderRuleEntity> ownerRules(UUID owner) {
        return senderRules.findByCreatedBy(owner).stream().filter(r -> "owner".equals(r.getOrigin())).toList();
    }

    /** Replaces the owner's rules: every old owner row goes, the new patterns (lower-cased, de-duplicated) come in. */
    @Transactional
    public void replaceOwnerRules(UUID owner, Map<SenderRule.Kind, List<String>> patterns) {
        senderRules.deleteAll(ownerRules(owner));
        senderRules.flush();
        patterns.forEach((kind, list) -> list.stream().map(p -> p.strip().toLowerCase(Locale.ROOT)).distinct()
            .forEach(p -> {
                MailSenderRuleEntity e = new MailSenderRuleEntity();
                e.setCreatedBy(owner);
                e.setPattern(p);
                e.setKind(kind.name().toLowerCase(Locale.ROOT));
                e.setOrigin("owner");
                senderRules.save(e);
            }));
        senderRules.flush();
    }
}
