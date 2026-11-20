package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.port.SeasonContextPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Boop B6 Évad S2 (mezo-r36n9.16): {@code get_season}, the read tool next to {@code get_goal}. Pure composition over
 * the companion-owned {@link SeasonContextPort} (the season feature renders the lines). Scopes: {@code overview}
 * (default — week, status, last week's adherence, insights) and {@code rules} (the season's rules, the same lines the
 * context snapshot carries). {@code menu} / {@code experiment} arrive with S3 / S4.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SeasonTools {

    private static final List<String> SCOPES = List.of("overview", "rules");
    static final String NO_SEASON = "Évad: nincs aktív évad";

    private final SeasonContextPort seasonContext;

    @Tool(name = "get_season", description = "Az aktív évad (egy több hetes terv, ami összeköti az edzést, az étkezést, "
            + "az alvást és a súlycélt). scope=overview (alapértelmezés) — hányadik hétnél tart, hogyan halad a "
            + "súly a tervhez képest, az elmúlt 7 nap betartása (étel a kereten belül, megtartott edzések, elég "
            + "alvás, kímélő/indokolt kihagyás miatt kivett napok) és amit Boop észrevett. scope=rules — az évad "
            + "szabályai: cél és tempó vagy sáv, e heti edzés- és sportnapok, edzés- és pihenőnapi kcal és fehérje, "
            + "a kiválasztott receptek szabálya, a feldolgozottsági (NOVA) szabály, alvásigény és lefekvés. "
            + "Használd, amikor a user az évadáról, a terve szabályairól, vagy arról kérdez, hogy hogyan halad.")
    public String getSeason(
            @ToolParam(required = false, description = "overview|rules (alapértelmezés: overview).") String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LocalDate today = LocalDate.now();
        String out = "rules".equals(normalize(scope))
                ? seasonContext.render(userId, today)
                : seasonContext.overview(userId, today);
        if (out == null || out.isBlank()) {
            return NO_SEASON;
        }
        ToolContexts.audit(toolContext).addRef("Season", "active");
        return out;
    }

    private static String normalize(String scope) {
        if (scope == null) {
            return "overview";
        }
        String s = scope.trim().toLowerCase(Locale.ROOT);
        return SCOPES.contains(s) ? s : "overview";
    }
}
