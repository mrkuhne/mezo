package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The one place that knows what each behaviour-change framework requires (mezo-3zue.2).
 * FOGG is the Tiny Habits recipe — an anchor (a sibling def or free text) plus a celebration;
 * CLEAR is the Four Laws — cue, craving and reward, with identity optional. A def with no
 * framework is a pre-mezo-3zue row and must carry no framework field at all, so the FE can
 * tell "legacy" from "half-filled recipe" without guessing.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitFrameworkValidator {

    private final HabitDefRepository defRepository;

    /** Validates the def's merged post-write state. Call AFTER applying the request. */
    public void validate(HabitDefEntity draft) {
        String framework = draft.getFramework();
        if (framework == null) {
            if (hasAny(draft.getAnchorHabitKey(), draft.getCue(), draft.getCraving(),
                draft.getReward(), draft.getCelebration(), draft.getIdentity())) {
                throw badRequest("HABIT_FRAMEWORK_FIELDS_ORPHAN");
            }
            return;
        }
        if (HabitDefEntity.FRAMEWORK_FOGG.equals(framework)) {
            boolean hasAnchor = isSet(draft.getAnchorHabitKey()) || isSet(draft.getAnchorCopy());
            if (!hasAnchor || !isSet(draft.getCelebration())) {
                throw badRequest("HABIT_FRAMEWORK_FOGG_INCOMPLETE");
            }
            validateAnchorReference(draft);
            return;
        }
        if (!isSet(draft.getCue()) || !isSet(draft.getCraving()) || !isSet(draft.getReward())) {
            throw badRequest("HABIT_FRAMEWORK_CLEAR_INCOMPLETE");
        }
    }

    /**
     * Clears the fields the chosen framework does not own, so a def re-framed from CLEAR to FOGG
     * cannot keep a stale cue that the sentence renderer would then print.
     */
    public void clearForeignFields(HabitDefEntity draft) {
        if (HabitDefEntity.FRAMEWORK_FOGG.equals(draft.getFramework())) {
            draft.setCue(null);
            draft.setCraving(null);
            draft.setReward(null);
            draft.setIdentity(null);
            return;
        }
        if (HabitDefEntity.FRAMEWORK_CLEAR.equals(draft.getFramework())) {
            draft.setAnchorHabitKey(null);
            // anchorCopy goes too: it IS rendered on the Nap tab (NapRutinPage's `.nr-anchor`
            // line and todayItems' subtitle), so a FOGG → CLEAR conversion that kept it left a
            // stale „miután …" cue standing under a Clear recipe.
            draft.setAnchorCopy(null);
            draft.setCelebration(null);
        }
    }

    private void validateAnchorReference(HabitDefEntity draft) {
        String anchorKey = draft.getAnchorHabitKey();
        if (!isSet(anchorKey)) {
            return; // free-text anchor only
        }
        if (anchorKey.equals(draft.getHabitKey())) {
            throw badRequest("HABIT_ANCHOR_INVALID");
        }
        HabitDefEntity anchor = defRepository
            .findByCreatedByAndHabitKeyAndDeletedFalse(draft.getCreatedBy(), anchorKey)
            .orElseThrow(() -> badRequest("HABIT_ANCHOR_INVALID"));
        if (!Boolean.TRUE.equals(anchor.getActive())) {
            throw badRequest("HABIT_ANCHOR_INVALID");
        }
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean hasAny(String... values) {
        for (String value : values) {
            if (isSet(value)) {
                return true;
            }
        }
        return false;
    }

    private static SystemRuntimeErrorException badRequest(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.BAD_REQUEST);
    }
}
