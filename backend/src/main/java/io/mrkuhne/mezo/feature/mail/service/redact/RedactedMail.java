package io.mrkuhne.mezo.feature.mail.service.redact;

import java.util.List;

/**
 * A mail body reduced to what a model may see: masked, link-free visible text, the bare hosts the mail
 * linked to, and the raw schema.org JSON-LD blocks pulled out before sanitizing.
 *
 * <p>{@code jsonLd} is raw, unredacted markup for the local rules only; it must never be sent to a model.
 */
public record RedactedMail(String text, List<String> hosts, List<String> jsonLd) {

    public RedactedMail {
        text = text == null ? "" : text;
        hosts = hosts == null ? List.of() : List.copyOf(hosts);
        jsonLd = jsonLd == null ? List.of() : List.copyOf(jsonLd);
    }
}
