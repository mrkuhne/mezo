package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.season.entity.SeasonMenuMealEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonMenuWeekEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuMealRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuWeekRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code get_season scope=menu} (Évad S3): this and next week's menu as {@code "[Évad] "} lines. Never throws — a
 * context renderer must not break a chat turn; without a season or a menu it returns {@code ""}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MenuContextRenderer {

    private static final String[] DAYS = {"Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"};

    private final SeasonRepository seasons;
    private final SeasonMenuWeekRepository weeks;
    private final SeasonMenuMealRepository meals;

    @Transactional(readOnly = true)
    public String render(UUID owner, LocalDate today) {
        try {
            if (seasons.findActive(owner).isEmpty()) {
                return "";
            }
            LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            List<String> lines = new ArrayList<>();
            for (LocalDate start : List.of(monday, monday.plusWeeks(1))) {
                weeks.findByCreatedByAndWeekStart(owner, start).ifPresent(w -> lines.addAll(week(w, start.equals(monday))));
            }
            return lines.isEmpty() ? "[Évad] Heti menü: még nincs." : String.join("\n", lines);
        } catch (RuntimeException e) {
            log.warn("Season menu context failed for {}", owner, e);
            return "";
        }
    }

    private List<String> week(SeasonMenuWeekEntity w, boolean current) {
        List<String> out = new ArrayList<>();
        out.add("[Évad] " + (current ? "E heti" : "Jövő heti") + " menü (" + w.getWeekStart() + "-tól, "
            + (w.approved() ? "jóváhagyva" : "jóváhagyásra vár") + (w.isRepeated() ? ", kevés recept miatt ismétlődik" : "")
            + "):");
        Map<LocalDate, List<SeasonMenuMealEntity>> byDay = new LinkedHashMap<>();
        meals.findByWeekIdOrderByMealDateAscIdAsc(w.getId()).stream()
            .sorted(Comparator.comparing(SeasonMenuMealEntity::getMealDate).thenComparing(SeasonMenuMealEntity::getAtMin))
            .forEach(m -> byDay.computeIfAbsent(m.getMealDate(), k -> new ArrayList<>()).add(m));
        byDay.forEach((date, ms) -> {
            StringBuilder b = new StringBuilder("[Évad] ").append(DAYS[date.getDayOfWeek().getValue() - 1]).append(": ");
            for (int i = 0; i < ms.size(); i++) {
                SeasonMenuMealEntity m = ms.get(i);
                if (i > 0) {
                    b.append("; ");
                }
                b.append(m.getLabel()).append(" – ").append(m.getName()).append(" (").append(m.getKcal()).append(" kcal)");
            }
            out.add(b.toString());
        });
        return out;
    }
}
