package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.api.dto.DietSettingsPreviewResponse;
import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferences;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.DietSettingsEntity;
import io.mrkuhne.mezo.feature.nutrition.repository.DietSettingsRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
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
 *
 * <p>{@code previewSettings} (mezo-u2pd) is the read-only twin of that save: it projects what the
 * draft WOULD prescribe today, through the same calculator and the same day projection, so the
 * settings screen can show live macro numbers before the user commits.
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
    private final NutritionTargetsProperties nutritionTargets;
    private final WorkoutWindowQueryService workoutWindowQueryService;

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
        row.setDayTypeShiftKcal(req.getDayTypeShiftKcal());
        repository.save(row);
        // The split moved (Diet Plan slice 1 — the 7th recompute trigger): re-prescribe the owner's
        // ACTIVE goal so segments carry the new carbsG/fatG. No active goal → skip gracefully.
        goalEngineService.recomputeActiveGoal(userId);
        return compose(resolver.resolve(userId));
    }

    /**
     * Project TODAY's macro targets for an UNSAVED draft (mezo-u2pd) — the settings screen's macro
     * preview. Read-only in the strong sense: no preference row is written and the active goal
     * keeps its stored prescription; {@link GoalEngineService#previewActiveGoalSegment} runs the
     * SAME {@code GoalPrescriptionCalculator} the save path runs, and the segment is projected
     * through the SAME {@link DayTargetProjector} the Fuel day and the meal scorer use — so the
     * previewed numbers are exactly the ones Mentés will make real. No active goal / no biometric
     * profile / no covering segment → the static config targets, flagged {@code source=config}.
     *
     * <p>The draft is validated like a save: an incoherent custom split is a 400, not a silently
     * balanced projection.
     */
    @Transactional(readOnly = true)
    public DietSettingsPreviewResponse previewSettings(UUID userId, SetDietSettingsRequest req) {
        validateCustomSplit(req);
        LocalDate today = LocalDate.now();
        GoalPrescriptionJson.Segment seg =
            goalEngineService.previewActiveGoalSegment(userId, toPreferences(req), today);
        DailyTargets t = DayTargetProjector.project(
            seg, () -> workoutWindowQueryService.hasScheduledTrainingOn(userId, today), nutritionTargets);
        return DietSettingsPreviewResponse.builder()
            .kcal(t.kcal())
            .proteinG(t.p())
            .carbsG(t.c())
            .fatG(t.f())
            .source(DietSettingsPreviewResponse.SourceEnum.fromValue(t.source()))
            .build();
    }

    /** The request as engine preferences — the custom pcts drop out for every named preset, as on save. */
    private static DietPreferences toPreferences(SetDietSettingsRequest req) {
        boolean custom = PRESET_CUSTOM.equals(req.getSplitPreset().getValue());
        return new DietPreferences(
            req.getSplitPreset().getValue(),
            custom ? req.getProteinPctX10() : null,
            custom ? req.getCarbsPctX10() : null,
            custom ? req.getFatPctX10() : null,
            req.getProteinTier().getValue(),
            req.getWaterMl(),
            req.getFiberG(),
            req.getDayTypeShiftKcal());
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
            .dayTypeShiftKcal(p.dayTypeShiftKcal())
            .build();
    }
}
