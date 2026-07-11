package io.mrkuhne.mezo.feature.quest.mapper;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;

/**
 * Presentation helpers for {@link DailyQuestEntity} → {@code QuestResponse}. Kept OUT of the
 * MapStruct interface on purpose (same trap as ChallengeDisplay): a String->String default method
 * there would be auto-selected as an implicit converter for EVERY String property.
 */
final class QuestDisplay {

    private QuestDisplay() {
    }

    static String targetLabel(DailyQuestEntity e) {
        return switch (e.getTarget().metric()) {
            case "gym_session_done" -> "Mai tervezett edzés teljesítve";
            case "checkin_full" -> e.getTarget().threshold().intValue() + " check-in ma";
            case "weight_logged" -> "Reggeli súly beloggolva";
            case "water_target" -> "≥ " + e.getTarget().threshold().intValue() + " ml víz";
            case "protein_target" -> "≥ " + e.getTarget().threshold().intValue() + " g fehérje";
            case "sleep_target" -> "≥ " + e.getTarget().threshold().stripTrailingZeros().toPlainString() + " óra alvás";
            default -> "";
        };
    }
}
