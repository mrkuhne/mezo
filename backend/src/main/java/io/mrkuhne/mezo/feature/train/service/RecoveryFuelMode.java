package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.http.HttpStatus;

/** How Fuel behaves on a kímélő-mód day (Kihagyás S3, spec §10.1.2). Pure. */
public enum RecoveryFuelMode {
    GUIDANCE, MAINTENANCE, ESTIMATE;

    public static RecoveryFuelMode of(PlannedSkipEntity.Reason category) {
        return switch (category) {
            case ILLNESS, STOMACH -> GUIDANCE;
            case INJURY -> MAINTENANCE;
            case TRAVEL -> ESTIMATE;
            default -> throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "category").build(), HttpStatus.BAD_REQUEST);
        };
    }

    /** True when a kcal target must not be judged on this day. */
    public boolean unjudged() {
        return this == GUIDANCE || this == ESTIMATE;
    }
}
