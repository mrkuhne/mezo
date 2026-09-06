package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.LifeGoalText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * mezo-iizd.10: a {@code [Célok]} blokk — aktív életcélok (cím · dimenzió · heti nyíl szóként ·
 * mai pillér-számláló), a leggyengébb pillér, és a ma élő ha–akkor tervek. A {@link LifeGoalSource}
 * porton olvas (ObjectProvider — a LIFEGOAL_SWITCH független a COMPANION_SWITCH-től, hiányzó bean
 * = „nincs adat"); companion → lifegoal import TILOS (2-szeletes ciklus). A „Ma él" TÉNY, nem
 * nudge: az emlékeztetőt a LifeGoalTriggerService feed-értesítése viszi (dedupKey), a prompt-
 * útmutató mondja ki, hogy a companion ne ismételje. A user döntése (2026-09-05) szerint a blokk
 * a REGGELI variánsba is bekerül — eltérés az [Emberek] chat-only precedensétől.
 *
 * <p>IDENT-3 (a PeopleSnapshotBlock kaveátja szó szerint): a catch-RuntimeException degradál, de
 * egy DataAccessException a körülvevő ChatService.prepareTurn tranzakciót így is rollback-only-ra
 * teszi — bevett precedens, nem bővítjük savepointtal.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LifeGoalSnapshotBlock {

    static final String HEADER_PREFIX = "[Célok]";
    static final String NO_DATA = HEADER_PREFIX + " " + ContextSnapshotAssembler.NO_DATA;
    static final String NO_ACTIVE = HEADER_PREFIX + " nincs aktív életcél";

    private final ObjectProvider<LifeGoalSource> lifeGoalSource;
    private final CompanionProperties properties;

    /** "" ha konfigurálva ki; egyébként a teljes blokk ZÁRÓ újsor nélkül. */
    public String render(UUID userId, LocalDate today) {
        int max = properties.snapshot().lifegoalMaxGoals();
        if (max == 0) {
            return "";
        }
        try {
            LifeGoalSource source = lifeGoalSource.getIfAvailable();
            if (source == null) {
                return NO_DATA;
            }
            LifeGoalSource.Summary summary = source.summary(userId, today);
            if (summary.goals().isEmpty()) {
                return NO_ACTIVE;
            }
            StringBuilder b = new StringBuilder(HEADER_PREFIX).append(" (aktív életcélok, max ").append(max).append(')');
            summary.goals().stream().limit(max).forEach(g -> b.append('\n')
                .append(PeopleSnapshotBlock.sanitize(g.title()))
                .append(" [").append(LifeGoalText.dimensionHu(g.dimension())).append("] · ")
                .append(LifeGoalText.arrowWord(g.arrow())).append(" · ma ")
                .append(g.pillarsHitToday()).append('/').append(g.pillarsTotal()).append(" pillér"));
            if (summary.weakestPillar() != null) {
                b.append("\nLeggyengébb pillér: ").append(PeopleSnapshotBlock.sanitize(summary.weakestPillar()));
            }
            summary.livePlans().forEach(plan ->
                b.append("\nMa él: ").append(PeopleSnapshotBlock.sanitize(plan)));
            return b.toString();
        } catch (RuntimeException e) {
            log.warn("[Célok] block render failed for user {} — degrades to 'nincs adat'; a "
                + "DataAccessException here still poisons the surrounding transaction (IDENT-3)", userId, e);
            return NO_DATA;
        }
    }
}
