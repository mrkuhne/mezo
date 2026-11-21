package io.mrkuhne.mezo.feature.mail.mapper;

import io.mrkuhne.mezo.api.dto.MailDigestItem;
import io.mrkuhne.mezo.api.dto.MailDigestResponse;
import io.mrkuhne.mezo.api.dto.MailDigestRestGroup;
import io.mrkuhne.mezo.api.dto.MailMailboxResponse;
import io.mrkuhne.mezo.api.dto.MailRuleProposal;
import io.mrkuhne.mezo.api.dto.MailRuleRow;
import io.mrkuhne.mezo.api.dto.MailRulesResponse;
import io.mrkuhne.mezo.feature.mail.service.MailDigest;
import io.mrkuhne.mezo.feature.mail.service.MailLearning;
import io.mrkuhne.mezo.feature.mail.service.MailMailboxService;
import io.mrkuhne.mezo.feature.mail.service.MailRulesService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** The morning-post service shapes ↔ the {@code Mail} API shapes; every enum stays a plain string on the wire. */
@Mapper(componentModel = "spring")
public interface MailMapper {

    MailMailboxResponse mailbox(MailMailboxService.MailboxView v);

    @Mapping(target = "fromAddress", source = "fromAddr")
    @Mapping(target = "gmailMessageId", expression = "java(i.gmMsgid() == null ? null : String.valueOf(i.gmMsgid()))")
    MailDigestItem item(MailDigest.ItemView i);

    MailDigestRestGroup restGroup(MailDigest.RestGroup g);

    default MailDigestResponse digest(MailDigest d) {
        return new MailDigestResponse()
            .lastRunAt(offset(d.lastRunAt()))
            .mailboxState(d.mailboxState())
            .rulesOnly(d.rulesOnly())
            .rulesOnlyReason(d.rulesOnlyReason())
            .arrived(d.arrived())
            .worthAMinute(d.worthAMinute())
            .handled(d.handled())
            .heatSlots(Arrays.stream(d.heatSlots()).boxed().toList())
            .people(items(d.people()))
            .sensitive(items(d.sensitive()))
            .deadlines(items(d.deadlines()))
            .parcels(items(d.parcels()))
            .deals(items(d.deals()))
            .rest(d.rest().stream().map(this::restGroup).toList());
    }

    default List<MailDigestItem> items(List<MailDigest.ItemView> list) {
        return list.stream().map(this::item).toList();
    }

    MailRuleRow ruleRow(MailRulesService.Row r);

    @Mapping(target = "fromAddress", source = "fromAddr")
    MailRuleProposal proposal(MailLearning.SilentProposal p);

    default MailRulesResponse rules(MailRulesService.Rules r) {
        return new MailRulesResponse()
            .sensitive(r.sensitive().stream().map(this::ruleRow).toList())
            .silent(r.silent().stream().map(this::ruleRow).toList())
            .always(r.always().stream().map(this::ruleRow).toList())
            .proposals(r.proposals().stream().map(this::proposal).toList());
    }

    default OffsetDateTime offset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
