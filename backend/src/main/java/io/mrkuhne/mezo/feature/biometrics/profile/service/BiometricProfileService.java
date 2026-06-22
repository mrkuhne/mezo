package io.mrkuhne.mezo.feature.biometrics.profile.service;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.api.dto.TdeeBootstrap;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.mapper.BiometricProfileMapper;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.engine.service.TdeeBootstrapService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single-row-per-owner biometric profile. {@link #getProfile} 404s when the owner has no profile;
 * {@link #upsertProfile} find-or-creates by {@code createdBy} and overwrites the fields, so it is
 * one row per owner (insert once, update thereafter) — backed by
 * {@code uq_biometric_profile_created_by}.
 *
 * <p>G6 surface:
 * <ul>
 *   <li>{@link #getProfile} now carries a <b>derived</b> {@code tdeeBootstrap} (base-TDEE from the
 *       profile + latest weigh-in) — computed on read via {@link TdeeBootstrapService}, NOT persisted.
 *       Null when there is no weigh-in (no BMR basis).</li>
 *   <li>{@link #upsertProfile} recomputes the owner's active goal after the save (the
 *       biometric-profile-change trigger, mirroring {@code WeightLogService.recomputeActiveGoal}) so
 *       the engine's prescription reflects the new profile inputs. No-op when no active goal; never
 *       breaks the save (the G5 graceful-on-missing-profile contract holds).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class BiometricProfileService {

    private static final String STATUS_ACTIVE = "active";

    private final BiometricProfileRepository repository;
    private final BiometricProfileMapper mapper;
    private final WeightLogRepository weightLogRepository;
    private final TdeeBootstrapService tdeeBootstrapService;
    private final GoalMapper goalMapper;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    public BiometricProfileResponse getProfile(UUID userId) {
        BiometricProfileEntity entity = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        BiometricProfileResponse response = mapper.toResponse(entity);
        response.setTdeeBootstrap(deriveTdeeBootstrap(userId, entity));
        return response;
    }

    @Transactional
    public BiometricProfileResponse upsertProfile(UUID userId, BiometricProfileUpsertRequest req) {
        BiometricProfileEntity e = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                BiometricProfileEntity x = new BiometricProfileEntity();
                x.setCreatedBy(userId); // server-side ownership — never from the client
                return x;
            });
        e.setSex(req.getSex());
        e.setHeightCm(req.getHeightCm());
        e.setBirthDate(req.getBirthDate());
        e.setBodyFatPct(req.getBodyFatPct());
        e.setActivityLevel(req.getActivityLevel() == null ? null : req.getActivityLevel().getValue());
        BiometricProfileEntity saved = repository.save(e);
        // The TDEE inputs changed (G6 trigger): recompute the owner's ACTIVE goal so its prescription
        // reflects the new profile. At most one active goal exists; if there is none, skip gracefully —
        // a profile upsert must never depend on (or be broken by) a goal.
        recomputeActiveGoal(userId);
        BiometricProfileResponse response = mapper.toResponse(saved);
        response.setTdeeBootstrap(deriveTdeeBootstrap(userId, saved));
        return response;
    }

    /**
     * Derived base-TDEE for the profile screen — NOT persisted. Needs the latest weigh-in as the BMR
     * basis (latest = last of the date-ascending {@code findAllOwned}); null when there is none.
     */
    private TdeeBootstrap deriveTdeeBootstrap(UUID userId, BiometricProfileEntity profile) {
        BigDecimal latestWeightKg = latestWeightKg(userId);
        if (latestWeightKg == null) {
            return null;
        }
        TdeeBootstrapJson bootstrap = tdeeBootstrapService.compute(profile, latestWeightKg);
        return goalMapper.toTdeeBootstrap(bootstrap);
    }

    /** Latest weigh-in (kg) for the owner, or null when none — {@code findAllOwned} is date-ascending. */
    private BigDecimal latestWeightKg(UUID userId) {
        List<WeightLogEntity> logs = weightLogRepository.findAllOwned(userId);
        return logs.isEmpty() ? null : logs.get(logs.size() - 1).getWeightKg();
    }

    /** Recompute the owner's single active goal (if any) — no-op when none is active. */
    private void recomputeActiveGoal(UUID createdBy) {
        List<GoalEntity> active =
            goalRepository.findByCreatedByAndStatusAndDeletedFalse(createdBy, STATUS_ACTIVE);
        if (active.isEmpty()) {
            return; // no relevant goal → nothing to recompute
        }
        goalEngineService.evaluate(createdBy, active.get(0).getId());
    }
}
