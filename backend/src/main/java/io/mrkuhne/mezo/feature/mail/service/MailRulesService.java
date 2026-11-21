package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.mail.entity.MailSenderRuleEntity;
import io.mrkuhne.mezo.feature.mail.service.rules.SenderRule;
import io.mrkuhne.mezo.feature.mail.service.rules.SensitiveSeed;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** The sender rules of the caller: the seeded sensitive senders (code, read-only) plus his own, and the proposals. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailRulesService {

    public record Row(String pattern, String origin) {
    }

    public record Rules(List<Row> sensitive, List<Row> silent, List<Row> always,
                        List<MailLearning.SilentProposal> proposals) {
    }

    private final MailMailboxStore store;
    private final MailLearning learning;

    public Rules get(UUID owner) {
        List<Row> sensitive = new ArrayList<>(SensitiveSeed.DOMAINS.stream().map(d -> new Row("@" + d, "seed")).toList());
        List<Row> silent = new ArrayList<>();
        List<Row> always = new ArrayList<>();
        for (MailSenderRuleEntity r : store.ownerRules(owner)) {
            Row row = new Row(r.getPattern(), "owner");
            switch (r.getKind()) {
                case "sensitive" -> sensitive.add(row);
                case "silent" -> silent.add(row);
                default -> always.add(row);
            }
        }
        return new Rules(sensitive, silent, always, learning.proposals(owner));
    }

    /** Replaces the owner-origin rules (the contract already validated every pattern); the seed is never touched. */
    public Rules replace(UUID owner, List<String> sensitive, List<String> silent, List<String> always) {
        Map<SenderRule.Kind, List<String>> byKind = new EnumMap<>(SenderRule.Kind.class);
        byKind.put(SenderRule.Kind.SENSITIVE, sensitive);
        byKind.put(SenderRule.Kind.SILENT, silent);
        byKind.put(SenderRule.Kind.ALWAYS, always);
        store.replaceOwnerRules(owner, byKind);
        return get(owner);
    }
}
