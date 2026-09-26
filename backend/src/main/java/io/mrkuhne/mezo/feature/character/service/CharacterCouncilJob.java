package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.CHARACTER_COUNCIL_JOB_SWITCH}, havingValue = "true")
public class CharacterCouncilJob {
    private final UserFanOut users;
    private final CharacterCouncilService council;
    private final CharacterCouncilProperties properties;
    private final CharacterObservationService observationService;
    private final CharacterRunLog runLog;
    private final io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository runs;
    private final ObjectProvider<TeamEditionService> editions;
    private final io.mrkuhne.mezo.feature.character.repository.CharacterCouncilEditionRepository councilEditions;

    @Scheduled(cron = "${mezo.character.council.cron}", zone = "${mezo.character.council.zone}")
    public void run() {
        run(ZonedDateTime.now(ZoneId.of(properties.zone())));
    }

    /** The tick body at an explicit local time — package-visible so tests can pin the clock. */
    void run(ZonedDateTime now) {
        if (now.toLocalTime().isBefore(LocalTime.parse(properties.readyAt()))) return;
        boolean deadlinePassed = !now.toLocalTime().isBefore(LocalTime.parse(properties.editionDeadline()));
        var today = now.toLocalDate();
        users.forEachActiveUser("Daily character council", user -> {
            for (int offset = properties.catchUpDays() - 1; offset >= 0; offset--) {
                var day = today.minusDays(offset);
                try {
                    var prior = runs.findByCreatedByAndKindAndDay(user.getId(), "NIGHTLY", day.minusDays(1));
                    if (prior.isEmpty() || (!"SUCCESS".equals(prior.get().getStatus())
                            && prior.get().getFailureCount() < properties.maxAttempts())) {
                        try { observationService.generateForDay(user.getId(), day.minusDays(1)); }
                        catch (RuntimeException failure) {
                            runLog.recordObservationFailure(user.getId(), day.minusDays(1));
                            throw failure;
                        }
                    }
                    council.run(user.getId(), day);
                }
                catch (RuntimeException e) { log.warn("Daily council failed for owner {} day {}", user.getId(), day, e); }

                // Esti kiadás (mezo-a9bo7, ADR 0052): a konzílium fenti try/catch-ÉN KÍVÜL, saját
                // try/catch-ben — a kiadás akkor is megszülethet, ha a konzílium (vagy a rá épülő
                // megfigyelés-generálás) ezen a napon hibázott, és egy kiadás-hiba sosem dönti be
                // a konzíliumot. CSAK a MAI napra (offset == 0): a kiadás sosem "pótol" egy
                // kimaradt korábbi napot — spec: "utána a nap kimarad, őszinte hiány, nem pótlás".
                // TeamEditionService#run idempotens (a (created_by, day) élő kiadás gyors
                // SELECT-je), ezért veszélytelen minden 15 perces tiken újra meghívni a mai napra:
                // egy sikertelen/hiányzó kiadás magától újrapróbálkozik a következő tiken
                // 23:45-ig, egy már kész kiadás pedig azonnal no-op.
                // mezo-a9bo7.17: a kiadás megvárja, hogy a mai konzílium LEZÁRULJON (kész, csendes,
                // vagy elfogyott az újrapróbálása) — különben egy csendben elbukott első futás után a
                // 21:00-s kiadás konzílium-szálak nélkül jelenne meg, és a késői sikeres újrapróbálás
                // már sosem kerülhetne bele (a kiadás naponta egyszeri). A határidő (edition-deadline,
                // 23:30) után a kiadás mindenképp megjelenik: a nap sosem marad kiadás nélkül azért,
                // mert a konzílium beragadt.
                if (offset == 0 && (deadlinePassed || councilSettled(user.getId(), day))) {
                    try { editions.ifAvailable(svc -> svc.run(user.getId(), day)); }
                    catch (RuntimeException e) { log.warn("Esti kiadás failed for owner {} day {}", user.getId(), day, e); }
                }
            }
        });
    }

    /** Lezárult-e a nap konzíliuma: kész/csendes, elfogyott az újrapróbálása, vagy a bemenete
     *  (az előző éjszakai megfigyelés) véglegesen elbukott, így már sosem indulhat el. */
    private boolean councilSettled(java.util.UUID owner, LocalDate day) {
        var edition = councilEditions.findByCreatedByAndDay(owner, day).orElse(null);
        if (edition != null) {
            if ("COMPLETED".equals(edition.getStatus()) || "QUIET".equals(edition.getStatus())) return true;
            if (!"PROCESSING".equals(edition.getStatus()) && edition.getAttempts() >= properties.maxAttempts()) return true;
        }
        return runs.findByCreatedByAndKindAndDay(owner, "NIGHTLY", day.minusDays(1))
                .filter(run -> !"SUCCESS".equals(run.getStatus()) && run.getFailureCount() >= properties.maxAttempts())
                .isPresent();
    }
}
