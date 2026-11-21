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
 * @param rulesOnly     a run of that day could not use the model (cap hit or model down).
 * @param arrived       messages received that Budapest day.
 * @param worthAMinute  people + sensitive + deadlines first seen that day + parcels changed that day + deals worth it.
 * @param handled       {@code arrived - worthAMinute}, never below zero.
 * @param heatSlots     twelve two-hour slots of that day, by received time (Budapest).
 */
public record MailDigest(Instant lastRunAt, String mailboxState, boolean rulesOnly, int arrived, int worthAMinute,
                         int handled, int[] heatSlots, List<ItemView> people, List<ItemView> sensitive,
                         List<ItemView> deadlines, List<ItemView> parcels, List<ItemView> deals,
                         List<RestGroup> rest) {

    /**
     * A card. A sensitive card carries the sender only: {@code title} is the sender's name (or address) and
     * {@code summary} / {@code why} are empty — nothing from the mail's subject or body. {@code flagged} means the
     * phishing / injection screen flagged it or could not clear it (a warning is shown; never notifiable).
     * {@code gmMsgid} is the Gmail message id for "Megnyitás a Gmailben".
     */
    public record ItemView(UUID id, String group, String category, String title, String summary, String why,
                           Integer score, Instant dueAt, Instant validUntil, Long amountMinor, String currency,
                           String carrier, String parcelState, Instant stateChangedAt, boolean flagged,
                           boolean notifiable, String fromName, String fromAddr, String via, Instant receivedAt,
                           Long gmMsgid) {
    }

    /** One folded "A többi" row: a category and how many mails it holds. */
    public record RestGroup(String category, int count) {
    }
}
