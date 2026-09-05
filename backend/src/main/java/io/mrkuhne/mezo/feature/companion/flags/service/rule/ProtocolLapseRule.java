package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)): a protocol item missed on
 * {@code consecutiveMissedDays} consecutive DUE days, but only where a real habit existed first.
 * There is NO stored schedule — "was this item due on day X" is derived, and the derivation is
 * copied verbatim from {@code StackSkipPatternDetector.expectedOn} (character), not shared: a
 * fuel-domain rule and a companion-domain rule each keep their own copy of one predicate rather
 * than forcing a shared helper across a third feature boundary. The two copies name each other in
 * their javadoc.
 *
 * <p><b>Trap 1 — the peri-workout due-day gate.</b> {@link #dueOn} treats a
 * {@code pre_workout}/{@code post_workout} item as due ONLY on a day with a completed gym
 * instance ({@code WorkoutSessionRepository.findDoneInstanceDates}); on a rest day it is not a
 * miss, it either displaces to its {@code restDayFallback} zone or is deliberately dropped. Every
 * other item is due every day. Proven by
 * {@code stays_silent_when_the_missed_days_were_rest_days_for_a_peri_workout_item}: two
 * trainingless days on a {@code post_workout} item never accumulate a miss run at all, because
 * they are never DUE in the first place.
 *
 * <p><b>Trap 2 — the {@code startedOn} lower bound.</b> Both the miss-run walk and the
 * prior-habit walk are bounded below by the item's own {@code created_at}
 * ({@link ProtocolItemEntity#getCreatedAt()}, converted to the system-zone local date): an item
 * added to the protocol yesterday cannot have "missed" a habit from last month. Proven by
 * {@code stays_silent_when_the_item_is_too_new_to_have_a_habit} — a 3-day-old item misses its
 * last two due days, which alone would clear the miss-run gate, but the history window it is
 * clamped to has fewer than {@code minHistoryDueDays} due days behind it, so the rule stays
 * silent rather than fabricating a habit that never had room to exist.
 *
 * <p><b>Trap 3 — the window ends YESTERDAY, not today.</b> {@code to = today.minusDays(1)}: today
 * is still in progress, so an evening supplement with nothing logged yet today is not "missed" —
 * it may still be taken before the day ends (same reasoning as {@code MissedWorkoutsRule}'s
 * window). Proven by {@code stays_silent_when_only_today_is_missing}: an item taken every day
 * through yesterday, with today's dose not yet logged, never enters the scan at all.
 *
 * <p><b>Per-item cooldown.</b> {@code FlagService}'s cooldown gate is per FLAG KEY, so once
 * {@code protocol_lapse} raises for one item, the key-level cooldown would silently suppress a
 * genuine, different item's lapse for the same window. The spec's cooldown is per ITEM, which
 * only this rule can enforce: it reads its own past raises
 * ({@link CompanionFlagLogRepository#findByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc})
 * since {@code perItemCooldownDays} ago, collects each row's frozen
 * {@code payload().protocolLapse().pantryItemId()}, and skips any protocol item whose id is in
 * that set before it is ever evaluated — so a suppressed item can never even become the
 * offender, and a different item is untouched by it.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ProtocolLapseRule implements FlagRule {

    /** Copied from {@code StackSkipPatternDetector.expectedOn} (character), on purpose and not
     *  shared: a peri-workout item on a rest day is not a miss — it either displaces to its
     *  {@code restDayFallback} zone or is deliberately dropped. Extracting a shared helper would
     *  put a fuel-domain rule in a third feature; the duplication is one predicate and both copies
     *  name each other. */
    private static final Set<String> PERI_WORKOUT_ZONES = Set.of("pre_workout", "post_workout");

    private static final String DEFAULT_NAME = "ismeretlen kiegészítő";

    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository protocolItemRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final CompanionFlagLogRepository companionFlagLogRepository;
    private final PantryItemRepository pantryItemRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.ProtocolLapse cfg = properties.protocolLapse();

        Optional<ProtocolEntity> protocolOpt =
            protocolRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active");
        if (protocolOpt.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.PROTOCOL_LAPSE, UnavailableReason.NO_ACTIVE_PROTOCOL);
        }
        List<ProtocolItemEntity> items = protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocolOpt.get().getId());
        if (items.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.PROTOCOL_LAPSE, UnavailableReason.NO_PROTOCOL_ITEMS);
        }

        // The window ends YESTERDAY, not today — today is still in progress (Trap 3).
        LocalDate to = today.minusDays(1);
        // Widened past a single historyWindowDays (review fix, bd mezo-d58h.7.1): the miss-run walk
        // does NOT stop at consecutiveMissedDays — it keeps walking until it hits a taken due day or
        // startedOn, so a genuine run of length k > consecutiveMissedDays pushes historyEnd (the last
        // due day strictly before the run) and therefore historyStart that much further into the
        // past. Sizing `from` only for the THRESHOLD run length silently truncated takenByDate/
        // gymDates before historyStart for any longer run, understating adherence (never causing a
        // false raise, but able to hide a genuine one). Doubling historyWindowDays covers any run up
        // to that same length before the loaded window would need to widen further — comfortably past
        // what a real "was there a habit" question needs, while keeping the query bounded (not the
        // "load everything" this in-memory-upper-bound trick exists to avoid).
        LocalDate from = to.minusDays(2L * cfg.historyWindowDays() + cfg.consecutiveMissedDays());

        Set<LocalDate> gymDates =
            Set.copyOf(workoutSessionRepository.findDoneInstanceDates(userId, from, to));

        Map<LocalDate, Set<UUID>> takenByDate = new HashMap<>();
        for (SupplementIntakeEntity si : supplementIntakeRepository
                .findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(
                    userId, from)) {
            if (si.getTakenDate().isAfter(to)) {
                continue; // catch-up upper bound (the finder only bounds below) — CharacterSignalReads.gatherStack precedent
            }
            takenByDate.computeIfAbsent(si.getTakenDate(), d -> new HashSet<>()).add(si.getPantryItemId());
        }

        Set<String> suppressedItemIds = suppressedItemIds(userId, cfg.perItemCooldownDays());

        Offender best = null;
        int longestMissRunSeen = 0;
        boolean anyItemLackedHistory = false;
        for (ProtocolItemEntity item : items) {
            if (suppressedItemIds.contains(item.getPantryItemId().toString())) {
                continue;
            }
            if (item.getCreatedAt() == null) {
                continue;
            }
            LocalDate startedOn = item.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
            // Whole-branch review fix (bd mezo-d58h.7.1): the walk's own lower bound is clamped to
            // `from` too — `startedOn` alone stays correct in MEANING (Trap 2 is unchanged), but for
            // an item added long before `from` the loop would otherwise keep walking below the data
            // actually loaded (takenByDate/gymDates only cover [from, to]) and read every such day as
            // "missed" (or "not due" for peri items) purely because nothing was loaded for it — never
            // fabricating a raise (adherence still computes to ~0 and the item is dropped), just
            // wasted work walking years of unloaded history on every evaluation.
            LocalDate walkFloor = startedOn.isAfter(from) ? startedOn : from;

            // Miss run: walk backwards from `to`, skipping non-due days entirely, stopping at the
            // first due day that HAS an intake, or when the day drops below startedOn (Trap 2).
            List<LocalDate> missedDueDates = new ArrayList<>();
            LocalDate lastTaken = null;
            LocalDate earliestMissedDay = null;
            for (LocalDate d = to; !d.isBefore(walkFloor); d = d.minusDays(1)) {
                if (!dueOn(item, d, gymDates)) {
                    continue;
                }
                if (takenByDate.getOrDefault(d, Set.of()).contains(item.getPantryItemId())) {
                    lastTaken = d;
                    break;
                }
                missedDueDates.add(0, d);
                earliestMissedDay = d;
            }
            int consecutiveMissed = missedDueDates.size();
            longestMissRunSeen = Math.max(longestMissRunSeen, consecutiveMissed);
            if (consecutiveMissed < cfg.consecutiveMissedDays()) {
                continue;
            }

            // Prior habit: the last due day strictly before the miss run's earliest missed day,
            // walked back to the history window (clamped to startedOn), requiring both enough due
            // days and enough adherence for a real habit to have existed.
            LocalDate historyEnd = null;
            for (LocalDate d = earliestMissedDay.minusDays(1); !d.isBefore(walkFloor); d = d.minusDays(1)) {
                if (dueOn(item, d, gymDates)) {
                    historyEnd = d;
                    break;
                }
            }
            if (historyEnd == null) {
                // Too new / never due before the run — an honesty gate, not a judgement: there is
                // simply not enough history behind this item to say whether a habit existed.
                anyItemLackedHistory = true;
                continue;
            }
            LocalDate historyStart = historyEnd.minusDays((long) cfg.historyWindowDays() - 1);
            if (historyStart.isBefore(startedOn)) {
                historyStart = startedOn;
            }
            int historyDue = 0;
            int historyTaken = 0;
            for (LocalDate d = historyEnd; !d.isBefore(historyStart); d = d.minusDays(1)) {
                if (!dueOn(item, d, gymDates)) {
                    continue;
                }
                historyDue++;
                if (takenByDate.getOrDefault(d, Set.of()).contains(item.getPantryItemId())) {
                    historyTaken++;
                }
            }
            if (historyDue < cfg.minHistoryDueDays()) {
                // Same honesty gate as above, reached via too few DUE days rather than none at all
                // (e.g. an item added recently, clamped to startedOn before the window filled up).
                anyItemLackedHistory = true;
                continue;
            }
            double adherence = (double) historyTaken / historyDue;
            if (adherence < cfg.minHistoryAdherence()) {
                // Enough history existed, and it was judged: adherence before the miss run was
                // already too low for a real habit to have existed — genuinely CLEAR, not a gate.
                continue;
            }

            // Offender: the qualifying item with the longest miss run; tie-break the LOWER
            // item_order (iteration is already in that order, so a strict '>' keeps the first).
            if (best == null || consecutiveMissed > best.consecutiveMissed()) {
                best = new Offender(item, consecutiveMissed, missedDueDates, lastTaken,
                    historyDue, historyTaken, adherence);
            }
        }

        if (best != null) {
            Map<UUID, String> names = new HashMap<>();
            for (PantryItemEntity p : pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
                names.put(p.getId(), p.getCatalog().getName());
            }
            String itemName = names.getOrDefault(best.item().getPantryItemId(), DEFAULT_NAME);

            return FlagVerdict.raised(FlagKey.PROTOCOL_LAPSE,
                FlagPayloadEnvelope.protocolLapse(new FlagPayloadEnvelope.ProtocolLapse(
                    best.item().getPantryItemId().toString(), itemName, best.item().getSlotKey(),
                    best.consecutiveMissed(), cfg.consecutiveMissedDays(),
                    best.missedDueDates().stream().map(LocalDate::toString).toList(),
                    best.lastTaken() == null ? null : best.lastTaken().toString(),
                    best.historyDue(), best.historyTaken(), best.adherence(), cfg.minHistoryAdherence())));
        }

        // No offender: either no item's miss run reached the threshold at all (the ordinary quiet
        // case), or at least one did but there was not enough due-day history behind it to judge —
        // an honesty gate, since "no genuine habit" and "cannot tell if there was one" are different
        // claims (adherence-below-threshold items above are already folded into this same CLEAR,
        // since that gate genuinely judged and found insufficient signal, unlike this one).
        if (anyItemLackedHistory) {
            return FlagVerdict.unavailable(FlagKey.PROTOCOL_LAPSE,
                UnavailableReason.NOT_ENOUGH_PROTOCOL_HISTORY);
        }
        return FlagVerdict.clear(FlagKey.PROTOCOL_LAPSE, new FlagVerdict.ClearEvidence(
            "consecutive_missed", (double) longestMissRunSeen, (double) cfg.consecutiveMissedDays(),
            null));
    }

    /** The offending pantry item ids already announced inside the per-item cooldown — read from
     *  this rule's own frozen past payloads, null-safe on both the payload shape and the field. */
    private Set<String> suppressedItemIds(UUID userId, int perItemCooldownDays) {
        Instant since = Instant.now().minus(perItemCooldownDays, ChronoUnit.DAYS);
        Set<String> suppressed = new HashSet<>();
        for (CompanionFlagLogEntity log : companionFlagLogRepository
                .findByCreatedByAndFlagKeyAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                    userId, FlagKey.PROTOCOL_LAPSE, since)) {
            FlagPayloadEnvelope payload = log.getPayload();
            FlagPayloadEnvelope.ProtocolLapse p = payload == null ? null : payload.protocolLapse();
            if (p != null && p.pantryItemId() != null) {
                suppressed.add(p.pantryItemId());
            }
        }
        return suppressed;
    }

    private record Offender(
        ProtocolItemEntity item, int consecutiveMissed, List<LocalDate> missedDueDates,
        LocalDate lastTaken, int historyDue, int historyTaken, double adherence) {
    }

    /** Copied from {@code StackSkipPatternDetector.expectedOn} (character), on purpose and not
     *  shared: a peri-workout item on a rest day is not a miss — it either displaces to its
     *  {@code restDayFallback} zone or is deliberately dropped. Extracting a shared helper would
     *  put a fuel-domain rule in a third feature; the duplication is one predicate and both copies
     *  name each other. */
    private static boolean dueOn(ProtocolItemEntity item, LocalDate date, Set<LocalDate> gymDates) {
        if (item.getSlotKey() != null && PERI_WORKOUT_ZONES.contains(item.getSlotKey())) {
            return gymDates.contains(date);
        }
        return true;
    }
}
