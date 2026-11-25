package io.mrkuhne.mezo.feature.mail.service.classify;

import io.mrkuhne.mezo.feature.mail.service.rules.Group;
import io.mrkuhne.mezo.feature.mail.service.rules.ParcelState;
import java.time.Instant;

/** A model answer after {@code MailOutputValidator}: only fields the mail text carries; nullable ones may be null. */
public record ClassifiedMail(Group group, String category, String title, String summary, Instant dueAt,
        Instant validUntil, Long amountMinor, String currency, String carrier, ParcelState parcelState) {}
