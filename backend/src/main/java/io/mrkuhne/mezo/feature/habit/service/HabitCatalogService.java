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

    private final HabitChainRepository chainRepository;
    private final HabitDefRepository defRepository;
    private final HabitCatalog seedCatalog;
    private final HabitCatalogBootstrapper bootstrapper;

    @Transactional
    public List<HabitDefEntity> ensureCatalog(UUID userId) {
        try {
            // Runs in its OWN transaction (mezo-5jly). A concurrent first-touch that loses the
            // race aborts only THAT transaction; ours never issued the failing statement, so the
            // read below still works. Recovering inside one shared transaction is impossible on
            // Postgres — a constraint violation poisons the whole connection (25P02).
            bootstrapper.bootstrapMissing(userId);
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
