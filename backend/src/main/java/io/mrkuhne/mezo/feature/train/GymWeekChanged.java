package io.mrkuhne.mezo.feature.train;

import java.util.UUID;

/**
 * The owner's planned gym week was re-written: a new gym schedule ({@code GymScheduleService.replaceSchedule}, also
 * the season's slots) or the running block's template days re-arranged ({@code BlockDayArrangeService.apply}, the
 * season's Módosítás). Published synchronously in the writing transaction; the day-adjustment ledger (Boop B7 K3)
 * settles its live session moves against the new plan in the same transaction, so the very next read already sees
 * them right.
 */
public record GymWeekChanged(UUID userId) {
}
