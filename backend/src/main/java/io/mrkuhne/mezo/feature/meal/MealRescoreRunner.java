package io.mrkuhne.mezo.feature.meal;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Egyszeri adatjavítás (mezo-jcpt.2): a mezo-jcpt.1 ELŐTT írt {@code meal.breakdown} envelope-ok
 * súlyai nem renormalizáltak (degradált dimenzió mellett Σ≈0.34), miközben a tárolt
 * {@code meal.score} már el volt osztva a súlyösszeggel — a {@code ScoreLedger} kliensoldali Σ-ja
 * ezért széttart a fejléc-pontszámtól. Ez a runner ezeket a sorokat a VALÓDI write-path-on
 * ({@link MealService#rescore}) pontozza újra, így a formula nem duplikálódik SQL-be.
 *
 * <p><b>Idempotens</b> a verzióbélyegen keresztül: a munkalista
 * {@link MealRepository#findStaleEnvelopes} „ahol a generáció &lt; {@link
 * MealScoringService#FORMULA_VERSION}", tehát a második futás szerkezetileg 0 sort érint. Ez az,
 * ami a meal-envelope „frozen at write" szándékát megőrzi: a történelem egyszeri, dátumozott,
 * verziózott helyreállítást kap, nem egy folyamatosan újraíró viselkedést.
 *
 * <p>{@code @Profile("demodata")} — a prod-ban aktív profil, tehát prodon a következő deploykor
 * lefut. Az őr arra kell, hogy a bean a TÖBBI integrációs-teszt kontextusban ne létezzen: a
 * {@code MealPopulator.createScoredMeal} kézzel gyárt bélyeg nélküli envelope-ot, egy őrizetlen
 * runner tehát idegen tesztek fixture-jeit pontozná újra. {@code @Order(210)} a
 * {@code GoalReevaluateRunner} (200) UTÁN fut, mert az újrapontozás a cél-előírásból származó
 * {@code DailyTargets}-et olvassa.
 *
 * <p>A cache-oldal nem itt van: a {@code weekly_score} sorokat egy egyszeri Liquibase changeset
 * üríti (a frissesség-próba {@code created_at}-et olvas, egy re-score viszont UPDATE), a
 * {@code day_review} pedig az {@code inputsHash}-en keresztül magától invalidálódik.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(210)
@RequiredArgsConstructor
public class MealRescoreRunner implements CommandLineRunner {

    private final MealRepository mealRepository;
    private final MealService mealService;

    /** CommandLineRunner belépési pont (indulás). */
    @Override
    public void run(String... args) {
        run();
    }

    /**
     * No-arg overload — az integrációs teszt belépési pontja. Szándékosan NEM
     * {@code @Transactional}: minden étkezés a saját {@link MealService#rescore} tranzakciójában
     * gyógyul, így egy hibás sor nem visz magával egy egész backfillt, és a self-invocation
     * proxy-csapda fel sem merül. A hibaizoláció a batch szintjén is érvényesül: egy dobó sort a
     * ciklus itt elkap és kihagy, mert a {@code CommandLineRunner}-ből kiszivárgó kivétel az egész
     * alkalmazásindítást megállítaná — a kihagyott sor a következő induláskor (idempotens
     * megtalálón keresztül) újra próbálkozik.
     *
     * @return a ténylegesen újrapontozott étkezések száma
     */
    public int run() {
        List<UUID> stale = mealRepository.findStaleEnvelopes(MealScoringService.FORMULA_VERSION)
            .stream().map(MealEntity::getId).toList();
        if (stale.isEmpty()) {
            return 0;
        }
        int healed = 0;
        for (UUID id : stale) {
            try {
                if (mealService.rescore(id)) {
                    healed++;
                }
            } catch (RuntimeException e) {
                log.warn("Re-score failed for meal {} — skipped, retried on the next start: {}",
                    id, e.getMessage());
            }
        }
        log.info("Re-scored {} meal envelope(s) to formula version {} (mezo-jcpt.2); "
            + "prose sockets cleared, the coach regenerates them lazily.",
            healed, MealScoringService.FORMULA_VERSION);
        return healed;
    }
}
