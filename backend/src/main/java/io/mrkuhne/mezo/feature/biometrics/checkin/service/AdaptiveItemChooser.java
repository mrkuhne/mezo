package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.config.CheckInPlanProperties;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Picks the question of the day (mezo-ck2, spec §2.3) — pure: no I/O, the caller hands in the
 * answer counts, the wanted items and a seeded {@link Random}, so the same inputs always give the
 * same pick.
 *
 * <ul>
 *   <li><b>Pool:</b> non-core items not already in the slot's plan and meaningful in that slot
 *       ({@code only-in-slot}: rested → morning, day → evening).</li>
 *   <li><b>Choice:</b> with probability {@code random-share} a uniform random pool item
 *       ({@link Reason#RANDOM}); otherwise the wanted pool item with the fewest non-null answers
 *       ({@link Reason#NEED}, ties broken by the RNG). No wanted item in the pool → random.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class AdaptiveItemChooser {

    /** Why an item was chosen (mirrors the contract's {@code AdaptiveReason}). */
    public enum Reason { NEED, RANDOM }

    /** The chosen item and why. */
    public record Choice(CheckInItem item, Reason reason) {}

    private final CheckInPlanProperties properties;

    /**
     * @param slotTime     the slot ("06:30")
     * @param slotItems    the slot's configured plan
     * @param answerCounts non-null answers per item in the need window (missing = 0)
     * @param wanted       items some consumer waits on ({@link CheckInNeedSource} union)
     * @param rng          seeded per (user, date, slot) by the caller
     * @return the pick, or empty when the pool is empty
     */
    public Optional<Choice> choose(String slotTime, Collection<CheckInItem> slotItems,
                                   Map<CheckInItem, Long> answerCounts, Set<CheckInItem> wanted,
                                   Random rng) {
        List<CheckInItem> pool = pool(slotTime, slotItems);
        if (pool.isEmpty()) {
            return Optional.empty();
        }
        // Always draw first so the RNG stream (and thus the pick) does not depend on the branch.
        boolean randomDraw = rng.nextDouble() < properties.adaptive().randomShare();
        List<CheckInItem> needPool = pool.stream().filter(wanted::contains).toList();
        if (randomDraw || needPool.isEmpty()) {
            return Optional.of(new Choice(pool.get(rng.nextInt(pool.size())), Reason.RANDOM));
        }
        long min = needPool.stream().mapToLong(i -> answerCounts.getOrDefault(i, 0L)).min().orElseThrow();
        List<CheckInItem> thinnest = needPool.stream()
            .filter(i -> answerCounts.getOrDefault(i, 0L) == min)
            .toList();
        return Optional.of(new Choice(thinnest.get(rng.nextInt(thinnest.size())), Reason.NEED));
    }

    /** Candidate items for {@code slotTime}, in declaration order (deterministic). */
    public List<CheckInItem> pool(String slotTime, Collection<CheckInItem> slotItems) {
        Map<CheckInItem, String> onlyInSlot = properties.adaptive().onlyInSlot();
        return Arrays.stream(CheckInItem.values())
            .filter(i -> !i.core())
            .filter(i -> !slotItems.contains(i))
            .filter(i -> !onlyInSlot.containsKey(i) || onlyInSlot.get(i).equals(slotTime))
            .sorted(Comparator.comparingInt(Enum::ordinal))
            .toList();
    }

    /** The one-line Hungarian "why" shown under "A NAP KÉRDÉSE". */
    public String why(Choice choice) {
        return choice.reason() == Reason.NEED
            ? properties.adaptive().whyNeed().replace("{item}", choice.item().whyPhrase())
            : properties.adaptive().whyRandom();
    }
}
