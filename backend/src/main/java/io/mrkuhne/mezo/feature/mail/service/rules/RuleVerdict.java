package io.mrkuhne.mezo.feature.mail.service.rules;

import java.util.Map;

/** What the rules decided, without any model. */
public sealed interface RuleVerdict {

    /** Sensitive sender or login code: headers only, never read by a model. */
    record Sensitive(String rule) implements RuleVerdict {}

    /** A shipping notification; {@code key} identifies the parcel (tracking number or stable hash). */
    record Parcel(String carrier, String key, ParcelState state) implements RuleVerdict {}

    /** Fields filled straight from schema.org JSON-LD. */
    record Structured(Group group, Map<String, String> fields) implements RuleVerdict {}

    /** Newsletter, social or silenced sender: lands in "A többi" under a category. */
    record Rest(String category) implements RuleVerdict {}

    /** A real person wrote. */
    record Person() implements RuleVerdict {}

    /** Rules cannot tell: a cheap model classifies it. */
    record NeedsModel(boolean bulk) implements RuleVerdict {}
}
