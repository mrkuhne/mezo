package io.mrkuhne.mezo.feature.companion;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Port a [Célok] snapshot-blokkhoz és a get_life_goals toolhoz (mezo-iizd.10): a companion csak
 * annyit tud, hogy „mik az aktív életcélok és hogy állnak" — a HOGYAN a feature/lifegoal dolga,
 * amely implementálja ({@code lifegoal/service/LifeGoalCompanionAdapter}). Az irány lifegoal →
 * companion marad (a lifegoal már függ a companiontól: MetricSignalSource, LifeGoalProposePort —
 * a fordított import 2-szeletes ciklust zárna, feature_slices_are_cycle_free). A bean csak
 * LIFEGOAL_SWITCH mellett létezik; ObjectProvider-rel fogyasztd — hiányzó bean „nincs adat",
 * sosem kitalált cél. A ha–akkor NUDGE a LifeGoalTriggerService feed-értesítéséé (dedupKey
 * goalId:planKey:day) — az itteni „ma él" tény-állítás, nem második nudge-csatorna.
 */
public interface LifeGoalSource {

    /** A [Célok] blokk tömör összefoglalója. Arrow/dimension NYERS kulcsként (up|flat|down|
     *  insufficient; positive_emotion|…|health) — a magyar szót a renderelő adja. */
    record Summary(List<GoalLine> goals, String weakestPillar, List<String> livePlans) {}

    record GoalLine(String title, String dimension, String arrow, int pillarsHitToday, int pillarsTotal) {}

    /** A get_life_goals tool gazdag nézete — célonként pillérek + tervek. */
    record Details(List<GoalDetail> goals) {}

    record GoalDetail(String title, String dimension, String frame, String arrow,
                      Integer weekPercent, List<PillarLine> pillars, List<PlanLine> plans) {}

    /** {@code hitToday} null = ma nincs adat a pillérre; {@code arrow} a pillér heti nyila. */
    record PillarLine(String label, String kind, Boolean hitToday, String arrow) {}

    record PlanLine(String ha, String akkor, boolean liveToday) {}

    Summary summary(UUID userId, LocalDate today);

    Details details(UUID userId, LocalDate today);
}
