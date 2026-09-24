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
        // Fix round (mezo-a9bo7.12): a poszt body NOT NULL — egy üres/hiányzó recordText-ű jelölt
        // (pl. mechanism nélküli proposed minta) minden tiken eldobná a publish-t. Egyetlen helyen
        // szűrünk: minden forrás ugyanide fut be, mielőtt a EditionSelector látná.
        return out.stream().filter(c -> !isBlank(c.recordText())).toList();
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
        // Fix round (mezo-a9bo7.12): mechanism lehet null/üres egy frissen javasolt mintán — cím
        // nélkül a poszt body-ja NOT NULL, ezért title-re esünk vissza (a collect()-végi szűrő dobja
        // el, ha még az is üres).
        String recordText = isBlank(pattern.getMechanism()) ? pattern.getTitle() : pattern.getMechanism();
        return new EditionCandidate(SOURCE_PATTERN, id, character, genre, pattern.getTitle(),
                recordText, facts, List.of(new EditionRef(SOURCE_PATTERN, id)),
                waiting, false, pattern.getLastDetectedAt(), "/mezo/patterns/" + pattern.getPairKey(),
                pair != null ? crossDomainGuest(pair, character) : List.of());
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
                false, false, null, "/mezo/patterns/" + pair.getKey(), crossDomainGuest(pair, character)));
    }

    /**
     * H4 (mezo-a9bo7.15): egy két doménes párnál a B-oldal karaktere vendégként hozzászólhat —
     * idézhető meglévő szöveg nincs, ezért a mag visszaesése null (hang nélkül kimarad).
     */
    private static List<GuestSeed> crossDomainGuest(PatternMonitorPair pair, TeamCharacter host) {
        TeamCharacter other = TeamCharacter.forMetricDomain(pair.getMetricBDomain());
        return other != host && other.postable() ? List.of(new GuestSeed(other, null)) : List.of();
    }

    /** Sor 4 (`validated`/`missed`, `validTo` a [day-7,day] ablakban → ELOREJELZES). */
    private EditionCandidate predictionCandidate(PredictionEntity prediction) {
        TeamCharacter character = domainCharacterFor(prediction.getMetricKey());
        String recordText = isBlank(prediction.getActual()) ? prediction.getBasis() : prediction.getActual();
        Instant changedAt = atEditionHour(prediction.getValidTo());
        String id = prediction.getId().toString();
        return new EditionCandidate(SOURCE_PREDICTION, id, character, EditionGenre.ELOREJELZES, null,
                recordText, List.of(), List.of(new EditionRef(SOURCE_PREDICTION, id)),
                false, false, changedAt, "/mezo/predictions/" + id, List.of());
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
                "/mezo/experiments/" + id, List.of()));
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
                    false, claimChange, conference.getGeneratedAt(), "/mezo/karakter/konzilium",
                    konziliumGuests(firstItem, character)));
        }
        return out;
    }

    /**
     * H4 (mezo-a9bo7.15): a szál vendégei — legfeljebb EGY másik résztvevő (az első olyan
     * reakció, amelynek karaktere posztolhat és nem a vezető), meg a Szkeptikus, ha a skeptic-kör
     * ítélt. A visszaesésük a SAJÁT, már elhangzott érvük; üres érvnél a mag megmarad, visszaesés
     * nélkül (ha a hang nem ad neki sort, kimarad).
     */
    private static List<GuestSeed> konziliumGuests(ConferenceDeliberationEnvelope.Item item, TeamCharacter lead) {
        List<GuestSeed> seeds = new ArrayList<>(2);
        if (item.reactions() != null) {
            item.reactions().stream()
                    .filter(reaction -> reaction != null && reaction.expertKey() != null)
                    .filter(reaction -> {
                        TeamCharacter who = TeamCharacter.forPersona(reaction.expertKey());
                        return who.postable() && who != lead;
                    })
                    .findFirst()
                    .ifPresent(reaction -> seeds.add(new GuestSeed(TeamCharacter.forPersona(reaction.expertKey()),
                            blankToNull(reaction.argument()))));
        }
        if (item.skeptic() != null) {
            seeds.add(new GuestSeed(TeamCharacter.SZKEPTIKUS, blankToNull(item.skeptic().argument())));
        }
        return seeds;
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s.strip();
    }

    /**
     * Fix round 1 (mezo-a9bo7.12): a proaktív generátorok ({@code PredictionGenerator},
     * {@code ExperimentProposalGenerator}) {@code metricKey}-je NEM a {@link MetricKey} enum
     * wire-kulcsa — saját, szűk szótáruk van ({@code PredictionEntity.METRIC_*}), a wire-kulcs
     * keresés ezekre sosem talál. {@code DiagnosisService} ezzel szemben validáltan valódi
     * {@link MetricKey} wire-kulcsot ír (lásd {@code DiagnosisSuspectsEnvelope.Suspect} javadoc) —
     * azt már az első lépés (wire-kulcs keresés) helyesen feloldja. Ez a táblázat a generátorok
     * TELJES, kódban rögzített szótárát fedi le (grep-elve: {@code VALID_METRICS} mindkét
     * generátorban ugyanaz a 3 érték) — nem egy általános prefix-heurisztika.
     */
    private static final Map<String, String> GENERATOR_METRIC_DOMAIN = Map.of(
            PredictionEntity.METRIC_SLEEP_AVG, "sleep",
            PredictionEntity.METRIC_TRAINING_VOLUME, "train",
            PredictionEntity.METRIC_WEIGHT_TREND, "body");

    /** A `metricKey` doménje: elsőként a {@link MetricKey} enum wire-kulcsán át (DiagnosisService
     *  útja), másodikként a generátor-szótáron ({@link #GENERATOR_METRIC_DOMAIN}), végül MEZO. */
    private static TeamCharacter domainCharacterFor(String metricKey) {
        Optional<MetricKey> known = Arrays.stream(MetricKey.values())
                .filter(key -> key.wireKey().equals(metricKey))
                .findFirst();
        if (known.isPresent()) {
            return TeamCharacter.forMetricDomain(known.get().domain().wireKey());
        }
        String domain = GENERATOR_METRIC_DOMAIN.get(metricKey);
        if (domain != null) {
            return TeamCharacter.forMetricDomain(domain);
        }
        return TeamCharacter.MEZO;
    }

    private static Instant atEditionHour(LocalDate date) {
        return date.atStartOfDay(EDITION_ZONE).plusHours(EDITION_HOUR).toInstant();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
