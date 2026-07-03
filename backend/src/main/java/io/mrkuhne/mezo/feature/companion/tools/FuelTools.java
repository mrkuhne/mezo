package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tools over the fuel/meal features (day rollups + supplement-protocol adherence). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FuelTools {

    private final FuelDayService fuelDayService;
    private final ProtocolService protocolService;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final CompanionProperties properties;

    @Tool(name = "get_recent_meals", description = "Napi étkezés-összesítők az elmúlt napokra: kcal és "
            + "fehérje a célhoz képest, étkezésszám, ételek. Kérdés étkezésről, kalóriáról, fehérjebevitelről.")
    public String getRecentMeals(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        StringBuilder b = new StringBuilder("Napi étkezés-összesítők (utolsó ").append(d).append(" nap):");
        int daysWithMeals = 0;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            FuelDayResponse day = fuelDayService.getDay(userId, date);
            MacroSet c = day.getConsumed();
            MacroSet t = day.getTargets();
            b.append('\n').append(date).append(": ")
                    .append(ToolText.num(c.getKcal())).append('/').append(ToolText.num(t.getKcal()))
                    .append(" kcal, F ").append(ToolText.num(c.getP())).append('/').append(ToolText.num(t.getP()))
                    .append(" g; ").append(day.getMeals().size()).append(" étkezés");
            if (!day.getMeals().isEmpty()) {
                b.append(" (").append(day.getMeals().stream()
                        .map(MealResponse::getTitle).limit(3).collect(Collectors.joining(", ")));
                if (day.getMeals().size() > 3) {
                    b.append(", …");
                }
                b.append(')');
                daysWithMeals++;
                if (daysWithMeals <= 5) {
                    ToolContexts.audit(toolContext).addRef("FuelDay", date.toString());
                }
            }
        }
        return b.toString();
    }

    @Tool(name = "get_protocol_adherence", description = "Étrendkiegészítő-protokoll követése az elmúlt "
            + "napokra: naponta hány elem lett bevéve az aktív protokollból. Kérdés kiegészítőkről, protokollról.")
    public String getProtocolAdherence(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        ProtocolResponse active = protocolService.getView(userId).getActive();
        if (active == null) {
            return "Protokoll-követés: nincs aktív protokoll";
        }
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(d - 1L);
        Set<UUID> protocolItems = new HashSet<>(active.getSelectedPantryItemIds());
        // v0.5 simplification: adherence vs the CURRENT active protocol across the whole window
        Map<LocalDate, Set<UUID>> takenByDay = supplementIntakeRepository
                .findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(userId, from)
                .stream()
                .collect(Collectors.groupingBy(SupplementIntakeEntity::getTakenDate,
                        Collectors.mapping(SupplementIntakeEntity::getPantryItemId, Collectors.toSet())));
        StringBuilder b = new StringBuilder("Protokoll-követés (utolsó ").append(d).append(" nap): aktív protokoll v")
                .append(active.getVersion()).append(", ").append(protocolItems.size()).append(" elem");
        int takenTotal = 0;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            long taken = takenByDay.getOrDefault(date, Set.of()).stream().filter(protocolItems::contains).count();
            takenTotal += (int) taken;
            b.append('\n').append(date).append(": ").append(taken).append('/').append(protocolItems.size());
        }
        int expectedTotal = protocolItems.size() * d;
        if (expectedTotal > 0) {
            b.append("\nÖsszesen: ").append(takenTotal).append('/').append(expectedTotal)
                    .append(" (").append(Math.round(takenTotal * 100.0 / expectedTotal)).append("%)");
        }
        ToolContexts.audit(toolContext).addRef("Protocol", "v" + active.getVersion());
        return b.toString();
    }
}
