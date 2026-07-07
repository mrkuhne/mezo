package io.mrkuhne.mezo.feature.proactive.mapper;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;

/**
 * Presentation helpers for {@link ChallengeEntity} → {@code ChallengeResponse}. Kept OUT of the
 * MapStruct interface on purpose: a {@code String -> String} default method there is auto-selected by
 * MapStruct as an implicit converter for EVERY String property (corrupting the other responses), so
 * these are plain static helpers invoked only via {@code @Mapping(expression = ...)}.
 */
final class ChallengeDisplay {

    private ChallengeDisplay() {
    }

    static String typeLabel(String type) {
        return switch (type) {
            case ChallengeEntity.TYPE_PR -> "PR-attempt";
            case ChallengeEntity.TYPE_DEPTH -> "Mélység";
            case ChallengeEntity.TYPE_VOLUME -> "Volumen";
            default -> type;
        };
    }

    static String target(ChallengeEntity e) {
        return switch (e.getType()) {
            case ChallengeEntity.TYPE_PR ->
                    e.getTargetWeightKg().stripTrailingZeros().toPlainString() + " kg × " + e.getTargetReps();
            case ChallengeEntity.TYPE_DEPTH -> "Utolsó szet RIR " + e.getTargetRir() + "-ig";
            case ChallengeEntity.TYPE_VOLUME -> e.getTargetSets() + " szett";
            default -> "";
        };
    }
}
