package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The seed import half of {@link HabitCatalogService}, split into its own bean for ONE reason
 * (mezo-5jly): {@code REQUIRES_NEW} only takes effect through Spring's proxy, so a same-bean call
 * would silently run in the caller's transaction and defeat the whole point.
 *
 * <p><b>Why a separate transaction at all.</b> Two first-touches for the same user race here (the
 * app opening on two surfaces, a read racing the nightly cron). The loser's insert hits the unique
 * index, and on Postgres a constraint violation aborts the WHOLE transaction (SQLSTATE 25P02) —
 * every later statement on that connection fails, including the recovery read. The previous guard
 * caught the violation and re-read in the same transaction, which cannot work by construction;
 * {@code TxRaceGuardReproIT} pins the mechanism. Running the bootstrap in its own transaction
 * confines the damage: the inner transaction rolls back alone and the caller's transaction — which
 * never issued the failing statement — stays clean and can read the winner's rows.
 *
 * <p><b>Why not ON CONFLICT here,</b> as the single-table sites use? This seeds two tables in a
 * chain: {@code habit_def} rows carry the {@code chain_id} of the {@code habit_chain} row inserted
 * moments earlier, and a def has ~13 columns sourced from the seed JSON. Expressing that as native
 * upserts would mean restating the entire def mapping in SQL and keeping it in sync with the
 * entity by hand — a worse trade than one extra transaction on a once-per-user path.
 *
 * <p><b>The one consequence to know:</b> on success this commits independently of the caller. If
 * the caller's transaction later rolls back, the seeded catalog stays. That is acceptable precisely
 * because it is idempotent seed data — a later call re-reads it rather than re-creating it — but it
 * would NOT be acceptable for anything carrying user intent.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitCatalogBootstrapper {

    /** chainKey, title, daypart, position — continuity keys match the retired enum values. */
    private record SeedChain(String key, String title, String daypart, int position) {}

    private static final List<SeedChain> SEED_CHAINS = List.of(
        new SeedChain("MORNING", "Reggeli rutin", HabitChainEntity.DAYPART_MORNING, 1),
        new SeedChain("EVENING", "Esti rutin", HabitChainEntity.DAYPART_EVENING, 2));

    private final HabitChainRepository chainRepository;
    private final HabitDefRepository defRepository;
    private final HabitCatalog seedCatalog;

    /**
     * Imports whatever the user is missing. Runs in its OWN transaction — see the class javadoc.
     * A {@code DataIntegrityViolationException} escaping this method means a concurrent caller won
     * the race; the caller treats that as success and simply re-reads.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void bootstrapMissing(UUID userId) {
        Map<String, HabitChainEntity> byKey =
            chainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(userId).stream()
                .collect(Collectors.toMap(HabitChainEntity::getChainKey, Function.identity()));
        for (SeedChain seed : SEED_CHAINS) {
            if (!byKey.containsKey(seed.key())) {
                HabitChainEntity c = new HabitChainEntity();
                c.setCreatedBy(userId);
                c.setChainKey(seed.key());
                c.setTitle(seed.title());
                c.setDaypart(seed.daypart());
                c.setPosition(seed.position());
                byKey.put(seed.key(), chainRepository.saveAndFlush(c));
            }
        }
        // ONE query for every key ever imported (live or soft-deleted) — not an O(seed-size)
        // per-def native COUNT probe (mezo-n5e9.1 review finding 1). No "skip everything if any
        // defs exist" short-circuit: every seed def is still checked individually against this
        // set, so a future seed-JSON addition keeps importing for existing users.
        Set<String> everImported = new HashSet<>(defRepository.findAllKeysEver(userId));
        for (HabitCatalog.HabitDef def : seedCatalog.all()) {
            if (!everImported.contains(def.key())) {
                HabitDefEntity e = new HabitDefEntity();
                e.setCreatedBy(userId);
                e.setHabitKey(def.key());
                e.setChainId(byKey.get(def.chain()).getId());
                e.setPosition(def.position());
                e.setTitle(def.title());
                e.setWhy(def.why());
                e.setAnchorCopy(def.anchorCopy());
                e.setMode(def.mode());
                e.setMetric(def.metric());
                e.setSkillKey(def.skillKey());
                e.setSkillKind(def.skillKind());
                e.setXp(def.xp());
                e.setLinkUrl(def.linkUrl());
                defRepository.save(e);
            }
        }
        defRepository.flush();
    }
}
