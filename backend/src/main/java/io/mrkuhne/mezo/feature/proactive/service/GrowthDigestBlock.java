package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.feature.progression.service.GrowthWeekService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Growth facts for the proactive weekly digests (E3, bd mezo-6ng8): renders the week's quest
 * ratio, LIFE XP, activity count and savings as a labelled block the weekly-suggestion and
 * memoir prompts append verbatim. Empty week → empty string (no digest noise; the prose
 * generators never see a zero-filled section).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class GrowthDigestBlock {

    private final GrowthWeekService growthWeekService;

    /** HU block for the week starting weekStart; "" when the week carries no growth data. */
    public String render(UUID userId, LocalDate weekStart) {
        GrowthWeekResponse w = growthWeekService.growthWeek(userId, weekStart);
        if (w.getQuestClosed() == 0 && w.getLifeXp() == 0 && w.getActivities() == 0) {
            return "";
        }
        StringBuilder b = new StringBuilder("\n\nNÖVEKEDÉS (hét: ").append(w.getWeekStart()).append("):\n");
        b.append("- Napi küldetések: ").append(w.getQuestCompleted()).append('/')
            .append(w.getQuestClosed()).append(" teljesítve\n");
        b.append("- LIFE XP: +").append(w.getLifeXp())
            .append(" (").append(w.getActivities()).append(" tevékenység)");
        if (w.getSavingsHuf() > 0) {
            b.append("\n- Megtakarítás: ").append(formatHuf(w.getSavingsHuf())).append(" Ft");
        }
        return b.toString();
    }

    /**
     * Thousands-grouped HUF forced to a plain ASCII space. The hu-HU locale's group separator is
     * a (narrow) no-break space under CLDR; the IT pins the literal "50 000 Ft", so every NBSP
     * variant — and a comma, should a JDK fall back to it — is normalized to U+0020.
     */
    private static String formatHuf(long v) {
        return String.format(Locale.of("hu", "HU"), "%,d", v)
                .replace('\u00A0', ' ')
                .replace('\u202F', ' ')
                .replace(',', ' ');
    }
}
