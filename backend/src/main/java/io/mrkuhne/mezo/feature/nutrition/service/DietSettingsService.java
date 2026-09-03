package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferences;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The /api/diet/settings service (Diet Plan slice 1, mezo-xwgb). Save upserts the per-owner
 * singleton row and re-evaluates the owner's ACTIVE goal in the same transaction — the split moving
 * changes the segments' carbsG/fatG (Task 5), so the 7th recompute trigger keeps them fresh.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.DIET_SETTINGS_SWITCH, havingValue = "true")
public class DietSettingsService {

    private static final String PRESET_CUSTOM = "custom";
    private static final int PCT_X10_TOTAL = 1000;

    private final DietSettingsRepository repository;
    private final DietPreferencesResolver resolver;
    private final GoalEngineService goalEngineService;

    /** Config-default ghost when unset — never 404: the split always resolves. */
    public DietSettingsResponse getSettings(UUID userId) {
        return compose(resolver.resolve(userId));
    }

    @Transactional
    public DietSettingsResponse setSettings(UUID userId, SetDietSettingsRequest req) {
        validateCustomSplit(req);
        DietSettingsEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                DietSettingsEntity e = new DietSettingsEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        boolean custom = PRESET_CUSTOM.equals(req.getSplitPreset().getValue());
        row.setSplitPreset(req.getSplitPreset().getValue());
        row.setProteinPctX10(custom ? req.getProteinPctX10() : null);
        row.setCarbsPctX10(custom ? req.getCarbsPctX10() : null);
        row.setFatPctX10(custom ? req.getFatPctX10() : null);
        row.setProteinTier(req.getProteinTier().getValue());
        row.setWaterMl(req.getWaterMl());
        row.setFiberG(req.getFiberG());
        repository.save(row);
        // The split moved (Diet Plan slice 1 — the 7th recompute trigger): re-prescribe the owner's
        // ACTIVE goal so segments carry the new carbsG/fatG. No active goal → skip gracefully.
        goalEngineService.recomputeActiveGoal(userId);
        return compose(resolver.resolve(userId));
    }

    /** Custom split must sum to exactly 100.0% (all three fields present). */
    private static void validateCustomSplit(SetDietSettingsRequest req) {
        if (!PRESET_CUSTOM.equals(req.getSplitPreset().getValue())) {
            return;
        }
        Integer p = req.getProteinPctX10();
        Integer c = req.getCarbsPctX10();
        Integer f = req.getFatPctX10();
        if (p == null || c == null || f == null || p + c + f != PCT_X10_TOTAL) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("DIET_SPLIT_SUM_INVALID").build(), HttpStatus.BAD_REQUEST);
        }
    }

    private static DietSettingsResponse compose(DietPreferences p) {
        return DietSettingsResponse.builder()
            .splitPreset(DietSettingsResponse.SplitPresetEnum.fromValue(p.splitPreset()))
            .proteinPctX10(p.proteinPctX10())
            .carbsPctX10(p.carbsPctX10())
            .fatPctX10(p.fatPctX10())
            .proteinTier(DietSettingsResponse.ProteinTierEnum.fromValue(p.proteinTier()))
            .waterMl(p.waterMl())
            .fiberG(p.fiberG())
            .build();
    }
}
