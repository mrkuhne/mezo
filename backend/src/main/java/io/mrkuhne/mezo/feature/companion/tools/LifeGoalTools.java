package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * mezo-iizd.10: életcél-lekérdező tool. EGYEDÜLIKÉNT a toolok közt NEM a saját feature-jét
 * importálja, hanem a {@link LifeGoalSource} porton renderel — a companion → lifegoal import
 * 2-szeletes ciklust zárna (a lifegoal már függ a companiontól). A [Célok] snapshot-blokk a
 * tömör összefoglaló; ez a tool a gazdag nézet, amikor a user rákérdez.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LifeGoalTools {

    private final ObjectProvider<LifeGoalSource> lifeGoalSource;

    @Tool(name = "get_life_goals", description = "Az aktív ÉLETCÉLOK (PERMAH-életterületek) "
            + "részletes állása: célonként cím, életterület (Érzelem/Elmélyülés/Kapcsolatok/"
            + "Értelem/Teljesítmény/Egészség), keret, heti irány és heti szint (%), a pillérek "
            + "(mai találat + heti irány), és a ha–akkor tervek (melyik él ma). Használd, amikor "
            + "a user az életcéljairól, életterületeiről, pillérjeiről, ha–akkor terveiről kérdez "
            + "(pl. „hogy állok a kapcsolatok célommal?”, „melyik pillérem a leggyengébb?”). "
            + "A számszerű súly/kalória-célhoz NEM ez kell, az a get_goal.")
    public String getLifeGoals(ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LifeGoalSource source = lifeGoalSource.getIfAvailable();
        if (source == null) {
            return "Életcél: az életcél-modul ki van kapcsolva";
        }
        LifeGoalSource.Details details = source.details(userId, LocalDate.now());
        if (details.goals().isEmpty()) {
            return "Életcél: nincs aktív életcél";
        }
        StringBuilder b = new StringBuilder();
        for (LifeGoalSource.GoalDetail goal : details.goals()) {
            if (!b.isEmpty()) {
                b.append('\n');
            }
            b.append("Életcél: ").append(goal.title())
                .append(" [").append(LifeGoalText.dimensionHu(goal.dimension())).append(']')
                .append(", heti irány: ").append(LifeGoalText.arrowWord(goal.arrow()));
            if (goal.weekPercent() != null) {
                b.append(", heti szint: ").append(goal.weekPercent()).append('%');
            }
            if (!goal.pillars().isEmpty()) {
                b.append("\nPillérek:");
                for (LifeGoalSource.PillarLine p : goal.pillars()) {
                    b.append("\n- ").append(p.label())
                        .append(" — ma: ").append(p.hitToday() == null ? ToolText.NO_DATA
                            : (p.hitToday() ? "talált" : "nem talált"))
                        .append(", heti irány: ").append(LifeGoalText.arrowWord(p.arrow()));
                }
            }
            if (!goal.plans().isEmpty()) {
                b.append("\nHa–akkor tervek:");
                for (LifeGoalSource.PlanLine p : goal.plans()) {
                    b.append("\n- ").append(p.ha()).append(", ").append(p.akkor());
                    if (p.liveToday()) {
                        b.append(" (MA ÉL)");
                    }
                }
            }
            ToolContexts.audit(toolContext).addRef("LifeGoal", goal.title());
        }
        return b.toString();
    }
}
