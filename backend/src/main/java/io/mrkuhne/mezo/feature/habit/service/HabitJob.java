package io.mrkuhne.mezo.feature.habit.service;

import java.util.UUID;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly habit close cron (bd mezo-d1jb): the lazy GET path closes past days for active users;
 * this backstops the rest. End-of-day metrics evaluate honestly (caffeine cutoff, kitchen close),
 * the remaining pending rows quietly miss. Per-user failures are isolated; the pass is idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.HABIT_SWITCH, FeaturesConfiguration.HABIT_JOB_SWITCH},
        havingValue = "true")
public class HabitJob {

    private final UserFanOut userFanOut;
    private final HabitService habitService;
    private final HabitCatalogService catalogService;

    @Scheduled(cron = "${mezo.habit.close-cron}")
    public void runClose() {
        LocalDate today = LocalDate.now();
        userFanOut.forEachActiveUser("Habit close", user -> {
            try {
                habitService.closePast(user.getId(), today);
                // mezo-0cbh: a zárás UTÁN, ugyanabban a per-user try-ban — a formálódás a nap
                // lezárt sorait olvassa, és egy értesítés-ág sosem viheti el a zárást (a fanout
                // catch ugyanaz), viszont a küszöb-átlépés így aznap éjjel kiderül.
                emitFormationCrossings(user.getId());
            } catch (Exception e) {
                log.warn("Habit close failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Habit close run for {} complete", today);
    }

    /**
     * Szokásonként egy formálódás-becslés, és aki átlépte a küszöböt, arra egy feed-sor
     * (mezo-0cbh). A duplázás ellen NEM ez a metódus véd, hanem a feed dedup-kulcsa — ez a
     * ciklus minden éjjel újra végigfut a küszöb fölötti szokásokon, és mindegyikre no-op lesz.
     *
     * <p>A becslés a def TELJES élettartamát szkenneli (a doksi ezért nem engedi a
     * {@code summary()} útjára, amit minden chat-forduló olvas) — éjjel, szokásonként egyszer
     * viszont elfér. Egy szokás hibája nem viszi el a többit.
     */
    private void emitFormationCrossings(UUID userId) {
        for (HabitDefEntity def : catalogService.ensureCatalog(userId)) {
            try {
                habitService.emitFormationIfCrossed(userId, def.getHabitKey());
            } catch (Exception e) {
                log.warn("Formation check failed for user {} habit {}", userId, def.getHabitKey(), e);
            }
        }
    }

}
