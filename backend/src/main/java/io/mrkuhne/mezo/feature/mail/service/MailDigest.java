package io.mrkuhne.mezo.feature.mail.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One day's morning post as the app shows it (spec §4.1, §10.1): counts, the heat strip, the four groups and the
 * rolling open items. Every number is counted from stored rows.
 *
 * @param lastRunAt     the mailbox's last run, null before the first.
 * @param mailboxState  {@code connected|auth_failed|silent|disconnected}.
 * @param rulesOnly     a run of that day could not use the model because the cap was hit or the model step failed.
 * @param rulesOnlyReason {@code cap|failure} when {@code rulesOnly}, else null. No model configured is neither.
 * @param arrived       messages INGESTED (fetched) that Budapest day — counts follow the fetch, not the Date header.
 * @param worthAMinute  people + sensitive + deadlines first seen that day + parcels changed that day + deals worth it.
 * @param handled       {@code arrived - worthAMinute}, never below zero.
 * @param heatSlots     twelve two-hour slots over the messages ingested that day, each by its received hour (Budapest).
 */
public record MailDigest(Instant lastRunAt, String mailboxState, boolean rulesOnly, String rulesOnlyReason,
                         int arrived, int worthAMinute,
                         int handled, int[] heatSlots, List<ItemView> people, List<ItemView> sensitive,
                         List<ItemView> deadlines, List<ItemView> parcels, List<ItemView> deals,
                         List<RestGroup> rest) {

    /**
     * A card. A sensitive card carries the sender only: {@code title} is the sender's name (or address) and
     * {@code summary} / {@code why} are empty — nothing from the mail's subject or body. {@code screen} is
     * {@code none|clean|flagged|unknown}; {@code flagged} (the UI warning) is true for {@code flagged} only, while
     * {@code none} / {@code unknown} (not checked) show no warning but are never notifiable.
     * {@code gmMsgid} is the Gmail message id for "Megnyitás a Gmailben".
     */
    public record ItemView(UUID id, String group, String category, String title, String summary, String why,
                           Integer score, Instant dueAt, Instant validUntil, Long amountMinor, String currency,
                           String carrier, String parcelState, Instant stateChangedAt, String screen, boolean flagged,
                           boolean notifiable, String fromName, String fromAddr, String via, Instant receivedAt,
                           Long gmMsgid) {
    }

    /** One folded "A többi" row: a category and how many mails it holds. */
    public record RestGroup(String category, int count) {
    }
}
