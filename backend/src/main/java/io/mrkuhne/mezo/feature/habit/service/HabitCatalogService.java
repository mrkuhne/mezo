package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The DB-backed habit catalog (mezo-n5e9.1). HabitCatalog (the JSON loader) is only the SEED
 * source now: the first read for a user lazily imports missing chains/defs (the ensureRows
 * race-guard idiom), then every runtime read is repository-backed. A def the user soft-deleted
 * is never resurrected — absence of a LIVE-or-DELETED row is what triggers a seed import.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitCatalogService {

    /** chainKey, title, daypart, position — continuity keys match the retired enum values. */
    private record SeedChain(String key, String title, String daypart, int position) {}

    private static final List<SeedChain> SEED_CHAINS = List.of(
        new SeedChain("MORNING", "Reggeli rutin", HabitChainEntity.DAYPART_MORNING, 1),
        new SeedChain("EVENING", "Esti rutin", HabitChainEntity.DAYPART_EVENING, 2));

    private final HabitChainRepository chainRepository;
    private final HabitDefRepository defRepository;
    private final HabitCatalog seedCatalog;

    @Transactional
    public List<HabitDefEntity> ensureCatalog(UUID userId) {
        try {
            bootstrapMissing(userId);
        } catch (DataIntegrityViolationException lostRace) {
            // A concurrent read imported the same seed rows first — theirs win, just re-read.
        }
        return activeOrdered(userId);
    }

    public Optional<HabitDefEntity> byKey(UUID userId, String key) {
        return defRepository.findByCreatedByAndHabitKeyAndDeletedFalse(userId, key);
    }

    public List<HabitDefEntity> activeForChainKey(UUID userId, String chainKey) {
        return chainRepository.findByCreatedByAndChainKeyAndDeletedFalse(userId, chainKey)
            .filter(c -> Boolean.TRUE.equals(c.getActive()))
            .map(c -> defRepository.findByChainIdAndDeletedFalse(c.getId()).stream()
                .filter(d -> Boolean.TRUE.equals(d.getActive()))
                .sorted(Comparator.comparing(HabitDefEntity::getPosition))
                .toList())
            .orElse(List.of());
    }

    public List<HabitChainEntity> chains(UUID userId) {
        return chainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(userId);
    }

    /**
     * Same shape as {@link #ensureCatalog}'s return value (active defs, chain-then-position
     * ordered) but NEVER bootstraps — for read-only callers ({@code HabitService#summary},
     * mezo-n5e9.1 review finding 3) that must not materialize a catalog for a user who has never
     * touched habits. Returns an empty list for such a user; their catalog is created on their
     * first {@code getDay}/{@code check}/{@code uncheck}/admin touch instead.
     */
    public List<HabitDefEntity> activeOrderedWithoutBootstrap(UUID userId) {
        return activeOrdered(userId);
    }

    private void bootstrapMissing(UUID userId) {
        Map<String, HabitChainEntity> byKey = chains(userId).stream()
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

    private List<HabitDefEntity> activeOrdered(UUID userId) {
        Map<UUID, HabitChainEntity> chainById = chains(userId).stream()
            .collect(Collectors.toMap(HabitChainEntity::getId, Function.identity()));
        return defRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(userId).stream()
            .filter(d -> Boolean.TRUE.equals(d.getActive()))
            .filter(d -> {
                HabitChainEntity c = chainById.get(d.getChainId());
                return c != null && Boolean.TRUE.equals(c.getActive());
            })
            .sorted(Comparator
                .comparing((HabitDefEntity d) -> chainById.get(d.getChainId()).getPosition())
                .thenComparing(HabitDefEntity::getPosition))
            .toList();
    }
}
