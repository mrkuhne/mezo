package io.mrkuhne.mezo.feature.character.service.edition;

import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.EditionRef;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Forrás → esti kiadás jelölt (Task 4, spec 2026-09-24 §3): a mintákat, a monitor-párokat, az
 * előrejelzéseket, a kísérleteket és a napi konzílium szálait fésüli {@link EditionCandidate}
 * listává — a leképezési szabályok a FE {@code teamFeed.ts} útvonal-mintáit (sourceRoute,
 * karakter-gazda) követik SZÓ SZERINT, ahogy a brief táblázata rögzíti. A rangsorolás/válogatás
 * NEM ez a felelőssége — az {@link EditionSelector} dolga.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class EditionCandidateCollector {

    static final String SOURCE_PATTERN = "pattern";
    static final String SOURCE_PAIR = "pair";
    static final String SOURCE_PREDICTION = "prediction";
    static final String SOURCE_EXPERIMENT = "experiment";
    static final String SOURCE_KONZILIUM = "konzilium";

    /** A gyűlik-jelölt sávja (spec táblázat 3. sor): `5 <= n < minN`. */
    private static final int PAIR_MIN_N = 5;

    /** Nincs megosztott ZoneId bean/constant a repóban (Task 4 döntés) — a helyi idiómát követi
     *  ({@code TrainingStreakCalculator}, {@code MedicationCycleService}: saját fájl-szintű
     *  konstans), mert a megosztott létező konstansok más feature-ökben élnek, amikbe a character
     *  réteg nem függ bele. */
    private static final ZoneId EDITION_ZONE = ZoneId.of("Europe/Budapest");

    private static final int EDITION_HOUR = 21;

    private final TeamEditionReads reads;

    public List<EditionCandidate> collect(UUID owner, LocalDate day, Instant lastEditionAt) {
        List<EditionCandidate> out = new ArrayList<>();
        PatternMonitorResponse monitor = reads.monitor(owner);
        Map<String, PatternMonitorPair> pairsByKey = monitor.getPairs().stream()
                .collect(Collectors.toMap(PatternMonitorPair::getKey, p -> p, (a, b) -> a));

        for (PatternEntity pattern : reads.patterns(owner)) {
            patternCandidate(pattern, pairsByKey, lastEditionAt).ifPresent(out::add);
        }
        for (PatternMonitorPair pair : monitor.getPairs()) {
            pairCandidate(pair, monitor.getMinN()).ifPresent(out::add);
        }
        for (PredictionEntity prediction : reads.resolvedPredictions(owner, day.minusDays(7), day)) {
            out.add(predictionCandidate(prediction));
        }
        for (ExperimentEntity experiment : reads.activeExperiments(owner)) {
            experimentCandidate(experiment, day).ifPresent(out::add);
        }
        reads.dailyConference(owner, day).ifPresent(conference -> out.addAll(konziliumCandidates(conference)));
        return List.copyOf(out);
    }

    /** Sor 1 (`proposed` → KERDES) és sor 2 (`confirmed` és friss → MEGFIGYELES). */
    private Optional<EditionCandidate> patternCandidate(PatternEntity pattern,
            Map<String, PatternMonitorPair> pairsByKey, Instant lastEditionAt) {
        if (PatternEntity.STATUS_PROPOSED.equals(pattern.getStatus())) {
            return Optional.of(patternCandidate(pattern, pairsByKey, EditionGenre.KERDES, true));
        }
        if (PatternEntity.STATUS_CONFIRMED.equals(pattern.getStatus())
                && pattern.getLastDetectedAt() != null
                && (lastEditionAt == null || pattern.getLastDetectedAt().isAfter(lastEditionAt))) {
            return Optional.of(patternCandidate(pattern, pairsByKey, EditionGenre.MEGFIGYELES, false));
        }
        return Optional.empty();
    }

    private EditionCandidate patternCandidate(PatternEntity pattern, Map<String, PatternMonitorPair> pairsByKey,
            EditionGenre genre, boolean waiting) {
        PatternMonitorPair pair = pairsByKey.get(pattern.getPairKey());
        TeamCharacter character = pair != null
                ? TeamCharacter.forMetricDomain(pair.getMetricADomain())
                : TeamCharacter.MEZO;
        List<String> facts = pattern.getN() != null && pattern.getN() > 0
                ? List.of(String.format("%d nap", pattern.getN()))
                : List.of();
        String id = pattern.getId().toString();
        return new EditionCandidate(SOURCE_PATTERN, id, character, genre, pattern.getTitle(),
                pattern.getMechanism(), facts, List.of(new EditionRef(SOURCE_PATTERN, id)),
                waiting, false, pattern.getLastDetectedAt(), "/mezo/patterns/" + pattern.getPairKey());
    }

    /** Sor 3 (monitor pár, `5 <= n < minN` → SEJTES „gyűlik"). */
    private Optional<EditionCandidate> pairCandidate(PatternMonitorPair pair, Integer minN) {
        Integer n = pair.getN();
        if (n == null || minN == null || n < PAIR_MIN_N || n >= minN) {
            return Optional.empty();
        }
        TeamCharacter character = TeamCharacter.forMetricDomain(pair.getMetricADomain());
        List<String> facts = List.of(
                String.format("%d közös nap", n),
                String.format("%d kell", minN));
        return Optional.of(new EditionCandidate(SOURCE_PAIR, pair.getKey(), character, EditionGenre.SEJTES,
                pair.getTitle(), pair.getTitle(), facts, List.of(new EditionRef(SOURCE_PAIR, pair.getKey())),
                false, false, null, "/mezo/patterns/" + pair.getKey()));
    }

    /** Sor 4 (`validated`/`missed`, `validTo` a [day-7,day] ablakban → ELOREJELZES). */
    private EditionCandidate predictionCandidate(PredictionEntity prediction) {
        TeamCharacter character = domainCharacterFor(prediction.getMetricKey());
        String recordText = isBlank(prediction.getActual()) ? prediction.getBasis() : prediction.getActual();
        Instant changedAt = atEditionHour(prediction.getValidTo());
        String id = prediction.getId().toString();
        return new EditionCandidate(SOURCE_PREDICTION, id, character, EditionGenre.ELOREJELZES, null,
                recordText, List.of(), List.of(new EditionRef(SOURCE_PREDICTION, id)),
                false, false, changedAt, "/mezo/predictions/" + id);
    }

    /** Sor 5 (`active`, a futó nap ∈ {1, ceil(total/2), total} → KISERLET). */
    private Optional<EditionCandidate> experimentCandidate(ExperimentEntity experiment, LocalDate day) {
        LocalDate startDate = experiment.getStartDate();
        Integer total = experiment.getTotalDays();
        if (startDate == null || total == null || total <= 0) {
            return Optional.empty();
        }
        long dayNo = ChronoUnit.DAYS.between(startDate, day) + 1;
        if (dayNo < 1 || dayNo > total) {
            return Optional.empty();
        }
        long midDay = (total + 1L) / 2; // ceil(total/2)
        if (dayNo != 1 && dayNo != midDay && dayNo != total) {
            return Optional.empty();
        }
        TeamCharacter character = domainCharacterFor(experiment.getMetricKey());
        List<String> facts = List.of(
                String.format("%d. nap", dayNo),
                String.format("%d napból", total));
        Instant changedAt = atEditionHour(startDate.plusDays(dayNo - 1));
        String id = experiment.getId().toString();
        return Optional.of(new EditionCandidate(SOURCE_EXPERIMENT, id, character, EditionGenre.KISERLET,
                experiment.getTitle(), experiment.getHypothesis(), facts,
                List.of(new EditionRef(SOURCE_EXPERIMENT, id)), false, false, changedAt,
                "/mezo/experiments/" + id));
    }

    /**
     * Sor 6 (DAILY konzílium, minden szál → KONZILIUM). A „szál vezető expertKey"-t a legszorosabb
     * szó szerinti olvasat szerint a szál ELSŐ item-jének javaslattevője adja (Task 4 döntés — a
     * {@link ConferenceDeliberationEnvelope.Thread} nem hordoz külön „lead" mezőt); a recordText
     * ugyanennek az itemnek a szövege. `claimChange` akkor igaz, ha az outcome legalább egy
     * változása ugyanazt a {@code dimensionKey}-t érinti, mint a szálé (legacy, dimenzió nélküli
     * szál sosem `claimChange`).
     */
    private List<EditionCandidate> konziliumCandidates(CharacterConferenceEntity conference) {
        ConferenceDeliberationEnvelope deliberation = conference.getDeliberation();
        if (deliberation == null || deliberation.threads() == null) {
            return List.of();
        }
        List<ConferenceOutcomeEnvelope.Change> changes = Optional.ofNullable(conference.getOutcome())
                .map(ConferenceOutcomeEnvelope::changes)
                .orElse(List.of());

        List<EditionCandidate> out = new ArrayList<>();
        List<ConferenceDeliberationEnvelope.Thread> threads = deliberation.threads();
        for (int i = 0; i < threads.size(); i++) {
            ConferenceDeliberationEnvelope.Thread thread = threads.get(i);
            if (thread.items() == null || thread.items().isEmpty()) {
                continue; // nincs vezető item — nincs mit posztolni
            }
            ConferenceDeliberationEnvelope.Item firstItem = thread.items().get(0);
            TeamCharacter character = TeamCharacter.postableOr(TeamCharacter.forPersona(firstItem.expertKey()));
            boolean claimChange = thread.dimensionKey() != null && changes.stream()
                    .anyMatch(change -> thread.dimensionKey().equals(change.dimensionKey()));
            String sourceId = conference.getId() + ":" + i;
            out.add(new EditionCandidate(SOURCE_KONZILIUM, sourceId, character, EditionGenre.KONZILIUM, null,
                    firstItem.text(), List.of(), List.of(new EditionRef(SOURCE_KONZILIUM, sourceId)),
                    false, claimChange, conference.getGeneratedAt(), "/mezo/karakter/konzilium"));
        }
        return out;
    }

    /** A `metricKey` doménje a {@link MetricKey} enum wire-kulcsán át; ismeretlen kulcs → MEZO. */
    private static TeamCharacter domainCharacterFor(String metricKey) {
        return Arrays.stream(MetricKey.values())
                .filter(key -> key.wireKey().equals(metricKey))
                .findFirst()
                .map(key -> TeamCharacter.forMetricDomain(key.domain().wireKey()))
                .orElse(TeamCharacter.MEZO);
    }

    private static Instant atEditionHour(LocalDate date) {
        return date.atStartOfDay(EDITION_ZONE).plusHours(EDITION_HOUR).toInstant();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
