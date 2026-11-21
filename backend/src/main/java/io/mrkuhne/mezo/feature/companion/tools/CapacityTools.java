package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.port.CapacityContextPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Boop B7 K2 (mezo-r36n9.17): {@code get_capacity}, the read tool for the day's verdict. Pure composition over the
 * companion-owned {@link CapacityContextPort}; the capacity feature words the lines, nothing here invents a number.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CapacityTools {

    static final String NO_DATA = "Kapacitás: nincs adat";

    private final CapacityContextPort capacity;

    @Tool(name = "get_capacity", description = "Mennyire terhes a nap a testi jelekhez képest (alvás, pulzus, "
            + "naptár, edzés): laza, rendben, szoros vagy túl sok, a két fő okkal. Paraméter nélkül a mai nap; "
            + "week=ISO hét (pl. 2026-W47) vagy egy dátum a hétből — a hét hét napja hétfőtől. Használd, amikor a "
            + "user azt kérdezi, mennyire lesz tömött a napja vagy a hete, vagy hogy mikor érdemes edzeni.")
    public String getCapacity(
            @ToolParam(required = false, description = "ISO hét (2026-W47) vagy egy dátum a hétből; üresen a mai nap.")
            String week,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String out = week == null || week.isBlank() ? capacity.render(userId, LocalDate.now())
                : capacity.week(userId, week);
        if (out == null || out.isBlank()) {
            return NO_DATA;
        }
        ToolContexts.audit(toolContext).addRef("Capacity", week == null || week.isBlank() ? "today" : week.trim());
        return out;
    }
}
