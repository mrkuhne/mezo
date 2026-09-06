package io.mrkuhne.mezo.feature.companion;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port az életcélok gráf-árnyékolásához (mezo-iizd.11) — a {@link LifeGoalSource} testvére,
 * ugyanazzal az irány-szabállyal: a lifegoal implementálja
 * ({@code lifegoal/service/LifeGoalCompanionAdapter}), a companion csak fogyasztja. A fordított
 * import 2-szeletes ciklust zárna (a lifegoal már függ a companiontól), amit az ArchUnit
 * {@code feature_slices_are_cycle_free} tilt.
 *
 * <p>Szándékosan MINIMÁLIS: a {@code GraphPromotionService} csak azt kapja meg, amiből egy GOAL
 * node felépül — azonosító, cím, státusz. A pillérek, tervek és a haladás a {@link LifeGoalSource}
 * dolga, az a prompt-blokké; a gráf ennél kevesebbet tud, és kevesebbet is kell tudnia.
 *
 * <p>MINDEN életcélt ad vissza, nem csak az aktívakat: a promóter maga dönti el, hogy a nem
 * aktív cél node-ját archiválja ({@code syncLifeGoal}), és a komplementer-söprésnek is látnia
 * kell a parkolt/lezárt célokat. A bean csak {@code LIFEGOAL_SWITCH} mellett létezik —
 * {@code ObjectProvider}-rel fogyaszd; hiányzó bean = nincs életcél-node, sosem kitalált cél.
 */
public interface LifeGoalGraphSource {

    /** {@code status} NYERS kulcsként (active|parked|closed|draft) — a promóter csak az
     *  „aktív-e" kérdést teszi fel rá, a magyar szót senki nem innen veszi. */
    record GraphGoal(UUID id, String title, String status) {}

    List<GraphGoal> all(UUID userId);

    Optional<GraphGoal> find(UUID userId, UUID goalId);
}
