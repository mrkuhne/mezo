package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.api.dto.HabitCatalogResponse;
import io.mrkuhne.mezo.api.dto.HabitChainAdmin;
import io.mrkuhne.mezo.api.dto.HabitChainCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitChainUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitDefAdmin;
import io.mrkuhne.mezo.api.dto.HabitDefCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitDefUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitReorderRequest;
import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.mapper.HabitMapper;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The routine-editor's write side (bd mezo-n5e9.1): full CRUD over the user's habit chains/defs,
 * on top of {@link HabitCatalogService}'s bootstrap + reads. Every entry point starts by ensuring
 * the catalog exists — an admin call can be a user's very first habit-surface touch (mirrors
 * {@code HabitService.requireDef}/{@code summary}), so e.g. the first chain a user ever creates
 * lands at position 3 (after the two bootstrapped seed chains), not position 1.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitAdminService {

    private final HabitCatalogService catalogService;
    private final HabitChainRepository chainRepository;
    private final HabitDefRepository defRepository;
    private final HabitMapper mapper;
    private final HabitFrameworkValidator frameworkValidator;

    @Transactional
    public HabitCatalogResponse catalog(UUID userId) {
        catalogService.ensureCatalog(userId);
        List<HabitChainAdmin> chains = catalogService.chains(userId).stream()
            .map(chain -> mapper.toChainAdmin(chain, defsForChain(chain)))
            .toList();
        return mapper.toCatalogResponse(chains);
    }

    @Transactional
    public HabitChainAdmin createChain(UUID userId, HabitChainCreateRequest request) {
        catalogService.ensureCatalog(userId);
        int position = catalogService.chains(userId).size() + 1;
        HabitChainEntity chain = new HabitChainEntity();
        chain.setCreatedBy(userId);
        chain.setChainKey(generateKey("chain_"));
        chain.setTitle(request.getTitle());
        chain.setDaypart(request.getDaypart().getValue());
        chain.setPosition(position);
        HabitChainEntity saved = chainRepository.save(chain);
        return mapper.toChainAdmin(saved, List.of());
    }

    @Transactional
    public HabitChainAdmin updateChain(UUID userId, UUID id, HabitChainUpdateRequest request) {
        catalogService.ensureCatalog(userId);
        HabitChainEntity chain = requireChain(userId, id);
        if (request.getTitle() != null) {
            chain.setTitle(request.getTitle());
        }
        if (request.getDaypart() != null) {
            chain.setDaypart(request.getDaypart().getValue());
        }
        if (request.getPosition() != null) {
            chain.setPosition(request.getPosition());
        }
        if (request.getIsActive() != null) {
            chain.setActive(request.getIsActive());
        }
        HabitChainEntity saved = chainRepository.save(chain);
        return mapper.toChainAdmin(saved, defsForChain(saved));
    }

    @Transactional
    public void deleteChain(UUID userId, UUID id) {
        catalogService.ensureCatalog(userId);
        HabitChainEntity chain = requireChain(userId, id);
        if (HabitCatalog.CHAIN_MORNING.equals(chain.getChainKey())
            || HabitCatalog.CHAIN_EVENING.equals(chain.getChainKey())) {
            throw conflict("HABIT_CHAIN_SEED");
        }
        if (!defRepository.findByChainIdAndDeletedFalse(chain.getId()).isEmpty()) {
            throw conflict("HABIT_CHAIN_NOT_EMPTY");
        }
        chainRepository.delete(chain); // @SQLDelete soft-deletes
    }

    @Transactional
    public HabitChainAdmin reorder(UUID userId, UUID id, HabitReorderRequest request) {
        catalogService.ensureCatalog(userId);
        HabitChainEntity chain = requireChain(userId, id);
        List<HabitDefEntity> liveDefs = defRepository.findByChainIdAndDeletedFalse(chain.getId());
        Set<UUID> liveIds = liveDefs.stream().map(HabitDefEntity::getId).collect(Collectors.toSet());
        List<UUID> requested = request.getDefIds();
        if (requested.size() != liveIds.size() || !liveIds.equals(new HashSet<>(requested))) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_REORDER_MISMATCH").build(), HttpStatus.BAD_REQUEST);
        }
        Map<UUID, HabitDefEntity> byId = liveDefs.stream()
            .collect(Collectors.toMap(HabitDefEntity::getId, Function.identity()));
        int position = 1;
        for (UUID defId : requested) {
            HabitDefEntity def = byId.get(defId);
            def.setPosition(position++);
            defRepository.save(def);
        }
        return mapper.toChainAdmin(chain, defsForChain(chain));
    }

    @Transactional
    public HabitDefAdmin createDef(UUID userId, HabitDefCreateRequest request) {
        catalogService.ensureCatalog(userId);
        if (!ProgressionTaxonomy.LIFE.contains(request.getSkillKey())) {
            // The ActivityService#categorize precedent (ACTIVITY_SKILL_UNKNOWN): a free-form
            // skillKey would upsert a phantom LIFE-skill row via ProgressionService.award on
            // completion (review finding 2) — validate against the same taxonomy source of truth.
            throw new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_SKILL_UNKNOWN").build(), HttpStatus.BAD_REQUEST);
        }
        HabitChainEntity chain = chainRepository
            .findByCreatedByAndChainKeyAndDeletedFalse(userId, request.getChainKey())
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_DEF_UNKNOWN_CHAIN").build(), HttpStatus.BAD_REQUEST));
        String mode = request.getMode().getValue();
        String metric = resolveMetric(mode, request.getMetric());
        List<HabitDefEntity> liveDefs = defRepository.findByChainIdAndDeletedFalse(chain.getId());
        int position = request.getPosition() != null ? request.getPosition() : liveDefs.size() + 1;

        HabitDefEntity def = new HabitDefEntity();
        def.setCreatedBy(userId);
        def.setHabitKey(generateKey("custom_"));
        def.setChainId(chain.getId());
        def.setPosition(position);
        def.setTitle(request.getTitle());
        def.setWhy(request.getWhy());
        def.setAnchorCopy(request.getAnchorCopy());
        def.setMode(mode);
        def.setMetric(metric);
        def.setSkillKey(request.getSkillKey());
        def.setXp(request.getXp());
        def.setLinkUrl(request.getLinkUrl());
        def.setFramework(request.getFramework() != null ? request.getFramework().getValue() : null);
        def.setAnchorHabitKey(blankToNull(request.getAnchorHabitKey()));
        def.setCue(request.getCue());
        def.setCraving(request.getCraving());
        def.setReward(request.getReward());
        def.setCelebration(request.getCelebration());
        def.setIdentity(request.getIdentity());
        frameworkValidator.clearForeignFields(def);
        frameworkValidator.validate(def);
        HabitDefEntity saved = defRepository.save(def);
        return mapper.toDefAdmin(saved, chain.getChainKey());
    }

    @Transactional
    public HabitDefAdmin updateDef(UUID userId, UUID id, HabitDefUpdateRequest request) {
        catalogService.ensureCatalog(userId);
        HabitDefEntity def = requireDef(userId, id);
        if (request.getChainKey() != null) {
            HabitChainEntity target = chainRepository
                .findByCreatedByAndChainKeyAndDeletedFalse(userId, request.getChainKey())
                .orElseThrow(() -> new SystemRuntimeErrorException(
                    SystemMessage.error("HABIT_DEF_UNKNOWN_CHAIN").build(), HttpStatus.BAD_REQUEST));
            // Count the target chain's live defs BEFORE reassigning chainId: def.setChainId(...)
            // dirties the managed entity, and a query issued after that triggers JPA auto-flush,
            // which would push the (moving) def's new chainId first and make the count include
            // itself — an off-by-one that leaves a permanent numbering gap (review finding 1).
            int endOfTargetChain = defRepository.findByChainIdAndDeletedFalse(target.getId()).size() + 1;
            def.setChainId(target.getId());
            def.setPosition(request.getPosition() != null ? request.getPosition() : endOfTargetChain);
        } else if (request.getPosition() != null) {
            def.setPosition(request.getPosition());
        }
        if (request.getTitle() != null) {
            def.setTitle(request.getTitle());
        }
        if (request.getWhy() != null) {
            def.setWhy(request.getWhy());
        }
        if (request.getAnchorCopy() != null) {
            def.setAnchorCopy(request.getAnchorCopy());
        }
        if (request.getXp() != null) {
            def.setXp(request.getXp());
        }
        if (request.getLinkUrl() != null) {
            def.setLinkUrl(request.getLinkUrl());
        }
        if (request.getIsActive() != null) {
            def.setActive(request.getIsActive());
            if (Boolean.FALSE.equals(request.getIsActive())) {
                releaseAnchors(userId, def);
            }
        }
        if (request.getFramework() != null) {
            def.setFramework(request.getFramework().getValue());
        }
        if (request.getAnchorHabitKey() != null) {
            // A BLANK anchorHabitKey is the wire signal for "unlink this anchor" — the only one the
            // PATCH can carry, since a null means "leave unchanged" here. It must not survive as
            // STORED state, though: the mapper would hand "" straight back to the client, and the
            // frontend's contract is "null means unlinked", so a def that was just unlinked would
            // come back looking linked and re-lock its own read-only anchor field. Normalize on the
            // way in, so the persisted state says exactly what is true.
            def.setAnchorHabitKey(blankToNull(request.getAnchorHabitKey()));
        }
        if (request.getCue() != null) {
            def.setCue(request.getCue());
        }
        if (request.getCraving() != null) {
            def.setCraving(request.getCraving());
        }
        if (request.getReward() != null) {
            def.setReward(request.getReward());
        }
        if (request.getCelebration() != null) {
            def.setCelebration(request.getCelebration());
        }
        if (request.getIdentity() != null) {
            def.setIdentity(request.getIdentity());
        }
        frameworkValidator.clearForeignFields(def);
        frameworkValidator.validate(def);
        HabitDefEntity saved = defRepository.save(def);
        return mapper.toDefAdmin(saved, chainKeyOf(saved.getChainId()));
    }

    @Transactional
    public void deleteDef(UUID userId, UUID id) {
        catalogService.ensureCatalog(userId);
        HabitDefEntity def = requireDef(userId, id);
        releaseAnchors(userId, def);
        defRepository.delete(def); // @SQLDelete soft-deletes
    }

    /**
     * A stacked recipe must survive its anchor disappearing (mezo-3zue.2): the sentence
     * "Miután [anchor], …" is the user's own words, so instead of nulling the whole recipe we
     * demote the reference to free text and drop the key. Runs inside the caller's transaction.
     */
    private void releaseAnchors(UUID userId, HabitDefEntity anchor) {
        List<HabitDefEntity> dependents =
            defRepository.findByCreatedByAndAnchorHabitKeyAndDeletedFalse(userId, anchor.getHabitKey());
        for (HabitDefEntity dependent : dependents) {
            if (dependent.getAnchorCopy() == null || dependent.getAnchorCopy().isBlank()) {
                dependent.setAnchorCopy("kész a " + anchor.getTitle());
            }
            dependent.setAnchorHabitKey(null);
            defRepository.save(dependent);
        }
    }

    private String resolveMetric(String mode, String requestedMetric) {
        if (HabitDefEntity.MODE_MANUAL.equals(mode)) {
            return HabitDefEntity.METRIC_MANUAL; // any client value ignored
        }
        if (HabitDefEntity.METRIC_MANUAL.equals(requestedMetric)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_MODE_METRIC_MISMATCH").build(), HttpStatus.BAD_REQUEST);
        }
        if (requestedMetric == null || !HabitEvaluator.SUPPORTED_METRICS.contains(requestedMetric)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_METRIC_UNKNOWN").build(), HttpStatus.BAD_REQUEST);
        }
        return requestedMetric;
    }

    private List<HabitDefAdmin> defsForChain(HabitChainEntity chain) {
        return defRepository.findByChainIdAndDeletedFalse(chain.getId()).stream()
            .sorted(Comparator.comparing(HabitDefEntity::getPosition))
            .map(def -> mapper.toDefAdmin(def, chain.getChainKey()))
            .toList();
    }

    private HabitChainEntity requireChain(UUID userId, UUID id) {
        return chainRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_CHAIN_UNKNOWN").build(), HttpStatus.NOT_FOUND));
    }

    private HabitDefEntity requireDef(UUID userId, UUID id) {
        return defRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("HABIT_UNKNOWN").build(), HttpStatus.NOT_FOUND));
    }

    private String chainKeyOf(UUID chainId) {
        return chainRepository.findById(chainId).map(HabitChainEntity::getChainKey).orElse(null);
    }

    private static String generateKey(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    /** Blank in, null stored — see the unlink note in updateDef. Mirrors HabitFrameworkValidator's
     *  own isSet(), which already reads a blank anchor key as "no link" for validation purposes. */
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
