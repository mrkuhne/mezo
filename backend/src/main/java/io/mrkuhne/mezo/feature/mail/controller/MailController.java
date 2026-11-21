package io.mrkuhne.mezo.feature.mail.controller;

import io.mrkuhne.mezo.api.controller.MailApi;
import io.mrkuhne.mezo.api.dto.MailDigestResponse;
import io.mrkuhne.mezo.api.dto.MailFeedbackRequest;
import io.mrkuhne.mezo.api.dto.MailMailboxRequest;
import io.mrkuhne.mezo.api.dto.MailMailboxResponse;
import io.mrkuhne.mezo.api.dto.MailRulesRequest;
import io.mrkuhne.mezo.api.dto.MailRulesResponse;
import io.mrkuhne.mezo.feature.mail.config.MailProperties;
import io.mrkuhne.mezo.feature.mail.mapper.MailMapper;
import io.mrkuhne.mezo.feature.mail.service.MailDigestQuery;
import io.mrkuhne.mezo.feature.mail.service.MailLearning;
import io.mrkuhne.mezo.feature.mail.service.MailMailboxService;
import io.mrkuhne.mezo.feature.mail.service.MailRulesService;
import io.mrkuhne.mezo.feature.mail.service.Verdict;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** Boop Levél (mezo-r36n9.39, tag Mail) — thin delegation, the owner is always the principal. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailController implements MailApi {

    private final MailMailboxService mailbox;
    private final MailDigestQuery digestQuery;
    private final MailLearning learning;
    private final MailRulesService rules;
    private final MailMapper mapper;
    private final MailProperties properties;
    private final CurrentUserId currentUserId;
    private final ObjectProvider<Clock> clock;

    @Override
    public MailMailboxResponse getMailMailbox() {
        return mapper.mailbox(mailbox.get(currentUserId.get()));
    }

    @Override
    public MailMailboxResponse putMailMailbox(MailMailboxRequest request) {
        return mapper.mailbox(mailbox.connect(currentUserId.get(), request.getAddress().strip(),
            request.getAppPassword()));
    }

    @Override
    public MailMailboxResponse deleteMailMailbox() {
        return mapper.mailbox(mailbox.disconnect(currentUserId.get()));
    }

    @Override
    public void runMailMailbox() {
        mailbox.requestRun(currentUserId.get());
    }

    @Override
    public MailDigestResponse getMailDigest(LocalDate date) {
        Instant now = Instant.now(clock.getIfAvailable(Clock::systemUTC));
        LocalDate day = date != null ? date : now.atZone(ZoneId.of(properties.zone())).toLocalDate();
        return mapper.digest(digestQuery.digest(currentUserId.get(), day, now));
    }

    @Override
    public void postMailFeedback(UUID id, MailFeedbackRequest request) {
        Verdict verdict = "interest".equals(request.getVerdict()) ? Verdict.INTEREST : Verdict.NOPE;
        learning.feedback(currentUserId.get(), id, verdict);
    }

    @Override
    public MailRulesResponse getMailRules() {
        return mapper.rules(rules.get(currentUserId.get()));
    }

    @Override
    public MailRulesResponse putMailRules(MailRulesRequest request) {
        return mapper.rules(rules.replace(currentUserId.get(), request.getSensitive(), request.getSilent(),
            request.getAlways()));
    }
}
