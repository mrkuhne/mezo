package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.appnotification.config.NotificationFeedProperties;
import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * V3.1 detection: for every catalog pair, lag-align the two per-day series over the lookback
 * window, gate on total sample size and binary-group balance, run the pure Pearson math, and
 * UPSERT the statistical pattern row by {@code (user, kind, pair_key)}. Stats refresh while a row is {@code proposed} or
 * {@code monitoring}; a user-judged {@code confirmed}/{@code rejected} row is never auto-touched
 * (V3.3 hooks confirmed-recurrence into fact reinforcement). {@code confidence} stays null —
 * honest small-n (spec §6/§8); everything rendered here is deterministic code, no LLM anywhere.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternDetectionService {

    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final PatternEventRepository patternEventRepository;
    private final CompanionProperties properties;
    private final AppNotificationEmitter appNotificationEmitter;
    private final NotificationFeedProperties feedProperties;

    /**
     * Runs detection for one user over the finished-days window; returns pairs upserted.
     * Deliberately NOT @Transactional: each repository call runs its own transaction, so one
     * pair's DB failure (e.g. a rare uq race on the partial index) cannot mark a shared
     * transaction rollback-only and silently discard every other pair's upsert — the per-pair
     * catch below then isolates for real (review finding).
     */
    public int detect(UUID userId) {
        CompanionProperties.Patterns config = properties.patterns();
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(config.lookbackDays() - 1L);
        int maxLag = config.pairs().stream()
                .mapToInt(CompanionProperties.PatternPair::lagDays).max().orElse(0);
        // Futás-szintű sorozat-cache (V3.4, spec §4): metrikánként EGY series()-hívás az uniós
        // [from, to+maxLag] ablakra — a 29 pár legtöbbje osztozik metrikán.
        Map<MetricKey, Map<LocalDate, Double>> cache = new EnumMap<>(MetricKey.class);
        int upserted = 0;
        for (CompanionProperties.PatternPair pair : config.pairs()) {
            try {
                if (detectPair(userId, pair, from, to, config.minN(), config.minGroupN(), cache, maxLag)) {
                    upserted++;
                }
            } catch (Exception e) {
                log.warn("Pattern detection failed for pair {} of user {}", pair.key(), userId, e);
            }
        }
        return upserted;
    }

    private boolean detectPair(UUID userId, CompanionProperties.PatternPair pair,
                               LocalDate from, LocalDate to, int minN, int minGroupN,
                               Map<MetricKey, Map<LocalDate, Double>> cache, int maxLag) {
        Map<LocalDate, Double> seriesA = PatternGate.window(
                cached(cache, userId, pair.metricA(), from, to, maxLag), from, to);
        Map<LocalDate, Double> seriesB = PatternGate.window(
                cached(cache, userId, pair.metricB(), from, to, maxLag),
                from.plusDays(pair.lagDays()), to.plusDays(pair.lagDays()));
        // A kapu KÖZÖS a monitorral (PatternMonitorService) — a diagnosztika ettől hiteles.
        PatternGate.Outcome outcome = PatternGate.evaluate(seriesA, seriesB, pair.lagDays(),
                minN, minGroupN, pair.metricA().valueKind());
        if (outcome.verdict() != PatternGate.Verdict.LIVE) {
            return false; // no persistence outside the gate (missing, imbalanced or degenerate)
        }
        upsert(userId, pair, outcome.result(), from, to);
        return true;
    }

    private Map<LocalDate, Double> cached(Map<MetricKey, Map<LocalDate, Double>> cache, UUID userId,
                                          MetricKey metric, LocalDate from, LocalDate to, int maxLag) {
        return cache.computeIfAbsent(metric,
                m -> metricSeriesService.series(userId, m, from, to.plusDays(maxLag)));
    }

    private void upsert(UUID userId, CompanionProperties.PatternPair pair,
                        PearsonCorrelation.Result result, LocalDate from, LocalDate to) {
        PatternEntity pattern = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                        userId, PatternEntity.KIND_STATISTICAL, pair.key())
                .orElse(null);
        if (pattern != null && PatternEntity.STATUS_CONFIRMED.equals(pattern.getStatus())) {
            // V3.3: re-detecting a CONFIRMED pattern (same direction) reinforces its promoted
            // fact — the stats themselves stay frozen (the user judged THAT correlation).
            // Monitoring rows do NOT reinforce (decision: silent monitoring stays silent).
            reinforcePromotedFact(pattern, result);
            recordSnapshot(pattern, result);
            return;
        }
        if (pattern != null && PatternEntity.STATUS_REJECTED.equals(pattern.getStatus())) {
            return; // user-judged — frozen for the nightly job
        }
        boolean isNew = pattern == null;
        if (pattern == null) {
            pattern = new PatternEntity();
            pattern.setCreatedBy(userId);
            pattern.setKind(PatternEntity.KIND_STATISTICAL);
            pattern.setPairKey(pair.key());
            pattern.setStatus(PatternEntity.STATUS_PROPOSED);
        }
        pattern.setCategory(pair.category());
        pattern.setCategoryLabel(pair.label());
        pattern.setTitle(pair.title());
        pattern.setMechanism(mechanism(pair, result));
        pattern.setEvidence(new PatternEvidenceEnvelope(evidence(result, from, to)));
        pattern.setR(BigDecimal.valueOf(result.r()).setScale(4, RoundingMode.HALF_UP));
        pattern.setN(result.n());
        pattern.setP(BigDecimal.valueOf(result.p()).setScale(6, RoundingMode.HALF_UP));
        pattern.setConfidence(null); // honest small-n — V3.2's critique fills it for hypotheses
        pattern.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS)); // timestamptz stores micros — truncate so the persisted row equals the in-memory one (mezo-mfmb)
        patternRepository.saveAndFlush(pattern);
        recordSnapshot(pattern, result);
        if (isNew && passesInboxGate(result)) {
            appNotificationEmitter.emit(userId, AppNotificationKind.PATTERN_INBOX,
                    "Új minta vár döntésre",
                    "„" + pair.title() + "” — erős jel rajzolódik ki. Döntsd el, figyeljük-e.",
                    AppNotificationKind.PATTERN_INBOX.deeplink() + pair.key(),
                    pattern.getId(), "pattern_inbox:" + pair.key());
        }
    }

    /** S1 (mezo-tk88.1): one history snapshot per LIVE evaluation — the detail chart's raw data.
     *  Feed (mezo-gzhp.1): a band crossing on a still-undecided row also emits a pattern_signal
     *  notification — the SAME |r| bands the FE strengthWord uses (0.3/0.6), config-pinned. */
    private void recordSnapshot(PatternEntity pattern, PearsonCorrelation.Result result) {
        var previous = patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        pattern.getCreatedBy(), pattern.getId(), PatternEventEntity.KIND_SNAPSHOT);
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(pattern.getCreatedBy());
        event.setPatternId(pattern.getId());
        event.setKind(PatternEventEntity.KIND_SNAPSHOT);
        event.setOccurredAt(Instant.now());
        event.setPayload(PatternEventPayloadEnvelope.snapshot(result.r(), result.n(), result.p()));
        patternEventRepository.saveAndFlush(event);

        boolean undecided = PatternEntity.STATUS_PROPOSED.equals(pattern.getStatus())
                || PatternEntity.STATUS_MONITORING.equals(pattern.getStatus());
        if (undecided && previous.isPresent() && previous.get().getPayload().r() != null) {
            int prevBand = band(previous.get().getPayload().r());
            int newBand = band(result.r());
            if (prevBand != newBand) {
                boolean strengthened = newBand > prevBand;
                appNotificationEmitter.emit(pattern.getCreatedBy(), AppNotificationKind.PATTERN_SIGNAL,
                        "Egy minta jele " + (strengthened ? "erősödött" : "gyengült"),
                        "„" + pattern.getTitle() + "” — átlépett egy erősség-sávot.",
                        AppNotificationKind.PATTERN_SIGNAL.deeplink() + pattern.getPairKey(),
                        pattern.getId(),
                        "pattern_signal:" + pattern.getPairKey() + ":" + LocalDate.now());
            }
        }
    }

    /** |r| → band index 0/1/2 — MUST mirror the FE strengthWord thresholds (findings.ts). */
    private int band(double r) {
        double abs = Math.abs(r);
        if (abs < feedProperties.bandPromising()) {
            return 0;
        }
        return abs < feedProperties.bandStrong() ? 1 : 2;
    }

    private boolean passesInboxGate(PearsonCorrelation.Result result) {
        return Math.abs(result.r()) >= feedProperties.inboxMinAbsR()
                && result.p() <= feedProperties.inboxMaxP();
    }

    /** Same-direction re-detection bumps the promoted fact's reinforcement (V3.3). */
    private void reinforcePromotedFact(PatternEntity pattern, PearsonCorrelation.Result result) {
        if (pattern.getPromotedFactId() == null || pattern.getR() == null) {
            return;
        }
        if (Math.signum(result.r()) != Math.signum(pattern.getR().doubleValue())) {
            return; // direction flipped — that is NOT the confirmed pattern recurring
        }
        Instant cooldownFloor = Instant.now().minus(
                properties.patterns().reinforceCooldownDays(), ChronoUnit.DAYS);
        knowledgeFactRepository.findById(pattern.getPromotedFactId()).ifPresent(fact -> {
            if (fact.getLastReinforcedAt() != null && fact.getLastReinforcedAt().isAfter(cooldownFloor)) {
                return; // the sliding window re-counts the SAME evidence — cool down (review finding)
            }
            fact.setReinforcementCount(fact.getReinforcementCount() + 1);
            fact.setLastReinforcedAt(Instant.now());
            knowledgeFactRepository.saveAndFlush(fact);
            PatternEventEntity event = new PatternEventEntity();
            event.setCreatedBy(pattern.getCreatedBy());
            event.setPatternId(pattern.getId());
            event.setKind(PatternEventEntity.KIND_REINFORCED);
            event.setOccurredAt(Instant.now());
            event.setPayload(PatternEventPayloadEnvelope.reinforced(fact.getReinforcementCount()));
            patternEventRepository.saveAndFlush(event);
            log.info("Confirmed pattern {} recurred — fact {} reinforced to {}",
                    pattern.getPairKey(), fact.getId(), fact.getReinforcementCount());
            appNotificationEmitter.emit(pattern.getCreatedBy(), AppNotificationKind.FACT_REINFORCED,
                    "Egy tudás megerősödött ×" + fact.getReinforcementCount(),
                    "„" + fact.getFactText() + "” — újra előjött ugyanabban az irányban.",
                    AppNotificationKind.FACT_REINFORCED.deeplink(), fact.getId(),
                    "fact_reinforced:" + fact.getId() + ":" + fact.getReinforcementCount());
        });
    }

    /** Deterministic Hungarian description — strength + direction + the two metric labels. */
    private String mechanism(CompanionProperties.PatternPair pair, PearsonCorrelation.Result result) {
        double abs = Math.abs(result.r());
        String strength = abs >= 0.6 ? "Erős" : abs >= 0.3 ? "Közepes erősségű" : "Gyenge";
        String direction = result.r() >= 0 ? "pozitív" : "negatív";
        String lag = pair.lagDays() > 0 ? " (" + pair.lagDays() + " napos eltolással)" : "";
        return strength + " " + direction + " együttjárás a(z) " + pair.metricA().labelHu()
                + " és a(z) " + pair.metricB().labelHu() + " között" + lag
                + " az elmúlt " + properties.patterns().lookbackDays() + " napban.";
    }

    private List<String> evidence(PearsonCorrelation.Result result, LocalDate from, LocalDate to) {
        return List.of(
                String.format(Locale.ROOT, "r=%.2f", result.r()),
                "n=" + result.n() + " nap",
                String.format(Locale.ROOT, "p=%.3f", result.p()),
                from + " – " + to);
    }
}
