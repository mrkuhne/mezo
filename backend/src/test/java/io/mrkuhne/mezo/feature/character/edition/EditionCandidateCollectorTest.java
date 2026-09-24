package io.mrkuhne.mezo.feature.character.edition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope.Item;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope.Thread;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope.Change;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidate;
import io.mrkuhne.mezo.feature.character.service.edition.EditionCandidateCollector;
import io.mrkuhne.mezo.feature.character.service.edition.EditionGenre;
import io.mrkuhne.mezo.feature.character.service.edition.TeamCharacter;
import io.mrkuhne.mezo.feature.character.service.edition.TeamEditionReads;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EditionCandidateCollectorTest {

    private static final UUID OWNER = UUID.randomUUID();
    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);

    private TeamEditionReads reads;
    private EditionCandidateCollector collector;

    @BeforeEach
    void setUp() {
        reads = mock(TeamEditionReads.class);
        collector = new EditionCandidateCollector(reads);
        // Defaults: nothing anywhere, tests override the sources they exercise.
        when(reads.monitor(OWNER)).thenReturn(monitorResponse(List.of(), 10));
        when(reads.patterns(OWNER)).thenReturn(List.of());
        when(reads.resolvedPredictions(eq(OWNER), any(), any())).thenReturn(List.of());
        when(reads.activeExperiments(OWNER)).thenReturn(List.of());
        when(reads.dailyConference(eq(OWNER), any())).thenReturn(Optional.empty());
    }

    // ---- helpers -----------------------------------------------------------------------------

    private static PatternMonitorResponse monitorResponse(List<PatternMonitorPair> pairs, int minN) {
        return PatternMonitorResponse.builder()
                .windowFrom(DAY.minusDays(30)).windowTo(DAY).lookbackDays(30).minN(minN).cron("x")
                .pairs(pairs).metrics(List.of()).build();
    }

    private static PatternMonitorPair pair(String key, String title, String domainA, Integer n) {
        return PatternMonitorPair.builder()
                .key(key).title(title).category("physiology").categoryLabel("Élettan")
                .lagDays(0).metricAKey("a").metricALabel("A").metricAValueKind("number")
                .metricBKey("b").metricBLabel("B").metricBValueKind("number")
                .mechanismHu("mech").questionHu("q").expectedDirection("positive")
                .whenPositiveHu("pos").whenNegativeHu("neg")
                .metricADomain(domainA).metricBDomain(domainA)
                .verdict("live").alignedDays(n == null ? 0 : n).n(n).build();
    }

    private static PatternEntity pattern(String status, String pairKey, Integer n, Instant lastDetectedAt) {
        PatternEntity p = new PatternEntity();
        p.setId(UUID.randomUUID());
        p.setKind(PatternEntity.KIND_STATISTICAL);
        p.setPairKey(pairKey);
        p.setCategory("physiology");
        p.setCategoryLabel("Élettan");
        p.setTitle("Pattern title");
        p.setMechanism("mechanism text");
        p.setStatus(status);
        p.setN(n);
        p.setLastDetectedAt(lastDetectedAt);
        return p;
    }

    private static PredictionEntity prediction(String status, LocalDate validTo, String metricKey,
            String actual, String basis) {
        PredictionEntity p = new PredictionEntity();
        p.setId(UUID.randomUUID());
        p.setWeekStart(validTo.minusDays(6));
        p.setTitle("Prediction title");
        p.setBasis(basis);
        p.setMetricKey(metricKey);
        p.setExpectedDirection(PredictionEntity.DIRECTION_UP);
        p.setValidFrom(validTo.minusDays(6));
        p.setValidTo(validTo);
        p.setStatus(status);
        p.setActual(actual);
        p.setGeneratedAt(Instant.now());
        return p;
    }

    private static ExperimentEntity experiment(LocalDate startDate, int totalDays, String metricKey) {
        ExperimentEntity e = new ExperimentEntity();
        e.setId(UUID.randomUUID());
        e.setTitle("Experiment title");
        e.setHypothesis("hypothesis text");
        e.setStatus(ExperimentEntity.STATUS_ACTIVE);
        e.setMetricKey(metricKey);
        e.setExpectedDirection("up");
        e.setStartDate(startDate);
        e.setTotalDays(totalDays);
        e.setGeneratedAt(Instant.now());
        return e;
    }

    private static CharacterConferenceEntity conference(List<Thread> threads, List<Change> changes) {
        CharacterConferenceEntity c = new CharacterConferenceEntity();
        c.setId(UUID.randomUUID());
        c.setKind("DAILY");
        c.setWeekStart(DAY);
        c.setDeliberation(new ConferenceDeliberationEnvelope(threads));
        c.setOutcome(new ConferenceOutcomeEnvelope(changes));
        c.setGeneratedAt(Instant.parse("2026-09-24T20:00:00Z"));
        return c;
    }

    // ---- sor 1: PatternEntity proposed -> KERDES ---------------------------------------------

    @Test void proposedPatternBecomesKerdes() {
        Instant lastDetected = Instant.parse("2026-09-23T10:00:00Z");
        PatternEntity p = pattern(PatternEntity.STATUS_PROPOSED, "pair-1", 12, lastDetected);
        when(reads.patterns(OWNER)).thenReturn(List.of(p));
        when(reads.monitor(OWNER)).thenReturn(
                monitorResponse(List.of(pair("pair-1", "Pair title", "sleep", 40)), 10));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        EditionCandidate c = out.get(0);
        assertThat(c.sourceKind()).isEqualTo("pattern");
        assertThat(c.genre()).isEqualTo(EditionGenre.KERDES);
        assertThat(c.character()).isEqualTo(TeamCharacter.SZUNYA);
        assertThat(c.recordText()).isEqualTo("mechanism text");
        assertThat(c.facts()).containsExactly("12 nap");
        assertThat(c.sourceRoute()).isEqualTo("/mezo/patterns/pair-1");
        assertThat(c.waiting()).isTrue();
        assertThat(c.changedAt()).isEqualTo(lastDetected);
    }

    @Test void proposedPatternWithoutKnownPairFallsBackToMezo() {
        PatternEntity p = pattern(PatternEntity.STATUS_PROPOSED, "unknown-pair", 0, Instant.now());
        when(reads.patterns(OWNER)).thenReturn(List.of(p));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).character()).isEqualTo(TeamCharacter.MEZO);
        assertThat(out.get(0).facts()).isEmpty(); // n=0 -> no fact
    }

    // ---- Fix round (mezo-a9bo7.12): blank mechanism must not kill the whole edition ------------

    @Test void proposedPatternWithBlankMechanismFallsBackToTitle() {
        PatternEntity p = pattern(PatternEntity.STATUS_PROPOSED, "pair-1", 1, Instant.now());
        p.setMechanism("   ");
        when(reads.patterns(OWNER)).thenReturn(List.of(p));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).recordText()).isEqualTo(p.getTitle());
    }

    @Test void proposedPatternWithNullMechanismFallsBackToTitle() {
        PatternEntity p = pattern(PatternEntity.STATUS_PROPOSED, "pair-1", 1, Instant.now());
        p.setMechanism(null);
        when(reads.patterns(OWNER)).thenReturn(List.of(p));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).recordText()).isEqualTo(p.getTitle());
    }

    @Test void proposedPatternWithBlankMechanismAndBlankTitleIsDropped() {
        PatternEntity p = pattern(PatternEntity.STATUS_PROPOSED, "pair-1", 1, Instant.now());
        p.setMechanism(null);
        p.setTitle("  ");
        when(reads.patterns(OWNER)).thenReturn(List.of(p));

        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    // ---- sor 2: PatternEntity confirmed + friss -> MEGFIGYELES ---------------------------------

    @Test void confirmedPatternNewerThanLastEditionBecomesMegfigyeles() {
        Instant lastDetected = Instant.parse("2026-09-24T08:00:00Z");
        Instant lastEditionAt = Instant.parse("2026-09-23T21:00:00Z");
        PatternEntity p = pattern(PatternEntity.STATUS_CONFIRMED, "pair-1", 20, lastDetected);
        when(reads.patterns(OWNER)).thenReturn(List.of(p));
        when(reads.monitor(OWNER)).thenReturn(
                monitorResponse(List.of(pair("pair-1", "Pair title", "train", 40)), 10));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, lastEditionAt);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).genre()).isEqualTo(EditionGenre.MEGFIGYELES);
        assertThat(out.get(0).character()).isEqualTo(TeamCharacter.MOCOR);
        assertThat(out.get(0).waiting()).isFalse();
        assertThat(out.get(0).changedAt()).isEqualTo(lastDetected);
    }

    @Test void confirmedPatternNotNewerThanLastEditionYieldsNoCandidate() {
        Instant lastDetected = Instant.parse("2026-09-20T08:00:00Z");
        Instant lastEditionAt = Instant.parse("2026-09-23T21:00:00Z");
        PatternEntity p = pattern(PatternEntity.STATUS_CONFIRMED, "pair-1", 20, lastDetected);
        when(reads.patterns(OWNER)).thenReturn(List.of(p));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, lastEditionAt);

        assertThat(out).isEmpty();
    }

    @Test void otherPatternStatusesYieldNoCandidate() {
        PatternEntity monitoring = pattern(PatternEntity.STATUS_MONITORING, "pair-1", 3, Instant.now());
        PatternEntity rejected = pattern(PatternEntity.STATUS_REJECTED, "pair-1", 3, Instant.now());
        when(reads.patterns(OWNER)).thenReturn(List.of(monitoring, rejected));

        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    // ---- sor 3: monitor pár, 5 <= n < minN -> SEJTES -------------------------------------------

    @Test void gatheringPairBecomesSejtes() {
        when(reads.monitor(OWNER)).thenReturn(
                monitorResponse(List.of(pair("pair-x", "Gyűlik cím", "fuel", 7)), 10));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        EditionCandidate c = out.get(0);
        assertThat(c.sourceKind()).isEqualTo("pair");
        assertThat(c.genre()).isEqualTo(EditionGenre.SEJTES);
        assertThat(c.character()).isEqualTo(TeamCharacter.FALAT);
        assertThat(c.recordText()).isEqualTo("Gyűlik cím");
        assertThat(c.facts()).containsExactly("7 közös nap", "10 kell");
        assertThat(c.sourceRoute()).isEqualTo("/mezo/patterns/pair-x");
        assertThat(c.waiting()).isFalse();
        assertThat(c.changedAt()).isNull();
    }

    @Test void pairBelowFiveYieldsNoCandidate() {
        when(reads.monitor(OWNER)).thenReturn(monitorResponse(List.of(pair("pair-x", "t", "fuel", 4)), 10));
        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    @Test void pairAtOrAboveMinNYieldsNoCandidate() {
        when(reads.monitor(OWNER)).thenReturn(monitorResponse(List.of(pair("pair-x", "t", "fuel", 10)), 10));
        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    // ---- sor 4: PredictionEntity validated/missed in window -> ELOREJELZES --------------------

    @Test void resolvedPredictionInWindowBecomesElorejelzes() {
        LocalDate validTo = DAY.minusDays(2);
        PredictionEntity p = prediction(PredictionEntity.STATUS_VALIDATED, validTo,
                "sleep-quality", "actual text", "basis text");
        when(reads.resolvedPredictions(OWNER, DAY.minusDays(7), DAY)).thenReturn(List.of(p));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        EditionCandidate c = out.get(0);
        assertThat(c.genre()).isEqualTo(EditionGenre.ELOREJELZES);
        assertThat(c.character()).isEqualTo(TeamCharacter.SZUNYA);
        assertThat(c.recordText()).isEqualTo("actual text");
        assertThat(c.facts()).isEmpty();
        assertThat(c.sourceRoute()).isEqualTo("/mezo/predictions/" + p.getId());
        assertThat(c.waiting()).isFalse();
        assertThat(c.changedAt()).isEqualTo(
                validTo.atStartOfDay(ZoneId.of("Europe/Budapest")).plusHours(21).toInstant());
    }

    @Test void missedPredictionWithBlankActualFallsBackToBasis() {
        LocalDate validTo = DAY.minusDays(1);
        PredictionEntity p = prediction(PredictionEntity.STATUS_MISSED, validTo,
                "unknown-metric", "  ", "basis text");
        when(reads.resolvedPredictions(OWNER, DAY.minusDays(7), DAY)).thenReturn(List.of(p));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).recordText()).isEqualTo("basis text");
        assertThat(out.get(0).character()).isEqualTo(TeamCharacter.MEZO); // unknown metric key
    }

    // ---- Fix round 1: a proaktív generátorok metricKey-szótára (weight_trend/sleep_avg/
    // training_volume) NEM MetricKey wire-kulcs -> explicit fallback-tábla, nem MEZO ------------

    @Test void predictionWithGeneratorSleepAvgKeyRoutesToSzunya() {
        PredictionEntity p = prediction(PredictionEntity.STATUS_VALIDATED, DAY.minusDays(1),
                PredictionEntity.METRIC_SLEEP_AVG, "actual", "basis");
        when(reads.resolvedPredictions(OWNER, DAY.minusDays(7), DAY)).thenReturn(List.of(p));

        assertThat(collector.collect(OWNER, DAY, null).get(0).character()).isEqualTo(TeamCharacter.SZUNYA);
    }

    @Test void predictionWithGeneratorTrainingVolumeKeyRoutesToMocor() {
        PredictionEntity p = prediction(PredictionEntity.STATUS_VALIDATED, DAY.minusDays(1),
                PredictionEntity.METRIC_TRAINING_VOLUME, "actual", "basis");
        when(reads.resolvedPredictions(OWNER, DAY.minusDays(7), DAY)).thenReturn(List.of(p));

        assertThat(collector.collect(OWNER, DAY, null).get(0).character()).isEqualTo(TeamCharacter.MOCOR);
    }

    @Test void predictionWithGeneratorWeightTrendKeyRoutesToDeruViaBody() {
        PredictionEntity p = prediction(PredictionEntity.STATUS_VALIDATED, DAY.minusDays(1),
                PredictionEntity.METRIC_WEIGHT_TREND, "actual", "basis");
        when(reads.resolvedPredictions(OWNER, DAY.minusDays(7), DAY)).thenReturn(List.of(p));

        assertThat(collector.collect(OWNER, DAY, null).get(0).character()).isEqualTo(TeamCharacter.DERU);
    }

    @Test void experimentWithGeneratorSleepAvgKeyRoutesToSzunya() {
        ExperimentEntity e = experiment(DAY, 9, PredictionEntity.METRIC_SLEEP_AVG);
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        assertThat(collector.collect(OWNER, DAY, null).get(0).character()).isEqualTo(TeamCharacter.SZUNYA);
    }

    @Test void experimentWithGeneratorTrainingVolumeKeyRoutesToMocor() {
        ExperimentEntity e = experiment(DAY, 9, PredictionEntity.METRIC_TRAINING_VOLUME);
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        assertThat(collector.collect(OWNER, DAY, null).get(0).character()).isEqualTo(TeamCharacter.MOCOR);
    }

    @Test void experimentWithGeneratorWeightTrendKeyRoutesToDeruViaBody() {
        ExperimentEntity e = experiment(DAY, 9, PredictionEntity.METRIC_WEIGHT_TREND);
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        assertThat(collector.collect(OWNER, DAY, null).get(0).character()).isEqualTo(TeamCharacter.DERU);
    }

    // ---- sor 5: ExperimentEntity active, day in {1, ceil(total/2), total} -> KISERLET ---------

    @Test void experimentOnFirstDayBecomesKiserlet() {
        ExperimentEntity e = experiment(DAY, 9, "sleep-quality");
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        EditionCandidate c = out.get(0);
        assertThat(c.genre()).isEqualTo(EditionGenre.KISERLET);
        assertThat(c.character()).isEqualTo(TeamCharacter.SZUNYA);
        assertThat(c.recordText()).isEqualTo("hypothesis text");
        assertThat(c.facts()).containsExactly("1. nap", "9 napból");
        assertThat(c.changedAt()).isEqualTo(
                DAY.atStartOfDay(ZoneId.of("Europe/Budapest")).plusHours(21).toInstant());
    }

    @Test void experimentOnMiddleDayBecomesKiserlet() {
        // total=9 -> ceil(9/2)=5 -> startDate + 4 days = day
        ExperimentEntity e = experiment(DAY.minusDays(4), 9, "sleep-quality");
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).facts()).containsExactly("5. nap", "9 napból");
    }

    @Test void experimentOnLastDayBecomesKiserlet() {
        ExperimentEntity e = experiment(DAY.minusDays(8), 9, "sleep-quality");
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).facts()).containsExactly("9. nap", "9 napból");
    }

    @Test void experimentOnOtherDayYieldsNoCandidate() {
        // day 2 of 9 is neither first, middle(5) nor last(9)
        ExperimentEntity e = experiment(DAY.minusDays(1), 9, "sleep-quality");
        when(reads.activeExperiments(OWNER)).thenReturn(List.of(e));

        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    // ---- sor 6: DAILY konzílium szálai -> KONZILIUM --------------------------------------------

    @Test void skepticLedThreadOwnerIsMezo() {
        Item item = new Item(0, "szkeptikus", "Első felvetés szövege", "NEW", null, false, List.of(), null, null);
        Thread thread = new Thread("dim-1", "Cím", List.of(item));
        CharacterConferenceEntity conf = conference(List.of(thread), List.of());
        when(reads.dailyConference(OWNER, DAY)).thenReturn(Optional.of(conf));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out).hasSize(1);
        EditionCandidate c = out.get(0);
        assertThat(c.sourceKind()).isEqualTo("konzilium");
        assertThat(c.genre()).isEqualTo(EditionGenre.KONZILIUM);
        assertThat(c.character()).isEqualTo(TeamCharacter.MEZO); // szkeptikus never posts
        assertThat(c.recordText()).isEqualTo("Első felvetés szövege");
        assertThat(c.sourceRoute()).isEqualTo("/mezo/karakter/konzilium");
        assertThat(c.waiting()).isFalse();
        assertThat(c.changedAt()).isEqualTo(Instant.parse("2026-09-24T20:00:00Z"));
    }

    @Test void threadOwnerFollowsFirstItemsExpert() {
        Item item = new Item(0, "szomnologus", "Alvás felvetés", "NEW", null, false, List.of(), null, null);
        Thread thread = new Thread("dim-sleep", "Cím", List.of(item));
        CharacterConferenceEntity conf = conference(List.of(thread), List.of());
        when(reads.dailyConference(OWNER, DAY)).thenReturn(Optional.of(conf));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out.get(0).character()).isEqualTo(TeamCharacter.SZUNYA);
    }

    @Test void threadDimensionInOutcomeChangesMarksClaimChange() {
        Item item = new Item(0, "edzo", "Edzés felvetés", "NEW", null, false, List.of(), null, null);
        Thread thread = new Thread("dim-train", "Cím", List.of(item));
        Change change = new Change("UPDATE", "dim-train", null, "summary");
        CharacterConferenceEntity conf = conference(List.of(thread), List.of(change));
        when(reads.dailyConference(OWNER, DAY)).thenReturn(Optional.of(conf));

        List<EditionCandidate> out = collector.collect(OWNER, DAY, null);

        assertThat(out.get(0).claimChange()).isTrue();
    }

    @Test void threadDimensionNotInOutcomeChangesLeavesClaimChangeFalse() {
        Item item = new Item(0, "edzo", "Edzés felvetés", "NEW", null, false, List.of(), null, null);
        Thread thread = new Thread("dim-train", "Cím", List.of(item));
        Change change = new Change("UPDATE", "dim-other", null, "summary");
        CharacterConferenceEntity conf = conference(List.of(thread), List.of(change));
        when(reads.dailyConference(OWNER, DAY)).thenReturn(Optional.of(conf));

        assertThat(collector.collect(OWNER, DAY, null).get(0).claimChange()).isFalse();
    }

    @Test void noDailyConferenceYieldsNoKonziliumCandidate() {
        when(reads.dailyConference(OWNER, DAY)).thenReturn(Optional.empty());
        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    @Test void emptyThreadItemsYieldsNoCandidateForThatThread() {
        Thread empty = new Thread("dim-empty", "Cím", List.of());
        CharacterConferenceEntity conf = conference(List.of(empty), List.of());
        when(reads.dailyConference(OWNER, DAY)).thenReturn(Optional.of(conf));

        assertThat(collector.collect(OWNER, DAY, null)).isEmpty();
    }

    // ---- refs --------------------------------------------------------------------------------

    @Test void everyCandidateCarriesItsOwnSourceRef() {
        PatternEntity p = pattern(PatternEntity.STATUS_PROPOSED, "pair-1", 1, Instant.now());
        when(reads.patterns(OWNER)).thenReturn(List.of(p));

        EditionCandidate c = collector.collect(OWNER, DAY, null).get(0);

        assertThat(c.refs()).containsExactly(
                new io.mrkuhne.mezo.feature.character.entity.EditionRef("pattern", p.getId().toString()));
    }

    // Mockito ArgumentMatchers shortcuts (kept local, avoids a static-import clash with the DTO builders).
    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }

    private static <T> T eq(T value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
